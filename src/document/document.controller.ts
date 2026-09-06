import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { UploadParseDto } from './dto/upload-parse.dto';

/** 文档接口 */
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /** 创建文档 */
  @Post()
  create(@Body() dto: CreateDocumentDto) {
    return this.documentService.create(dto);
  }

  /** 上传文件并解析为 Markdown，创建草稿（form-data 字段名: file） */
  @Post('upload/parse')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  uploadAndParse(
    @UploadedFile() file: Express.Multer.File,
    @Body() meta: UploadParseDto,
  ) {
    if (!file) {
      throw new BadRequestException('请上传文件（form-data 字段名: file）');
    }
    return this.documentService.uploadAndCreateDocument(file, meta);
  }

  /** 分页查询文档列表（仅元数据） */
  @Get()
  findAll(@Query() query: QueryDocumentDto) {
    return this.documentService.findAll(query);
  }

  /** 查询文档详情（含正文） */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.documentService.findOne(id);
  }

  /** 更新文档 */
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto) {
    return this.documentService.update(id, dto);
  }

  /** 软删除文档 */
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.documentService.remove(id);
  }
}
