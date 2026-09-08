import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthUser } from './auth-user.interface';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { UserService } from '../user/user.service';

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  userInfo: AuthUser;
}

interface TokenPayload {
  sub: string;
  username: string;
  type: 'access' | 'refresh';
}

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  private accessExpires(): string {
    return this.config.get<string>('JWT_ACCESS_EXPIRES', '2h');
  }

  private refreshExpires(): string {
    return this.config.get<string>('JWT_REFRESH_EXPIRES', '7d');
  }

  private accessExpiresSeconds(): number {
    const raw = this.accessExpires();
    const match = /^(\d+)([smhd])$/.exec(raw);
    if (!match) return 7200;
    const n = Number(match[1]);
    const unit = match[2];
    if (unit === 's') return n;
    if (unit === 'm') return n * 60;
    if (unit === 'h') return n * 3600;
    return n * 86400;
  }

  private signAccessToken(user: AuthUser): string {
    const payload: TokenPayload = {
      sub: user.userId,
      username: user.username,
      type: 'access',
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.accessExpires() as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  private signRefreshToken(user: AuthUser): string {
    const payload: TokenPayload = {
      sub: user.userId,
      username: user.username,
      type: 'refresh',
    };
    return this.jwtService.sign(payload, {
      expiresIn: this.refreshExpires() as `${number}${'s' | 'm' | 'h' | 'd'}`,
    });
  }

  async login(dto: LoginDto): Promise<LoginResult> {
    const user = await this.userService.validateCredentials(
      dto.username,
      dto.password,
    );
    await this.userService.touchLastLogin(user.userId);
    return this.buildLoginResult(user);
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ userId: string; message: string }> {
    const { userId } = await this.userService.register(dto);
    return {
      userId,
      message: '注册成功，请登录',
    };
  }

  async refresh(refreshToken: string): Promise<LoginResult> {
    let payload: TokenPayload;
    try {
      payload = this.jwtService.verify<TokenPayload>(refreshToken);
    } catch {
      throw new UnauthorizedException('refresh token 无效或已过期');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('无效的 refresh token');
    }
    const user = await this.userService.buildAuthUser(payload.sub);
    return this.buildLoginResult(user);
  }

  async getMe(userId: string): Promise<AuthUser> {
    return this.userService.buildAuthUser(userId);
  }

  async buildAuthUser(userId: string): Promise<AuthUser> {
    return this.userService.buildAuthUser(userId);
  }

  async getReviewerIds(): Promise<string[]> {
    return this.userService.getUserIdsByRoleCode('ROLE_REVIEWER');
  }

  private buildLoginResult(user: AuthUser): LoginResult {
    return {
      accessToken: this.signAccessToken(user),
      refreshToken: this.signRefreshToken(user),
      tokenType: 'Bearer',
      expiresIn: this.accessExpiresSeconds(),
      userInfo: user,
    };
  }
}
