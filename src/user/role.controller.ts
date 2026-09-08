import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto, UpdateRoleDto } from './dto/extra.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RoleCode } from '../common/constants/roles';

@Controller('roles')
@Roles(RoleCode.ADMIN)
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Get('list')
  async listRoles() {
    const roles = await this.roleService.listAll();
    return roles.map((r) => ({
      id: r.id,
      roleName: r.roleName,
      roleCode: r.roleCode,
      description: r.description,
    }));
  }

  @Get(':id')
  async getRole(@Param('id') id: string) {
    const role = await this.roleService.getById(id);
    return {
      id: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      description: role.description,
      status: role.status,
    };
  }

  @Post()
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.roleService.create(dto);
    return {
      id: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      description: role.description,
    };
  }

  @Put(':id')
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    const role = await this.roleService.update(id, dto);
    return {
      id: role.id,
      roleName: role.roleName,
      roleCode: role.roleCode,
      description: role.description,
      status: role.status,
    };
  }

  @Delete(':id')
  async deleteRole(@Param('id') id: string) {
    await this.roleService.delete(id);
    return { message: '删除成功' };
  }
}
