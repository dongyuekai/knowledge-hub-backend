import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  permissionName: string;

  @IsString()
  permissionCode: string;

  @Type(() => Number)
  @IsInt()
  permissionType: number;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  menuUrl?: string;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  permissionName?: string;

  @IsOptional()
  @IsString()
  permissionCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  permissionType?: number;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  menuUrl?: string;

  @IsOptional()
  @IsString()
  apiUrl?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sort?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status?: number;
}

export class QueryPermissionDto {
  @IsOptional()
  @IsString()
  keyword?: string;

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

export class AssignPermissionIdsDto {
  @IsArray()
  @IsString({ each: true })
  permissionIds: string[];
}
