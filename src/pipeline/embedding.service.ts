import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';

/**
 * 文本向量化服务（基于 LangChain OpenAIEmbeddings）
 *
 * <p>作用：把 chunk 文本变成固定维度浮点向量，供后续相似度检索。</p>
 *
 * <p>相关环境变量：</p>
 * - EMBEDDING_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY
 * - EMBEDDING_BASE_URL、EMBEDDING_MODEL、EMBEDDING_DIMENSION、EMBEDDING_BATCH_SIZE
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  /** 向量维度，需与 ES dense_vector.dims 一致（kh_chunk.embedding） */
  private readonly dimension: number;
  private readonly embeddings: OpenAIEmbeddings;

  constructor(config: ConfigService) {
    this.dimension = Number(config.get('EMBEDDING_DIMENSION', 1024));
    // DashScope text-embedding-v3 单次最多 10 条；超过会 400 InvalidParameter
    const configuredBatch = Number(config.get('EMBEDDING_BATCH_SIZE', 10));
    const batchSize = Math.min(
      Number.isFinite(configuredBatch) && configuredBatch > 0
        ? configuredBatch
        : 10,
      10,
    );
    if (configuredBatch > 10) {
      this.logger.warn(
        `EMBEDDING_BATCH_SIZE=${configuredBatch} 超过 DashScope 上限，已钳制为 10`,
      );
    }

    const apiKey =
      config.get<string>('EMBEDDING_API_KEY') ||
      config.get<string>('DASHSCOPE_API_KEY') ||
      config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      throw new Error(
        '未配置 EMBEDDING_API_KEY / DASHSCOPE_API_KEY / OPENAI_API_KEY',
      );
    }

    const baseUrl = (
      config.get(
        'EMBEDDING_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
      ) ?? ''
    ).trim();
    const model = (
      config.get<string>('EMBEDDING_MODEL', 'text-embedding-v3') ??
      'text-embedding-v3'
    ).trim();
    const trimmedKey = apiKey.trim();

    this.logger.log(
      `Embedding 初始化：model=${model}, baseURL=${baseUrl}, keyPrefix=${trimmedKey.slice(0, 8)}, keyLen=${trimmedKey.length}`,
    );

    this.embeddings = new OpenAIEmbeddings({
      apiKey: trimmedKey,
      model,
      dimensions: this.dimension,
      batchSize,
      // Markdown chunk 保留换行，避免语义被过度压扁
      stripNewLines: false,
      configuration: {
        apiKey: trimmedKey,
        baseURL: baseUrl,
      },
    });
  }

  /** 单条嵌入 */
  async embed(text: string): Promise<number[]> {
    const [vec] = await this.embedBatch([text]);
    return vec;
  }

  /** 批量嵌入（内部按 EMBEDDING_BATCH_SIZE 切片） */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (!texts.length) return [];

    const vectors = await this.embeddings.embedDocuments(texts);
    this.logger.debug(`嵌入完成：count=${vectors.length}`);
    return vectors;
  }
}
