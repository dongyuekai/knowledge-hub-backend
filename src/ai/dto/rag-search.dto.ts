import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** RAG 混合检索请求（不生成回答） */
export class RagSearchDto {
  @IsString()
  @IsNotEmpty()
  query: string;

  /** 精排后返回条数，默认 5 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  topK?: number = 5;
}
