import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  DocumentContent,
  DocumentContentSchema,
} from '../document/schemas/document-content.schema';
import { ChunkingService } from './chunking.service';
import { EmbeddingService } from './embedding.service';
import { ExtractionService } from './extraction.service';
import { GraphBuildService } from './graph-build.service';
import { PipelineOrchestrator } from './pipeline.orchestrator';
import { SearchIndexService } from './search-index.service';
import { VectorIndexService } from './vector-index.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DocumentContent.name, schema: DocumentContentSchema },
    ]),
  ],
  providers: [
    ChunkingService,
    EmbeddingService,
    ExtractionService,
    GraphBuildService,
    VectorIndexService,
    SearchIndexService,
    PipelineOrchestrator,
  ],
  exports: [
    PipelineOrchestrator,
    VectorIndexService,
    SearchIndexService,
    GraphBuildService,
  ],
})
export class PipelineModule {}
