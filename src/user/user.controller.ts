import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { QueryUserDto } from './dto/query-user.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { AssignRolesDto } from './dto/assign-roles.dto';
import { AssignPermissionIdsDto } from './dto/permission.dto';
import { UpdateProfileDto } from './dto/profile.dto';
import { ChangePasswordDto, ResetPasswordDto } from './dto/password.dto';
import { PermissionService } from './permission.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleCode } from '../common/constants/roles';
import type { AuthUser } from '../auth/auth-user.interface';

@Controller('users')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly permissionService: PermissionService,
  ) {}

  @Put('me')
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(user.userId, dto);
  }

  @Get('me/stats')
  getMyStats(@CurrentUser() user: AuthUser) {
    return this.userService.getUserStatistics(user.userId);
  }

  @Put('password/change')
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.userService.changePassword(
      user.userId,
      dto.oldPassword,
      dto.newPassword,
    );
    return { message: '密码修改成功' };
  }

  @Get('page')
  @Roles(RoleCode.ADMIN)
  pageUsers(@Query() query: QueryUserDto) {
    return this.userService.pageUsers(query);
  }

  @Get(':id')
  @Roles(RoleCode.ADMIN)
  getUser(@Param('id') id: string) {
    return this.userService.getUserVO(id);
  }

  @Post()
  @Roles(RoleCode.ADMIN)
  async createUser(@Body() dto: CreateUserDto) {
    const userId = await this.userService.createUser(dto);
    return this.userService.getUserVO(userId);
  }

  @Put(':id')
  @Roles(RoleCode.ADMIN)
  updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.userService.updateUser(id, dto);
  }

  @Delete(':id')
  @Roles(RoleCode.ADMIN)
  async deleteUser(@Param('id') id: string) {
    await this.userService.deleteUser(id);
    return { message: '删除成功' };
  }

  @Put(':id/password/reset')
  @Roles(RoleCode.ADMIN)
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    await this.userService.resetPassword(id, dto.newPassword);
    return { message: '密码重置成功' };
  }

  @Get(':id/roles')
  @Roles(RoleCode.ADMIN)
  async getUserRoles(@Param('id') id: string) {
    const roleCodes = await this.userService.getUserRoleCodes(id);
    return { userId: id, roleCodes };
  }

  @Put(':id/roles')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:user')
  async assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto) {
    const roleCodes = await this.userService.replaceRoles(id, dto.roleCodes);
    return { userId: id, roleCodes };
  }

  @Get(':id/permissions')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:user')
  async getUserPermissions(@Param('id') id: string) {
    await this.userService.findByIdOrThrow(id);
    const permissionCodes =
      await this.permissionService.getUserPermissionCodes(id);
    const permissionIds =
      await this.permissionService.getUserDirectPermissionIds(id);
    return { userId: id, permissionCodes, directPermissionIds: permissionIds };
  }

  @Put(':id/permissions')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:user')
  async assignUserPermissions(
    @Param('id') id: string,
    @Body() dto: AssignPermissionIdsDto,
  ) {
    await this.userService.findByIdOrThrow(id);
    const permissionIds = await this.permissionService.assignUserPermissions(
      id,
      dto,
    );
    return { userId: id, permissionIds };
  }
}
