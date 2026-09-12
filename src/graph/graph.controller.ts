import { Controller, Get, Query } from '@nestjs/common';
import { GraphBuildService } from '../pipeline/graph-build.service';
import {
  GraphOverviewDto,
  GraphQueryDto,
  GraphSearchDto,
} from './dto/graph-query.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { PermissionCode } from '../common/constants/permissions';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthUser } from '../auth/auth-user.interface';
import { accessFromUser } from '../document/document-access';

@Controller('graph')
@RequirePermission(PermissionCode.search)
export class GraphController {
  constructor(private readonly graph: GraphBuildService) {}

  /** 全景：文档 / 实体 / 标签 + 统计，供前端力导向图 */
  @Get('overview')
  overview(@Query() query: GraphOverviewDto, @CurrentUser() user: AuthUser) {
    return this.graph.getOverview({
      keyword: query.keyword,
      entityType: query.entityType,
      from: query.from,
      to: query.to,
      docLimit: query.docLimit,
      scope: accessFromUser(user),
    });
  }

  /** 按关键词搜实体 / 文档 / 块节点 */
  @Get('search')
  search(@Query() query: GraphSearchDto, @CurrentUser() user: AuthUser) {
    return this.graph.searchGraph(
      query.keyword,
      query.limit ?? 50,
      accessFromUser(user),
    );
  }

  /** 知识实体节点 */
  @Get('nodes')
  listNodes(@Query() query: GraphQueryDto, @CurrentUser() user: AuthUser) {
    return this.graph.listNodes(
      query.type,
      query.limit ?? 200,
      accessFromUser(user),
    );
  }

  /** 实体间 RELATED_TO 边 */
  @Get('edges')
  listEdges(@Query() query: GraphQueryDto, @CurrentUser() user: AuthUser) {
    return this.graph.listEdges(query.limit ?? 500, accessFromUser(user));
  }
}
