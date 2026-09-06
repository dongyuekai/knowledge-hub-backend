import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';
import {
  DocumentContent,
  DocumentContentSchema,
} from './schemas/document-content.schema';
import { FileParserService } from './parser/file-parser.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
  ],
  controllers: [DocumentController],
  providers: [DocumentService, FileParserService],
  exports: [DocumentService, FileParserService],
})
export class DocumentModule {}
