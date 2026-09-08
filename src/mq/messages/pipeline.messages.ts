/** RAG 重建 / 删除索引消息 */
export type ReindexType = 'BY_DOC_IDS' | 'DELETE_BY_DOC_IDS';

export interface ReindexMessage {
  taskId: string;
  type: ReindexType;
  documentIds?: string[];
}

/** ES 搜索索引消息（文档侧直接投递快照，供 Search 消费者落库） */
export type SearchIndexType = 'INDEX' | 'DELETE';

export interface SearchIndexMessage {
  taskId: string;
  type: SearchIndexType;
  documentId: string;
  /** INDEX 时附带的文档快照；DELETE 时可省略 */
  document?: Record<string, unknown>;
}
