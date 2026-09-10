import { Client } from '@elastic/elasticsearch';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** ES 文档级全文检索索引名 */
const ES_INDEX = 'kh_document';

/**
 * 文档级全文搜索索引
 *
 * <p>与 RAG 向量索引的区别：</p>
 * - 这里是「整篇文档」一条记录（标题/摘要/全文），给关键词搜索用
 * - RAG 是「多块 + 向量」，给后续对话检索预留
 *
 * <p>仅写入 Elasticsearch `kh_document`；ES 不可用时跳过写入并打日志。</p>
 */
@Injectable()
export class SearchIndexService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexService.name);
  private es: Client | null = null;
  private readonly esEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.esEnabled =
      this.config.get<string>('ELASTICSEARCH_ENABLED', 'true') !== 'false';
  }

  async onModuleInit() {
    if (!this.esEnabled) {
      this.logger.warn('Elasticsearch 已禁用，搜索索引将跳过写入');
      return;
    }

    const node = this.config.get('ELASTICSEARCH_NODE', 'http://localhost:9200');
    this.es = new Client({ node });
    try {
      const health = await this.es.cluster.health();
      this.logger.log(
        `SearchIndex ES 已连接：${node}, status=${health.status}`,
      );
      await this.ensureEsIndex();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Elasticsearch 不可用，搜索索引将跳过写入：${message}`);
      this.es = null;
    }
  }

  async onModuleDestroy() {
    await this.es?.close();
  }

  /**
   * Upsert 一篇文档的搜索记录（含 Mongo 全文）。
   */
  async indexDocument(doc: Record<string, unknown>) {
    if (!this.es) {
      this.logger.warn(
        `跳过搜索索引写入（ES 不可用）：documentId=${String(doc.id)}`,
      );
      return;
    }

    const id = String(doc.id);
    await this.es.index({
      index: ES_INDEX,
      id,
      document: {
        ...doc,
        indexedAt: new Date().toISOString(),
      },
      refresh: true,
    });

    this.logger.log(`搜索索引已写入 ES：documentId=${id}`);
  }

  /** 下架 / 删除时从 ES 移除 */
  async deleteDocument(documentId: string) {
    if (!this.es) {
      this.logger.warn(
        `跳过搜索索引删除（ES 不可用）：documentId=${documentId}`,
      );
      return;
    }

    try {
      await this.es.delete({
        index: ES_INDEX,
        id: documentId,
        refresh: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('404')) {
        this.logger.warn(`ES 删除失败：documentId=${documentId}, ${message}`);
      }
    }

    this.logger.log(`搜索索引已删除：documentId=${documentId}`);
  }

  /**
   * 关键词检索 kh_document。
   * ES 不可用时返回空分页，不抛错。
   */
  async searchDocuments(params: {
    keyword: string;
    page?: number;
    pageSize?: number;
    categoryId?: string;
    authorId?: string;
  }) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 10, 50);
    const from = (page - 1) * pageSize;

    if (!this.es) {
      this.logger.warn('跳过搜索查询（ES 不可用）');
      return { items: [], total: 0, page, pageSize };
    }

    const filters: Record<string, unknown>[] = [];
    if (params.categoryId) {
      filters.push({ term: { categoryId: params.categoryId } });
    }
    if (params.authorId) {
      filters.push({ term: { authorId: params.authorId } });
    }

    const keyword = params.keyword.trim();
    // title^3 / summary^2：标题、摘要命中比正文权重大；filter 只筛不参与打分
    const query =
      filters.length > 0
        ? {
            bool: {
              must: [
                {
                  multi_match: {
                    query: keyword,
                    fields: ['title^3', 'summary^2', 'content'],
                    analyzer: 'ik_smart',
                  },
                },
              ],
              filter: filters,
            },
          }
        : {
            multi_match: {
              query: keyword,
              fields: ['title^3', 'summary^2', 'content'],
              analyzer: 'ik_smart',
            },
          };

    try {
      const response = await this.es.search({
        index: ES_INDEX,
        from,
        size: pageSize,
        query,
        // 列表不回传全文，仍用 content 做匹配与高亮
        _source: {
          excludes: ['content'],
        },
        // 命中片段打 <em>，给前端做摘要；正文最多 3 段、标题整段不高亮切片
        highlight: {
          fields: {
            title: { number_of_fragments: 0 },
            content: { fragment_size: 160, number_of_fragments: 3 },
            summary: { fragment_size: 120, number_of_fragments: 1 },
          },
        },
      });

      const totalRaw = response.hits.total;
      const total =
        typeof totalRaw === 'number' ? totalRaw : (totalRaw?.value ?? 0);

      const items = (response.hits.hits ?? []).map((hit) => {
        const src = (hit._source ?? {}) as Record<string, unknown>;
        const highlight = hit.highlight ?? {};
        return {
          id: String(src.id ?? hit._id),
          title: src.title ?? '',
          summary: src.summary ?? null,
          categoryId: src.categoryId ?? null,
          tags: src.tags ?? null,
          authorId: src.authorId ?? null,
          status: src.status ?? null,
          publishTime: src.publishTime ?? null,
          score: hit._score ?? 0,
          highlight: {
            title: highlight.title ?? [],
            summary: highlight.summary ?? [],
            content: highlight.content ?? [],
          },
        };
      });

      return { items, total, page, pageSize };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`搜索查询失败：${message}`);
      return { items: [], total: 0, page, pageSize };
    }
  }

  /** 中文：写入细切（ik_max_word），检索粗切（ik_smart） */
  private readonly ikText = {
    type: 'text' as const,
    analyzer: 'ik_max_word',
    search_analyzer: 'ik_smart',
  };

  /** 索引不存在则创建；已有但未配 IK 则删掉重建（须重新发布文档） */
  private async ensureEsIndex() {
    if (!this.es) return;
    const exists = await this.es.indices.exists({ index: ES_INDEX });
    if (exists) {
      const mapping = await this.es.indices.getMapping({ index: ES_INDEX });
      const title = mapping[ES_INDEX]?.mappings?.properties?.title as
        { analyzer?: string } | undefined;
      if (title?.analyzer === 'ik_max_word') {
        return;
      }
      this.logger.warn(
        `索引 ${ES_INDEX} 未使用 IK，将删除并重建（请重新发布文档）`,
      );
      await this.es.indices.delete({ index: ES_INDEX });
    }

    await this.es.indices.create({
      index: ES_INDEX,
      mappings: {
        properties: {
          id: { type: 'keyword' },
          title: this.ikText,
          summary: this.ikText,
          content: this.ikText,
          tags: { type: 'keyword' },
          status: { type: 'integer' },
          categoryId: { type: 'keyword' },
          authorId: { type: 'keyword' },
          publishTime: { type: 'date' },
        },
      },
    });
    this.logger.log(`已创建 ES 索引：${ES_INDEX}（ik_max_word / ik_smart）`);
  }
}
