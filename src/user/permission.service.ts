import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { nextSnowflakeId } from '../common/snowflake-id';
import {
  ADMIN_OPERATION_PERMISSIONS,
  ADMIN_ROLES,
} from '../common/constants/permissions';
import { PermissionEntity } from './entities/permission.entity';
import { RolePermissionEntity } from './entities/role-permission.entity';
import { UserPermissionEntity } from './entities/user-permission.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { RoleEntity } from './entities/role.entity';
import {
  AssignPermissionIdsDto,
  CreatePermissionDto,
  QueryPermissionDto,
  UpdatePermissionDto,
} from './dto/permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly permRepo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermRepo: Repository<RolePermissionEntity>,
    @InjectRepository(UserPermissionEntity)
    private readonly userPermRepo: Repository<UserPermissionEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async listAll() {
    return this.permRepo.find({
      where: { deleted: false, status: 1 },
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
  }

  async getById(id: string) {
    const perm = await this.permRepo.findOne({
      where: { id, deleted: false },
    });
    if (!perm) throw new NotFoundException('权限不存在');
    return perm;
  }

  async getChildren(parentId: string) {
    return this.permRepo.find({
      where: { parentId, deleted: false, status: 1 },
      order: { sort: 'ASC' },
    });
  }

  async create(dto: CreatePermissionDto) {
    const exists = await this.permRepo.findOne({
      where: { permissionCode: dto.permissionCode, deleted: false },
    });
    if (exists) throw new ConflictException('权限编码已存在');
    const perm = this.permRepo.create({
      id: nextSnowflakeId(),
      parentId: dto.parentId ?? '0',
      permissionName: dto.permissionName,
      permissionCode: dto.permissionCode,
      permissionType: dto.permissionType,
      menuUrl: dto.menuUrl ?? null,
      apiUrl: dto.apiUrl ?? null,
      method: dto.method ?? null,
      icon: dto.icon ?? null,
      sort: dto.sort ?? 0,
      status: dto.status ?? 1,
    });
    return this.permRepo.save(perm);
  }

  async update(id: string, dto: UpdatePermissionDto) {
    const perm = await this.getById(id);
    if (dto.permissionCode && dto.permissionCode !== perm.permissionCode) {
      const exists = await this.permRepo.findOne({
        where: { permissionCode: dto.permissionCode, deleted: false },
      });
      if (exists) throw new ConflictException('权限编码已存在');
      perm.permissionCode = dto.permissionCode;
    }
    if (dto.permissionName !== undefined)
      perm.permissionName = dto.permissionName;
    if (dto.permissionType !== undefined)
      perm.permissionType = dto.permissionType;
    if (dto.parentId !== undefined) {
      if (dto.parentId === id) {
        throw new BadRequestException('父权限不能是自己');
      }
      perm.parentId = dto.parentId;
    }
    if (dto.menuUrl !== undefined) perm.menuUrl = dto.menuUrl;
    if (dto.apiUrl !== undefined) perm.apiUrl = dto.apiUrl;
    if (dto.method !== undefined) perm.method = dto.method;
    if (dto.icon !== undefined) perm.icon = dto.icon;
    if (dto.sort !== undefined) perm.sort = dto.sort;
    if (dto.status !== undefined) perm.status = dto.status;
    return this.permRepo.save(perm);
  }

  async delete(id: string) {
    const perm = await this.getById(id);
    const childCount = await this.permRepo.count({
      where: { parentId: id, deleted: false },
    });
    if (childCount > 0) {
      throw new BadRequestException('存在子权限，无法删除');
    }
    const roleBound = await this.rolePermRepo.count({
      where: { permissionId: id },
    });
    const userBound = await this.userPermRepo.count({
      where: { permissionId: id },
    });
    if (roleBound > 0 || userBound > 0) {
      throw new BadRequestException('权限仍有关联角色或用户，无法删除');
    }
    perm.deleted = true;
    await this.permRepo.save(perm);
  }

  async page(query: QueryPermissionDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const qb = this.permRepo.createQueryBuilder('p').where('p.deleted = false');
    if (query.keyword?.trim()) {
      qb.andWhere(
        '(p.permission_name ILIKE :kw OR p.permission_code ILIKE :kw)',
        { kw: `%${query.keyword.trim()}%` },
      );
    }
    qb.orderBy('p.sort', 'ASC')
      .addOrderBy('p.created_at', 'ASC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [items, total] = await qb.getManyAndCount();
    return { items, total, page, pageSize };
  }

  async getTree() {
    const perms = await this.permRepo.find({
      where: { deleted: false, status: 1 },
      order: { sort: 'ASC', createdAt: 'ASC' },
    });
    const build = (parentId: string): unknown[] =>
      perms
        .filter((p) => p.parentId === parentId)
        .map((p) => ({
          ...p,
          children: build(p.id),
        }));
    return build('0');
  }

  async getRolePermissionIds(roleId: string): Promise<string[]> {
    await this.ensureRoleExists(roleId);
    const rows = await this.rolePermRepo.find({ where: { roleId } });
    return rows.map((r) => r.permissionId);
  }

  async assignRolePermissions(roleId: string, dto: AssignPermissionIdsDto) {
    await this.ensureRoleExists(roleId);
    await this.validatePermissionIds(dto.permissionIds);
    await this.rolePermRepo.delete({ roleId });
    for (const permissionId of dto.permissionIds) {
      await this.rolePermRepo.save(
        this.rolePermRepo.create({
          id: nextSnowflakeId(),
          roleId,
          permissionId,
        }),
      );
    }
    return dto.permissionIds;
  }

  async getUserDirectPermissionIds(userId: string): Promise<string[]> {
    const rows = await this.userPermRepo.find({ where: { userId } });
    return rows.map((r) => r.permissionId);
  }

  async assignUserPermissions(userId: string, dto: AssignPermissionIdsDto) {
    await this.validatePermissionIds(dto.permissionIds);
    await this.userPermRepo.delete({ userId });
    for (const permissionId of dto.permissionIds) {
      await this.userPermRepo.save(
        this.userPermRepo.create({
          id: nextSnowflakeId(),
          userId,
          permissionId,
        }),
      );
    }
    return dto.permissionIds;
  }

  /** 合并直接权限 + 角色权限；管理员追加 ADMIN_OPERATION_PERMISSIONS */
  async getUserPermissionCodes(userId: string): Promise<string[]> {
    const direct = await this.userPermRepo
      .createQueryBuilder('up')
      .innerJoin(PermissionEntity, 'p', 'p.id = up.permission_id')
      .where('up.user_id = :userId', { userId })
      .andWhere('p.status = 1')
      .andWhere('p.deleted = false')
      .select('p.permission_code', 'code')
      .getRawMany<{ code: string }>();

    const viaRole = await this.userRoleRepo
      .createQueryBuilder('ur')
      .innerJoin(RolePermissionEntity, 'rp', 'rp.role_id = ur.role_id')
      .innerJoin(PermissionEntity, 'p', 'p.id = rp.permission_id')
      .where('ur.user_id = :userId', { userId })
      .andWhere('p.status = 1')
      .andWhere('p.deleted = false')
      .select('DISTINCT p.permission_code', 'code')
      .getRawMany<{ code: string }>();

    const set = new Set<string>([
      ...direct.map((r) => r.code),
      ...viaRole.map((r) => r.code),
    ]);

    const roleCodes = await this.userRoleRepo
      .createQueryBuilder('ur')
      .innerJoin(RoleEntity, 'r', 'r.id = ur.role_id')
      .where('ur.user_id = :userId', { userId })
      .andWhere('r.status = 1')
      .select('r.role_code', 'roleCode')
      .getRawMany<{ roleCode: string }>();

    const isAdmin = roleCodes.some((r) =>
      (ADMIN_ROLES as readonly string[]).includes(r.roleCode),
    );
    if (isAdmin) {
      for (const code of ADMIN_OPERATION_PERMISSIONS) {
        set.add(code);
      }
    }

    return [...set];
  }

  private async ensureRoleExists(roleId: string) {
    const role = await this.roleRepo.findOne({ where: { id: roleId } });
    if (!role) throw new NotFoundException('角色不存在');
  }

  private async validatePermissionIds(ids: string[]) {
    if (!ids.length) return;
    const found = await this.permRepo.find({
      where: { id: In(ids), deleted: false, status: 1 },
    });
    if (found.length !== ids.length) {
      throw new NotFoundException('部分权限不存在或已禁用');
    }
  }
}
