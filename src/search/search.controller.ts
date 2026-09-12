import { Body, Controller, Post } from '@nestjs/common';
import { SearchIndexService } from '../pipeline/search-index.service';
import { SearchDocumentsDto } from './dto/search.dto';
import { RequirePermission } from '../auth/decorators/require-permission.decorator';
import { PermissionCode } from '../common/constants/permissions';
import type { AuthUser } from '../auth/auth-user.interface';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { accessFromUser } from '../document/document-access';

@Controller('search')
export class SearchController {
  constructor(private readonly searchIndex: SearchIndexService) {}

  /** 关键词检索已发布文档（ES kh_document） */
  @Post()
  @RequirePermission(PermissionCode.search)
  search(@Body() dto: SearchDocumentsDto, @CurrentUser() user: AuthUser) {
    return this.searchIndex.searchDocuments({
      keyword: dto.keyword,
      page: dto.page,
      pageSize: dto.pageSize,
      categoryId: dto.categoryId,
      authorId: dto.authorId,
      scope: accessFromUser(user),
    });
  }
}
