import { Module } from '@nestjs/common';
import { PipelineModule } from '../pipeline/pipeline.module';
import { GraphController } from './graph.controller';

@Module({
  imports: [PipelineModule],
  controllers: [GraphController],
})
export class GraphModule {}
