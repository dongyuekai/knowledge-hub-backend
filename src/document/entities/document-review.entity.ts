import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { bigintTransformer } from '../../common/transformers/bigint.transformer';

/** 审核结果：1 通过，2 驳回 */
export enum ReviewResult {
  Approved = 1,
  Rejected = 2,
}

/**
 * 文档审核记录（PostgreSQL kh_document_review）
 *
 * 生命周期：submitForReview 创建（review_result=null）→ approve / reject 结案。
 * 同一 document_id 可有多条历史记录，但同时最多一条待审。
 */
@Entity('kh_document_review')
export class DocumentReviewEntity {
  @PrimaryColumn({ type: 'bigint', transformer: bigintTransformer })
  id: string;

  @Column({
    name: 'document_id',
    type: 'bigint',
    transformer: bigintTransformer,
  })
  documentId: string;

  @Column({
    name: 'reviewer_id',
    type: 'bigint',
    nullable: true,
    transformer: bigintTransformer,
  })
  reviewerId?: string | null;

  @Column({ name: 'reviewer_name', type: 'varchar', nullable: true })
  reviewerName?: string | null;

  /** NULL=待审，1=通过，2=驳回 */
  @Column({ name: 'review_result', type: 'smallint', nullable: true })
  reviewResult?: ReviewResult | null;

  @Column({ name: 'review_comment', type: 'varchar', nullable: true })
  reviewComment?: string | null;

  /** 提交审核前的文档 status */
  @Column({ name: 'before_status', type: 'smallint' })
  beforeStatus: number;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
