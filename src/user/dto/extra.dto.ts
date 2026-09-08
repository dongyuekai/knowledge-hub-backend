import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SendResetCodeDto {
  @IsEmail()
  email: string;
}

export class ResetPasswordByEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  code: string;

  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class CreateRoleDto {
  @IsString()
  roleName: string;

  @IsString()
  roleCode: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRoleDto {
  @IsOptional()
  @IsString()
  roleName?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  status?: number;
}
