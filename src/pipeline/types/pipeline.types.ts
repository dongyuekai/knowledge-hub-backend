/**
 * 管线共用类型定义
 *
 * 这些结构在 MQ 消息体、分块结果、图谱抽取结果之间流转。
 */

/**
 * 一篇文档切出来的一块文本。
 * RAG：附 embedding 写入 ES `kh_chunk`（dense_vector）；KG：作为抽实体的输入单元。
 */
export interface DocumentChunk {
  /** 稳定 ID：sha256(documentId:index) 前 64 位，重建时可覆盖 */
  chunkId: string;
  documentId: string;
  documentTitle: string;
  /** 实际送去嵌入 / 抽取的文本（通常含章节标题前缀） */
  content: string;
  /** 所属 Markdown 标题；无标题章节为 null */
  heading?: string | null;
  /** 从 0 开始的块序号 */
  chunkIndex: number;
  /** 该文档总块数（切完后回填） */
  totalChunks: number;
  categoryId?: string | null;
  authorId?: string | null;
  teamId?: string | null;
  docStatus?: number | null;
  publishTime?: string | null;
  /** 向量；分块阶段为空，EmbeddingService 填充后写入 ES dense_vector */
  embedding?: number[];
}

/** 图谱实体（如「张三」「入职流程」「知识库」） */
export interface ExtractedEntity {
  name: string;
  /** PERSON / ORGANIZATION / CONCEPT / DOCUMENT / PROCESS / PRODUCT 等，见 docs/kg-extraction-schema.md */
  type: string;
  description?: string;
  aliases?: string[];
}

/** 实体间关系：source -[relation]-> target */
export interface ExtractedRelation {
  source: string;
  target: string;
  relation: string;
  weight?: number;
}

/** 单个 chunk 的抽取结果 */
export interface ExtractionResult {
  chunkId?: string;
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
}

/**
 * 管线内部使用的「文档快照」：
 * Postgres 元数据 + Mongo 正文拼在一起，避免各服务重复查库。
 */
export interface PipelineDocument {
  id: string;
  title: string;
  content: string;
  summary?: string | null;
  categoryId?: string | null;
  authorId?: string | null;
  teamId?: string | null;
  status: number;
  tags?: string | null;
  isPublic?: boolean;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishTime?: Date | string | null;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
}
