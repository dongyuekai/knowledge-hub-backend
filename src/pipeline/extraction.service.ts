import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Runnable } from '@langchain/core/runnables';
import { BaseLanguageModelInput } from '@langchain/core/language_models/base';
import {
  buildExtractionSystemPrompt,
  kgExtractionResultSchema,
  KgExtractionLlmOutput,
  normalizeEntityType,
  normalizeRelationType,
} from './kg-extraction.schema';
import { ExtractionResult } from './types/pipeline.types';

/**
 * 实体 / 关系抽取服务
 *
 * <p>供 KG 建图使用：从每个 chunk 抽「实体 + 关系」，再写入 Neo4j。</p>
 * <p>ChatOpenAI.withStructuredOutput，不指定 method：qwen-plus 默认 jsonSchema。</p>
 *
 * <p>环境变量：OPENAI_API_KEY / OPENAI_BASE_URL / MODEL_NAME / KG_MAX_ENTITIES / KG_MAX_RELATIONS / KG_LLM_TIMEOUT_MS</p>
 */
@Injectable()
export class ExtractionService {
  private readonly logger = new Logger(ExtractionService.name);
  /** 单 chunk 最多实体数，防止图爆炸 */
  private readonly maxEntities: number;
  private readonly maxRelations: number;
  private readonly structuredLlm?: Runnable<
    BaseLanguageModelInput,
    KgExtractionLlmOutput
  >;

  constructor(config: ConfigService) {
    const apiKey =
      config.get<string>('OPENAI_API_KEY') ||
      config.get<string>('LLM_API_KEY') ||
      config.get<string>('DASHSCOPE_API_KEY') ||
      undefined;
    this.maxEntities = Number(config.get('KG_MAX_ENTITIES', 12));
    this.maxRelations = Number(config.get('KG_MAX_RELATIONS', 15));

    if (!apiKey) return;

    const baseUrl =
      config.get<string>('OPENAI_BASE_URL') ||
      config.get<string>('LLM_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';
    const model =
      config.get<string>('MODEL_NAME') ||
      config.get<string>('LLM_MODEL') ||
      'qwen-plus';
    const timeout = Number(config.get('KG_LLM_TIMEOUT_MS', 60000));
    const timeoutMs = Number.isFinite(timeout) && timeout > 0 ? timeout : 60000;

    const llm = new ChatOpenAI({
      apiKey,
      model,
      temperature: 0.1,
      timeout: timeoutMs,
      maxRetries: 0,
      // DashScope 走 Chat Completions，不要切 OpenAI Responses API
      useResponsesApi: false,
      configuration: { baseURL: baseUrl },
    });

    this.structuredLlm = llm.withStructuredOutput(kgExtractionResultSchema, {
      name: 'extract_knowledge_graph',
    });
  }

  /**
   * 对单个 chunk 做抽取。
   * @param content chunk 正文
   * @param heading 所属章节标题（给 LLM 当上下文）
   * @param documentTitle 文档标题
   */
  async extract(
    content: string,
    heading: string | null | undefined,
    documentTitle: string,
  ): Promise<ExtractionResult> {
    if (!content?.trim()) {
      return { entities: [], relations: [] };
    }

    return this.extractByLlm(content, heading, documentTitle);
  }

  /**
   * LLM 抽取：system 约束规则，user 塞标题+正文（截断 4000 字防超上下文）。
   */
  private async extractByLlm(
    content: string,
    heading: string | null | undefined,
    documentTitle: string,
  ): Promise<ExtractionResult> {
    if (!this.structuredLlm) {
      throw new Error(
        'KG 抽取未配置 API Key（OPENAI_API_KEY / LLM_API_KEY / DASHSCOPE_API_KEY）',
      );
    }

    const system = buildExtractionSystemPrompt(
      this.maxEntities,
      this.maxRelations,
    );
    const user = `文档标题: ${documentTitle}\n章节: ${heading ?? '无'}\n\n内容:\n${content.slice(0, 4000)}`;

    const started = Date.now();
    const parsed = await this.structuredLlm.invoke([
      new SystemMessage(system),
      new HumanMessage(user),
    ]);
    this.logger.log(
      `KG 抽取完成：title=${documentTitle}, elapsed=${Date.now() - started}ms, chars=${content.length}, entities=${parsed.entities?.length ?? 0}`,
    );

    return this.toExtractionResult(parsed);
  }

  /** 截断数量、规范化类型、丢掉挂空实体的关系 */
  private toExtractionResult(parsed: KgExtractionLlmOutput): ExtractionResult {
    const entityNames = new Set<string>();
    const entities: ExtractionResult['entities'] = [];
    for (const e of (parsed.entities ?? []).slice(0, this.maxEntities)) {
      const name = (e.name ?? '').trim();
      if (!name) continue;
      entityNames.add(name);
      entities.push({
        name,
        type: normalizeEntityType(e.type),
        description: (e.description ?? '').trim(),
        aliases: (e.aliases ?? []).map((a) => String(a).trim()).filter(Boolean),
      });
    }

    const relations: ExtractionResult['relations'] = [];
    for (const r of (parsed.relations ?? []).slice(0, this.maxRelations)) {
      const source = (r.source ?? '').trim();
      const target = (r.target ?? '').trim();
      if (
        !source ||
        !target ||
        !entityNames.has(source) ||
        !entityNames.has(target)
      ) {
        continue;
      }
      relations.push({
        source,
        target,
        relation: normalizeRelationType(r.relation ?? r.type),
        weight: typeof r.weight === 'number' ? r.weight : 0.5,
      });
    }

    return { entities, relations };
  }
}
