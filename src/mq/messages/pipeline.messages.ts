/** RAG 重建索引消息 */
export type ReindexType = 'BY_DOC_IDS';

export interface ReindexMessage {
  taskId: string;
  type: ReindexType;
  documentIds?: string[];
}
