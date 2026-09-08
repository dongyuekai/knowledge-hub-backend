import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { nextSnowflakeId } from '../common/snowflake-id';
import { RoleCode } from '../common/constants/roles';
import { AuthUser } from '../auth/auth-user.interface';
import { UserEntity } from './entities/user.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
  ) {}

  async findByUsername(username: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({
      where: { username, deleted: false },
    });
  }

  async findByIdOrThrow(userId: string): Promise<UserEntity> {
    const user = await this.userRepo.findOne({
      where: { id: userId, deleted: false },
    });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    return user;
  }

  async getRoleCodes(userId: string): Promise<string[]> {
    const rows = await this.userRoleRepo
      .createQueryBuilder('ur')
      .innerJoin(RoleEntity, 'r', 'r.id = ur.role_id')
      .where('ur.user_id = :userId', { userId })
      .andWhere('r.status = 1')
      .select('r.role_code', 'roleCode')
      .getRawMany<{ roleCode: string }>();
    return rows.map((r) => r.roleCode);
  }

  toAuthUser(user: UserEntity, roles: string[]): AuthUser {
    return {
      userId: user.id,
      username: user.username,
      realName: user.realName,
      email: user.email,
      avatar: user.avatar,
      roles,
    };
  }

  async buildAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.findByIdOrThrow(userId);
    if (user.status !== 1) {
      throw new UnauthorizedException('账户已禁用');
    }
    const roles = await this.getRoleCodes(userId);
    return this.toAuthUser(user, roles);
  }

  async validateCredentials(
    username: string,
    password: string,
  ): Promise<AuthUser> {
    const user = await this.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    if (user.status !== 1) {
      throw new UnauthorizedException('账户已禁用');
    }
    const ok = await compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const roles = await this.getRoleCodes(user.id);
    return this.toAuthUser(user, roles);
  }

  async register(input: {
    username: string;
    password: string;
    email?: string;
    realName?: string;
  }): Promise<{ userId: string }> {
    const exists = await this.findByUsername(input.username);
    if (exists) {
      throw new ConflictException('用户名已存在');
    }

    const userId = nextSnowflakeId();
    const user = this.userRepo.create({
      id: userId,
      username: input.username,
      password: await hash(input.password, 10),
      email: input.email ?? null,
      realName: input.realName ?? null,
      status: 1,
    });
    await this.userRepo.save(user);
    await this.assignRole(userId, RoleCode.USER);
    return { userId };
  }

  async assignRole(userId: string, roleCode: string): Promise<void> {
    const role = await this.roleRepo.findOne({ where: { roleCode } });
    if (!role) {
      throw new NotFoundException(`角色 ${roleCode} 不存在`);
    }
    const exists = await this.userRoleRepo.findOne({
      where: { userId, roleId: role.id },
    });
    if (exists) return;

    await this.userRoleRepo.save(
      this.userRoleRepo.create({
        id: nextSnowflakeId(),
        userId,
        roleId: role.id,
      }),
    );
  }

  async touchLastLogin(userId: string): Promise<void> {
    await this.userRepo.update(userId, { lastLoginAt: new Date() });
  }

  async getUserIdsByRoleCode(roleCode: string): Promise<string[]> {
    const rows = await this.userRoleRepo
      .createQueryBuilder('ur')
      .innerJoin(RoleEntity, 'r', 'r.id = ur.role_id')
      .innerJoin(UserEntity, 'u', 'u.id = ur.user_id')
      .where('r.role_code = :roleCode', { roleCode })
      .andWhere('u.deleted = false')
      .andWhere('u.status = 1')
      .select('u.id', 'userId')
      .getRawMany<{ userId: string }>();
    return rows.map((r) => String(r.userId));
  }
}
