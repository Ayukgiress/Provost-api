import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Document } from '@provost/database/entities/document.entity.js';
import { SupabaseStorageService } from '../../storage/supabase-storage.service.js';
import { DocumentsController } from './documents.controller.js';
import { DocumentsService } from './documents.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Document])],
  controllers: [DocumentsController],
  providers: [DocumentsService, SupabaseStorageService],
  exports: [DocumentsService],
})
export class DocumentsModule {}