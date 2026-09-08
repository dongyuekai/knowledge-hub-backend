import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

/** 登录 */
export class LoginDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}

/** 注册（简化：注册后 status=1，立即可登录） */
export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  realName?: string;
}

/** 刷新 Token */
export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}
