import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

/** 用户分页列表查询 */
export class QueryUserDto {
  @IsOptional()
  @IsString()
  keyword?: string;

  /** 按角色编码筛选，如 ROLE_REVIEWER */
  @IsOptional()
  @IsString()
  roleCode?: string;

  /** 0 禁用 1 启用 */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
