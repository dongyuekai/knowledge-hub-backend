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
import { TeamService } from './team.service';
import { CreateTeamDto, QueryTeamDto, UpdateTeamDto } from './dto/team.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RoleCode } from '../common/constants/roles';
import type { AuthUser } from '../auth/auth-user.interface';

@Controller('teams')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Post()
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  create(@Body() dto: CreateTeamDto) {
    return this.teamService.create(dto);
  }

  @Put(':id')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamService.update(id, dto);
  }

  @Delete(':id')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  async delete(@Param('id') id: string) {
    await this.teamService.delete(id);
    return { message: '删除成功' };
  }

  @Get('page')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  page(@Query() query: QueryTeamDto) {
    return this.teamService.page(query);
  }

  /** 当前用户所在团队（含担任负责人的），登录即可 */
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.teamService.listMine(user.userId);
  }

  @Get('tree')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  getTree(@Query('rootOnly') rootOnly?: string) {
    return this.teamService.getTree(rootOnly === 'true');
  }

  @Get(':id')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  getDetail(@Param('id') id: string) {
    return this.teamService.getDetail(id);
  }

  @Post(':id/members')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  addMembers(@Param('id') id: string, @Body() userIds: string[]) {
    return this.teamService.addMembers(id, userIds);
  }

  @Delete(':id/members')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  removeMembers(@Param('id') id: string, @Body() userIds: string[]) {
    return this.teamService.removeMembers(id, userIds);
  }

  @Get(':id/members')
  @Roles(RoleCode.ADMIN)
  @RequirePermission('system:team')
  listMembers(@Param('id') id: string) {
    return this.teamService.listMembers(id);
  }
}
