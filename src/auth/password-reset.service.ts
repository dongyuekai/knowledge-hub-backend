import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const RESET_CODE_PREFIX = 'password:reset:code:';
export const RESET_CODE_TTL_SECONDS = 10 * 60;
export const RESET_CODE_COOLDOWN_SECONDS = 60;

/** 密码重置验证码（Redis 存储） */
@Injectable()
export class PasswordResetService {
  constructor(private readonly redis: RedisService) {}

  private key(email: string): string {
    return `${RESET_CODE_PREFIX}${email.toLowerCase()}`;
  }

  async set(email: string, code: string): Promise<void> {
    await this.redis.set(this.key(email), code, RESET_CODE_TTL_SECONDS);
  }

  async get(email: string): Promise<string | null> {
    return this.redis.get(this.key(email));
  }

  async getTtl(email: string): Promise<number> {
    return this.redis.ttl(this.key(email));
  }

  async verify(email: string, code: string): Promise<boolean> {
    const stored = await this.get(email);
    return stored !== null && stored === code;
  }

  async delete(email: string): Promise<void> {
    await this.redis.del(this.key(email));
  }
}
