import { IsEmail, IsOptional, IsString } from 'class-validator';

/** 当前用户更新资料 */
export class UpdateProfileDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  realName?: string;

  @IsOptional()
  @IsString()
  avatar?: string;
}
