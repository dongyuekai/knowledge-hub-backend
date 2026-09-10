import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChunkHit } from '../pipeline/types/pipeline.types';

interface DashScopeRerankResponse {
  output?: {
    results?: Array<{
      index: number;
      relevance_score: number;
    }>;
  };
  message?: string;
  code?: string;
}

/**
 * 文本 reranker（DashScope text-rerank）。
 *
 * <p>对 RRF 粗排后的候选块打相关性分。未配置或调用失败时返回 null，由上层降级为 RRF 顺序。</p>
 */
@Injectable()
export class RerankerService {
  private readonly logger = new Logger(RerankerService.name);
  private readonly enabled: boolean;
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly endpoint: string;

  constructor(config: ConfigService) {
    this.enabled = config.get<string>('RAG_RERANK_ENABLED', 'true') !== 'false';
    this.apiKey =
      config.get<string>('RERANK_API_KEY') ||
      config.get<string>('DASHSCOPE_API_KEY') ||
      config.get<string>('OPENAI_API_KEY') ||
      undefined;
    this.model = config.get('RAG_RERANK_MODEL', 'qwen3.7-text-rerank');
    const host = config.get(
      'RERANK_BASE_URL',
      'https://dashscope.aliyuncs.com',
    );
    this.endpoint = `${host.replace(/\/$/, '')}/api/v1/services/rerank/text-rerank/text-rerank`;
  }

  isEnabled(): boolean {
    return this.enabled && Boolean(this.apiKey);
  }

  /**
   * 按 query 与文档相关性重排，取 topN。
   * 失败返回 null。
   */
  async rerank(
    query: string,
    candidates: ChunkHit[],
    topN: number,
  ): Promise<ChunkHit[] | null> {
    if (!candidates.length) return [];
    if (!this.isEnabled()) {
      this.logger.warn('Reranker 未启用或未配置 Key，跳过重排');
      return null;
    }

    const documents = candidates.map((hit) => this.toDocument(hit));
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          input: { query, documents },
          parameters: {
            return_documents: false,
            top_n: Math.min(topN, candidates.length),
          },
        }),
      });

      const body = (await response.json()) as DashScopeRerankResponse;
      if (!response.ok) {
        this.logger.warn(
          `Rerank 调用失败：status=${response.status}, code=${body.code ?? ''}, message=${body.message ?? ''}`,
        );
        return null;
      }

      const results = body.output?.results ?? [];
      if (!results.length) {
        this.logger.warn('Rerank 返回空结果，降级为 RRF');
        return null;
      }

      const reranked = results
        .filter((item) => item.index >= 0 && item.index < candidates.length)
        .map((item) => ({
          ...candidates[item.index],
          score: item.relevance_score,
        }));

      this.logger.log(
        `Rerank 完成：model=${this.model}, in=${candidates.length}, out=${reranked.length}`,
      );
      return reranked;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Rerank 异常，降级为 RRF：${message}`);
      return null;
    }
  }

  private toDocument(hit: ChunkHit): string {
    const heading = hit.heading ? `${hit.heading}\n` : '';
    const text = `${hit.documentTitle}\n${heading}${hit.content}`.trim();
    return text.length > 2000 ? `${text.slice(0, 2000)}...` : text;
  }
}
