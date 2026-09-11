import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { AiChatService } from './ai-chat.service';
import { AiStreamService } from './ai-stream.service';
import { HybridRetrievalService } from './hybrid-retrieval.service';
import { ChatSessionService } from './chat-session.service';
import { ChatDto } from './dto/chat.dto';
import { ChatStreamDto } from './dto/chat-stream.dto';
import { RagSearchDto } from './dto/rag-search.dto';
import {
  CreateSessionDto,
  QuerySessionDto,
  UpdateSessionDto,
} from './dto/session.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PermissionCode } from '../common/constants/permissions';
import type { AuthUser } from '../auth/auth-user.interface';

@Controller()
export class AiController {
  constructor(
    private readonly aiChat: AiChatService,
    private readonly aiStream: AiStreamService,
    private readonly retrieval: HybridRetrievalService,
    private readonly sessions: ChatSessionService,
  ) {}

  /**
   * RAG 混合检索：关键词 BM25 + 向量 kNN → RRF → rerank。
   * 不调用 LLM，只返回 kh_chunk 命中。
   */
  @Post('rag/search')
  @RequirePermission(PermissionCode.search)
  search(@Body() dto: RagSearchDto) {
    return this.retrieval.retrieve(dto.query.trim(), dto.topK ?? 5);
  }

  /** RAG 对话：混合检索后再作答；写入本人会话 */
  @Post('ai/chat')
  @RequirePermission(PermissionCode.search)
  chat(@Body() dto: ChatDto, @CurrentUser() user: AuthUser) {
    return this.aiChat.chat(dto.content, dto.topK ?? 5, user, dto.sessionId);
  }

  /** LangChain Agent 流式作答，经 @ai-sdk/langchain 转成 UI Message Stream */
  @Post('ai/chat/stream')
  @RequirePermission(PermissionCode.search)
  streamChat(
    @Body() dto: ChatStreamDto,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    return this.aiStream.streamChat(dto, user, res);
  }

  @Get('ai/sessions')
  @RequirePermission(PermissionCode.search)
  listSessions(@Query() query: QuerySessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.pageMine(user.userId, query);
  }

  @Post('ai/sessions')
  @RequirePermission(PermissionCode.search)
  createSession(@Body() dto: CreateSessionDto, @CurrentUser() user: AuthUser) {
    return this.sessions.create(user.userId, dto);
  }

  @Get('ai/sessions/:id/messages')
  @RequirePermission(PermissionCode.search)
  listMessages(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.listMessages(user.userId, id);
  }

  @Patch('ai/sessions/:id')
  @RequirePermission(PermissionCode.search)
  renameSession(
    @Param('id') id: string,
    @Body() dto: UpdateSessionDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sessions.rename(user.userId, id, dto);
  }

  @Delete('ai/sessions/:id')
  @RequirePermission(PermissionCode.search)
  removeSession(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.sessions.remove(user.userId, id);
  }
}
