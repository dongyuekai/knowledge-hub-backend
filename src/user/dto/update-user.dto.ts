import { IsEmail, IsInt, IsOptional, IsString } from 'class-validator';

/** 管理员更新用户资料 */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  realName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @IsInt()
  status?: number;
}
