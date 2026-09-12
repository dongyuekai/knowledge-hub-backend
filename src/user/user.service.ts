import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { compare, hash } from 'bcryptjs';
import { nextSnowflakeId } from '../common/snowflake-id';
import { RoleCode } from '../common/constants/roles';
import { AuthUser } from '../auth/auth-user.interface';
import { DocumentEntity } from '../document/entities/document.entity';
import { UserEntity } from './entities/user.entity';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { PermissionService } from './permission.service';
import { TeamService } from '../team/team.service';
import { QueryUserDto } from './dto/query-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/profile.dto';
import { UserVO } from './vo/user.vo';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(DocumentEntity)
    private readonly documentRepo: Repository<DocumentEntity>,
    private readonly permissionService: PermissionService,
    private readonly teamService: TeamService,
  ) {}

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepo.findOne({ where: { email, deleted: false } });
  }

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

  async toUserVO(user: UserEntity): Promise<UserVO> {
    const roleCodes = await this.getRoleCodes(user.id);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      realName: user.realName,
      avatar: user.avatar,
      status: user.status,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roleCodes,
    };
  }

  async toAuthUser(
    user: UserEntity,
    roles: string[],
    permissions: string[],
  ): Promise<AuthUser> {
    const teamIds = await this.teamService.listAccessibleTeamIds(user.id);
    return {
      userId: user.id,
      username: user.username,
      realName: user.realName,
      email: user.email,
      avatar: user.avatar,
      roles,
      permissions,
      teamIds: teamIds.map(String),
    };
  }

  async buildAuthUser(userId: string): Promise<AuthUser> {
    const user = await this.findByIdOrThrow(userId);
    if (user.status !== 1) {
      throw new UnauthorizedException('账户已禁用');
    }
    const roles = await this.getRoleCodes(userId);
    const permissions =
      await this.permissionService.getUserPermissionCodes(userId);
    return this.toAuthUser(user, roles, permissions);
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
    if (user.emailVerified === 0) {
      throw new UnauthorizedException('账户未激活，请先验证邮箱');
    }
    const ok = await compare(password, user.password);
    if (!ok) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const roles = await this.getRoleCodes(user.id);
    const permissions = await this.permissionService.getUserPermissionCodes(
      user.id,
    );
    return this.toAuthUser(user, roles, permissions);
  }

  async register(input: {
    username: string;
    password: string;
    email?: string;
    realName?: string;
    requireEmailVerification?: boolean;
  }): Promise<{
    userId: string;
    emailVerificationRequired?: boolean;
  }> {
    const exists = await this.findByUsername(input.username);
    if (exists) {
      throw new ConflictException('用户名已存在');
    }
    if (input.email) {
      const emailUsed = await this.findByEmail(input.email);
      if (emailUsed) throw new ConflictException('邮箱已被使用');
    }

    const userId = nextSnowflakeId();
    const needVerify = input.requireEmailVerification && !!input.email;
    const user = this.userRepo.create({
      id: userId,
      username: input.username,
      password: await hash(input.password, 10),
      email: input.email ?? null,
      realName: input.realName ?? null,
      status: needVerify ? 0 : 1,
      emailVerified: needVerify ? 0 : 1,
    });
    await this.userRepo.save(user);
    await this.assignRole(userId, RoleCode.USER);

    return {
      userId,
      emailVerificationRequired: needVerify,
    };
  }

  /** 管理员创建用户 */
  async createUser(dto: CreateUserDto): Promise<string> {
    const exists = await this.findByUsername(dto.username);
    if (exists) {
      throw new ConflictException('用户名已存在');
    }

    const userId = nextSnowflakeId();
    const user = this.userRepo.create({
      id: userId,
      username: dto.username,
      password: await hash(dto.password, 10),
      email: dto.email ?? null,
      realName: dto.realName ?? null,
      avatar: dto.avatar ?? null,
      status: dto.status ?? 1,
      emailVerified: 1,
    });
    await this.userRepo.save(user);

    const roleCodes = dto.roleCodes?.length ? dto.roleCodes : [RoleCode.USER];
    await this.replaceRoles(userId, roleCodes);
    return userId;
  }

  async updateUser(userId: string, dto: UpdateUserDto): Promise<UserVO> {
    const user = await this.findByIdOrThrow(userId);
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.realName !== undefined) user.realName = dto.realName;
    if (dto.avatar !== undefined) user.avatar = dto.avatar;
    if (dto.status !== undefined) user.status = dto.status;
    await this.userRepo.save(user);
    return this.toUserVO(user);
  }

  async deleteUser(userId: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    user.deleted = true;
    await this.userRepo.save(user);
  }

  async pageUsers(query: QueryUserDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.userRepo.createQueryBuilder('u').where('u.deleted = false');

    if (query.keyword?.trim()) {
      const kw = `%${query.keyword.trim()}%`;
      qb.andWhere(
        '(u.username ILIKE :kw OR u.real_name ILIKE :kw OR u.email ILIKE :kw)',
        { kw },
      );
    }
    if (query.status !== undefined) {
      qb.andWhere('u.status = :status', { status: query.status });
    }
    if (query.roleCode) {
      qb.innerJoin(UserRoleEntity, 'ur', 'ur.user_id = u.id').innerJoin(
        RoleEntity,
        'r',
        'r.id = ur.role_id AND r.role_code = :roleCode',
        { roleCode: query.roleCode },
      );
    }

    qb.orderBy('u.created_at', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);

    const [users, total] = await qb.getManyAndCount();
    const items = await Promise.all(users.map((u) => this.toUserVO(u)));
    return { items, total, page, pageSize };
  }

  async getUserVO(userId: string): Promise<UserVO> {
    const user = await this.findByIdOrThrow(userId);
    return this.toUserVO(user);
  }

  async getUserRoleCodes(userId: string): Promise<string[]> {
    await this.findByIdOrThrow(userId);
    return this.getRoleCodes(userId);
  }

  /** 全量替换用户角色 */
  async replaceRoles(userId: string, roleCodes: string[]): Promise<string[]> {
    await this.findByIdOrThrow(userId);

    const roles = await this.roleRepo.find({
      where: { roleCode: In(roleCodes), status: 1 },
    });
    if (roles.length !== roleCodes.length) {
      const found = new Set(roles.map((r) => r.roleCode));
      const missing = roleCodes.filter((c) => !found.has(c));
      throw new NotFoundException(`角色不存在: ${missing.join(', ')}`);
    }

    await this.userRoleRepo.delete({ userId });
    for (const role of roles) {
      await this.userRoleRepo.save(
        this.userRoleRepo.create({
          id: nextSnowflakeId(),
          userId,
          roleId: role.id,
        }),
      );
    }
    return roleCodes;
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

  async listAllRoles(): Promise<RoleEntity[]> {
    return this.roleRepo.find({
      where: { status: 1 },
      order: { roleName: 'ASC' },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserVO> {
    const user = await this.findByIdOrThrow(userId);
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.realName !== undefined) user.realName = dto.realName;
    if (dto.avatar !== undefined) user.avatar = dto.avatar;
    await this.userRepo.save(user);
    return this.toUserVO(user);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    const ok = await compare(oldPassword, user.password);
    if (!ok) throw new BadRequestException('原密码错误');
    user.password = await hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await this.findByIdOrThrow(userId);
    user.password = await hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  async resetPasswordByEmail(
    email: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.findByEmail(email);
    if (!user) throw new NotFoundException('该邮箱未注册');
    user.password = await hash(newPassword, 10);
    await this.userRepo.save(user);
  }

  async activateEmail(userId: string): Promise<string> {
    const user = await this.findByIdOrThrow(userId);
    if (user.emailVerified === 1) return '账户已激活，请直接登录';
    user.emailVerified = 1;
    user.status = 1;
    await this.userRepo.save(user);
    return '账户激活成功，请登录';
  }

  async getUserStatistics(userId: string) {
    await this.findByIdOrThrow(userId);
    const documentCount = await this.documentRepo.count({
      where: { authorId: userId, deleted: false },
    });
    const raw = await this.documentRepo
      .createQueryBuilder('d')
      .select('COALESCE(SUM(d.view_count), 0)', 'viewCount')
      .addSelect('COALESCE(SUM(d.like_count), 0)', 'likeCount')
      .addSelect('COALESCE(SUM(d.comment_count), 0)', 'commentCount')
      .where('d.author_id = :userId', { userId })
      .andWhere('d.deleted = false')
      .getRawOne<{
        viewCount: string;
        likeCount: string;
        commentCount: string;
      }>();
    return {
      documentCount,
      viewCount: Number(raw?.viewCount ?? 0),
      likeCount: Number(raw?.likeCount ?? 0),
      commentCount: Number(raw?.commentCount ?? 0),
    };
  }
}
