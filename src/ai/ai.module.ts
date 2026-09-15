import { Module } from '@nestjs/common';
import { PipelineModule } from '../pipeline/pipeline.module';
import { AiController } from './ai.controller';
import { AiChatService } from './ai-chat.service';
import { AiStreamService } from './ai-stream.service';
import { ChatLongMemoryService } from './chat-long-memory.service';
import { ChatQueryRewriteService } from './chat-query-rewrite.service';
import { ChatSessionService } from './chat-session.service';
import { ChatShortMemoryService } from './chat-short-memory.service';
import { HybridRetrievalService } from './hybrid-retrieval.service';
import { RerankerService } from './reranker.service';
import { WebSearchService } from './web-search.service';

@Module({
  imports: [PipelineModule],
  controllers: [AiController],
  providers: [
    AiChatService,
    AiStreamService,
    ChatSessionService,
    ChatShortMemoryService,
    ChatLongMemoryService,
    ChatQueryRewriteService,
    HybridRetrievalService,
    RerankerService,
    WebSearchService,
  ],
  exports: [AiChatService, HybridRetrievalService],
})
export class AiModule {}
