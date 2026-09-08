import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

/** 全量替换用户角色 */
export class AssignRolesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  roleCodes: string[];
}
