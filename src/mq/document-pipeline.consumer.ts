import { Injectable, Logger } from '@nestjs/common';
import { ConsumeMessage } from 'amqplib';
import { PipelineOrchestrator } from '../pipeline/pipeline.orchestrator';
import { RAG_REINDEX_QUEUE, SEARCH_INDEX_QUEUE } from './mq.constants';
import {
  ReindexMessage,
  SearchIndexMessage,
} from './messages/pipeline.messages';
import { RabbitMqService } from './rabbitmq.service';

/**
 * 文档发布后管线的 MQ 消费者
 *
 * <p>消费：RAG 向量化 + Search 全文索引。</p>
 * <p>注册时机：在构造函数里 `registerHandler`，</p>
 * 保证早于 {@link RabbitMqService.onModuleInit} 的 `bindConsumers`。
 */
@Injectable()
export class DocumentPipelineConsumer {
  private readonly logger = new Logger(DocumentPipelineConsumer.name);

  constructor(
    private readonly rabbit: RabbitMqService,
    private readonly orchestrator: PipelineOrchestrator,
  ) {
    this.rabbit.registerHandler(RAG_REINDEX_QUEUE, (msg) =>
      this.handleRag(msg),
    );
    this.rabbit.registerHandler(SEARCH_INDEX_QUEUE, (msg) =>
      this.handleSearch(msg),
    );
  }

  /** RAG：分块 → 向量化 → ES kh_chunk（dense_vector） */
  private async handleRag(msg: ConsumeMessage) {
    const body = this.parseJson<ReindexMessage>(msg);
    this.logger.log(
      `[RAG] type=${body.type}, taskId=${body.taskId}, documentIds=${JSON.stringify(body.documentIds ?? [])}`,
    );
    await this.orchestrator.handleRagReindex(body.type, body.documentIds);
  }

  /** Search：文档级关键词索引（Elasticsearch kh_document） */
  private async handleSearch(msg: ConsumeMessage) {
    const body = this.parseJson<SearchIndexMessage>(msg);
    this.logger.log(
      `[Search] type=${body.type}, taskId=${body.taskId}, documentId=${body.documentId}`,
    );
    await this.orchestrator.handleSearchIndex(
      body.type,
      body.documentId,
      body.document,
    );
  }

  private parseJson<T>(msg: ConsumeMessage): T {
    return JSON.parse(msg.content.toString('utf8')) as T;
  }
}
