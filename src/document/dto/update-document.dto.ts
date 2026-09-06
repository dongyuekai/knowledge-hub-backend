import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsOptional, IsString } from 'class-validator';
import { CreateDocumentDto } from './create-document.dto';

/** 更新文档（字段均可选） */
export class UpdateDocumentDto extends PartialType(
  OmitType(CreateDocumentDto, ['createBy'] as const),
) {
  /** 更新人 ID */
  @IsOptional()
  @IsString()
  updateBy?: string;
}
