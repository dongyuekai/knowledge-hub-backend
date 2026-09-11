import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingService } from '../pipeline/embedding.service';
import { VectorIndexService } from '../pipeline/vector-index.service';
import { ChunkHit } from '../pipeline/types/pipeline.types';
import { RerankerService } from './reranker.service';

/**
 * kh_chunk 混合检索：
 * 向量召回 + 关键词召回 → RRF 粗融合 → reranker 精排。
 */
@Injectable()
export class HybridRetrievalService {
  private readonly logger = new Logger(HybridRetrievalService.name);
  private readonly hybridTopK: number;
  private readonly rrfC: number;
  /** rerank relevance_score 下限（0–1）。 */
  private readonly minScore: number;

  constructor(
    config: ConfigService,
    private readonly embedding: EmbeddingService,
    private readonly vectorIndex: VectorIndexService,
    private readonly reranker: RerankerService,
  ) {
    this.hybridTopK = Number(config.get('RAG_HYBRID_TOP_K', 20));
    this.rrfC = Number(config.get('RAG_RRF_C', 60));
    this.minScore = Number(config.get('RAG_MIN_SCORE', 0.4));
  }

  async retrieve(query: string, topK = 5): Promise<ChunkHit[]> {
    const queryVector = await this.embedQuery(query);
    const fused = await this.vectorIndex.searchHybrid({
      query,
      queryVector,
      hybridTopK: this.hybridTopK,
      rrfC: this.rrfC,
    });

    if (!fused.length) {
      this.logger.log(`混合检索无结果：queryLength=${query.length}`);
      return [];
    }

    const reranked = await this.reranker.rerank(query, fused, fused.length);
    if (reranked?.length) {
      const kept =
        this.minScore > 0
          ? reranked.filter((hit) => hit.score >= this.minScore)
          : reranked;
      const top = kept.slice(0, topK);
      this.logger.log(
        `检索过滤：rerank=${reranked.length}, minScore=${this.minScore}, ` +
          `best=${reranked[0]?.score?.toFixed(3) ?? '-'}, kept=${kept.length}, return=${top.length}`,
      );
      return top;
    }

    return fused.slice(0, topK);
  }

  private async embedQuery(query: string): Promise<number[] | null> {
    try {
      return await this.embedding.embed(query);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`查询向量化失败，仅走关键词：${message}`);
      return null;
    }
  }
}
