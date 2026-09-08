import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { nextSnowflakeId } from '../common/snowflake-id';
import { RoleEntity } from './entities/role.entity';
import { UserRoleEntity } from './entities/user-role.entity';
import { CreateRoleDto, UpdateRoleDto } from './dto/extra.dto';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepo: Repository<RoleEntity>,
    @InjectRepository(UserRoleEntity)
    private readonly userRoleRepo: Repository<UserRoleEntity>,
  ) {}

  async listAll() {
    return this.roleRepo.find({
      where: { status: 1 },
      order: { roleName: 'ASC' },
    });
  }

  async getById(id: string) {
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundException('角色不存在');
    return role;
  }

  async create(dto: CreateRoleDto) {
    const exists = await this.roleRepo.findOne({
      where: { roleCode: dto.roleCode },
    });
    if (exists) throw new ConflictException('角色编码已存在');
    const role = this.roleRepo.create({
      id: nextSnowflakeId(),
      roleName: dto.roleName,
      roleCode: dto.roleCode,
      description: dto.description ?? null,
      status: 1,
    });
    return this.roleRepo.save(role);
  }

  async update(id: string, dto: UpdateRoleDto) {
    const role = await this.getById(id);
    if (dto.roleName !== undefined) role.roleName = dto.roleName;
    if (dto.description !== undefined) role.description = dto.description;
    if (dto.status !== undefined) role.status = dto.status;
    return this.roleRepo.save(role);
  }

  async delete(id: string) {
    const role = await this.getById(id);
    const bound = await this.userRoleRepo.count({ where: { roleId: id } });
    if (bound > 0) {
      throw new BadRequestException('角色仍有关联用户，无法删除');
    }
    await this.roleRepo.remove(role);
  }
}
