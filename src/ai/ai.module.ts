import { Module } from '@nestjs/common';
import { PipelineModule } from '../pipeline/pipeline.module';
import { AiController } from './ai.controller';
import { AiChatService } from './ai-chat.service';
import { ChatSessionService } from './chat-session.service';
import { HybridRetrievalService } from './hybrid-retrieval.service';
import { RerankerService } from './reranker.service';

@Module({
  imports: [PipelineModule],
  controllers: [AiController],
  providers: [
    AiChatService,
    ChatSessionService,
    HybridRetrievalService,
    RerankerService,
  ],
  exports: [AiChatService, HybridRetrievalService],
})
export class AiModule {}
