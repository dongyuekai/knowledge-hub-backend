import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from '../../common/transformers/bigint.transformer';
import type { ChatSource } from '../chat.types';

/** AI 会话消息（PostgreSQL kh_ai_message） */
@Entity('kh_ai_message')
export class AiMessageEntity {
  @PrimaryColumn({ type: 'bigint', transformer: bigintTransformer })
  id: string;

  @Column({
    name: 'session_id',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  sessionId: string;

  /** user / assistant */
  @Column({ type: 'varchar', length: 16 })
  role: 'user' | 'assistant';

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  sources?: ChatSource[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
