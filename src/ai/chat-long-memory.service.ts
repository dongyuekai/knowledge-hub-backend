import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { z } from 'zod';
import { MemoryClient } from 'mem0ai';

const memorySchema = z.object({
  write_user: z.boolean(),
  write_session: z.boolean(),
  reason: z.string(),
});

type MemoryClassified = z.infer<typeof memorySchema>;

const CLASSIFIER_PROMPT =
  '你是企业知识库助手的记忆分类器。判断本轮是否有「新事实」要写入 Mem0。\n' +
  '\n' +
  '## user 层（跨会话）\n' +
  '- 用户身份、岗位、所在团队自称\n' +
  '- 长期偏好：答短一点、只要本团队制度、技术回答带示例\n' +
  '- 持久约束：过敏、语言、称呼\n' +
  '\n' +
  '## session 层（仅当前会话）\n' +
  '- 正在排查的问题、本次要写的文档、已确认的下一步\n' +
  '- 用户说「这次」「本轮」的工作上下文\n' +
  '\n' +
  '## 均不写入\n' +
  '- 寒暄、致谢、纯确认\n' +
  '- 助手根据知识库/检索资料说出的制度、流程、负责人、系统名（那是文档事实，不是用户记忆）\n' +
  '- 联网搜索结果、引用编号 [n]\n' +
  '- 无信息增量的复述\n' +
  '\n' +
  '## 原则\n' +
  '1. 知识库内容永远不要写成 user 记忆\n' +
  '2. 「这次先看差旅制度第三节」→ session，不要标成 user\n' +
  '3. user 与 session 可同时为 true\n' +
  '4. 一次性提问且未产生需跨轮记住的约定 → 均为 false\n' +
  '\n' +
  '只输出一个 JSON 对象（不要数组），字段：write_user、write_session、reason。';

/** 模型偶发返回 [{...}]，拆开再校验 */
function parseMemoryClassification(raw: unknown): MemoryClassified {
  const value = Array.isArray(raw) && raw.length > 0 ? raw[0] : raw;
  return memorySchema.parse(value);
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`分类结果不是 JSON：${text.slice(0, 120)}`);
  }
  return JSON.parse(match[0]);
}

export type LongMemoryHits = {
  user: string[];
  session: string[];
};

/**
 * 对话长期记忆（Mem0）。未配置 MEM0_API_KEY 时全部跳过。
 * 记忆只用于改写问题和补上下文，不作制度事实来源。
 */
@Injectable()
export class ChatLongMemoryService {
  private readonly logger = new Logger(ChatLongMemoryService.name);
  private readonly client?: MemoryClient;
  private readonly classifierLlm?: ChatOpenAI;
  private readonly topK: number;

  constructor(config: ConfigService) {
    this.topK = Number(config.get('MEM0_TOP_K', 5));
    const mem0Key = config.get<string>('MEM0_API_KEY') || '';
    const host = config.get<string>('MEM0_HOST') || undefined;
    if (mem0Key) {
      this.client = new MemoryClient({
        apiKey: mem0Key,
        ...(host ? { host } : {}),
      });
    } else {
      this.logger.warn('未配置 MEM0_API_KEY，跳过长期记忆');
    }

    const apiKey =
      config.get<string>('OPENAI_API_KEY') ||
      config.get<string>('LLM_API_KEY') ||
      config.get<string>('DASHSCOPE_API_KEY') ||
      '';
    if (!apiKey || !this.client) return;

    const baseURL =
      config.get<string>('OPENAI_BASE_URL') ||
      config.get<string>('LLM_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const modelName =
      config.get<string>('MODEL_NAME') ||
      config.get<string>('LLM_MODEL') ||
      'qwen-plus';

    this.classifierLlm = new ChatOpenAI({
      apiKey,
      model: modelName,
      temperature: 0,
      timeout: Number(config.get('AI_CHAT_TIMEOUT_MS', 60000)),
      maxRetries: 0,
      useResponsesApi: false,
      configuration: { baseURL },
      modelKwargs: {
        enable_thinking: false,
        response_format: { type: 'json_object' },
      },
    });
  }

  get enabled() {
    return Boolean(this.client);
  }

  async search(
    userId: string,
    sessionId: string | undefined,
    query: string,
  ): Promise<LongMemoryHits> {
    const empty: LongMemoryHits = { user: [], session: [] };
    if (!this.client) return empty;
    try {
      const userRes = await this.client.search(query, {
        filters: { user_id: userId },
        topK: this.topK,
      });
      const sessionRes = sessionId
        ? await this.client.search(query, {
            filters: {
              AND: [{ user_id: userId }, { run_id: sessionId }],
            },
            topK: this.topK,
          })
        : { results: [] };
      return {
        user: (userRes.results ?? [])
          .map((m) => m.memory)
          .filter((text): text is string => Boolean(text)),
        session: (sessionRes.results ?? [])
          .map((m) => m.memory)
          .filter((text): text is string => Boolean(text)),
      };
    } catch (error) {
      this.logger.warn(
        `Mem0 检索失败：${error instanceof Error ? error.message : error}`,
      );
      return empty;
    }
  }

  buildSystemMessage(hits: LongMemoryHits): SystemMessage | null {
    const blocks: string[] = [];
    if (hits.user.length) {
      blocks.push(
        `【用户长期记忆】\n${hits.user.map((line) => `- ${line}`).join('\n')}`,
      );
    }
    if (hits.session.length) {
      blocks.push(
        `【当前会话记忆】\n${hits.session.map((line) => `- ${line}`).join('\n')}`,
      );
    }
    if (!blocks.length) return null;
    return new SystemMessage(
      `${blocks.join('\n\n')}\n\n以上仅作背景，制度/流程以本轮检索资料为准，不要用记忆替代文档。`,
    );
  }

  async rememberTurn(
    userId: string,
    sessionId: string,
    question: string,
    answer: string,
  ): Promise<void> {
    if (!this.client || !this.classifierLlm) return;
    const extractFrom = [{ role: 'user' as const, content: question }];

    let classified: MemoryClassified;
    try {
      classified = await this.classifyTurn(question, answer);
    } catch (error) {
      this.logger.warn(
        `Mem0 分类失败：${error instanceof Error ? error.message : error}`,
      );
      return;
    }

    const { write_user, write_session, reason } = classified;
    const written: string[] = [];
    const addOpts = {
      customInstructions:
        '只用用户说的话抽取记忆，一句完整中文。' +
        '只保存身份、岗位、偏好、约束，或用户声明的本轮任务。' +
        '不要保存制度条文、流程、时限、负责人、系统名、引用编号。' +
        '不要译成英文。',
    };
    try {
      if (write_user) {
        await this.client.add(extractFrom, { userId, ...addOpts });
        written.push('user');
      }
      if (write_session) {
        await this.client.add(extractFrom, {
          userId,
          runId: sessionId,
          ...addOpts,
        });
        written.push('session');
      }
      this.logger.log(
        `Mem0 分类：${reason}；写入=${written.join(',') || '无'}`,
      );
    } catch (error) {
      this.logger.warn(
        `Mem0 写入失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }

  private async classifyTurn(
    question: string,
    answer: string,
  ): Promise<MemoryClassified> {
    const response = await this.classifierLlm!.invoke([
      new SystemMessage(CLASSIFIER_PROMPT),
      new HumanMessage(
        `用户：${question}\n助手（仅供判断，不要当作用户事实）：${answer.slice(0, 300)}`,
      ),
    ]);
    const text =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    return parseMemoryClassification(extractJson(text));
  }

  async clearSession(userId: string, sessionId: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.deleteAll({ userId, runId: sessionId });
    } catch (error) {
      this.logger.warn(
        `Mem0 会话层清理失败：${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
