import { Injectable, NotFoundException, PayloadTooLargeException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Document } from '@provost/database/entities/document.entity.js';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { SupabaseStorageService } from '../../storage/supabase-storage.service.js';
import { DOCUMENT_TYPES, type CreateDocumentUploadDto } from './dto/create-document-upload.dto.js';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  constructor(
    @InjectRepository(Document) private readonly documents: Repository<Document>,
    private readonly storage: SupabaseStorageService,
  ) {}

  list(userId: string) {
    return this.documents.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async createUpload(userId: string, dto: CreateDocumentUploadDto) {
    const type = DOCUMENT_TYPES[dto.fileType];
    if (dto.sizeBytes > MAX_DOCUMENT_BYTES) throw new PayloadTooLargeException('Documents are limited to 10 MB');
    const document = this.documents.create({
      userId,
      label: dto.label.trim(),
      storagePath: `${userId}/${randomUUID()}.${type.extension}`,
      mimeType: type.mimeType,
      sizeBytes: String(dto.sizeBytes),
    });
    await this.documents.save(document);
    try {
      const uploadUrl = await this.storage.createSignedUploadUrl(document.storagePath);
      return { id: document.id, uploadUrl, method: 'PUT', expiresInSeconds: 300 };
    } catch (error) {
      await this.documents.delete({ id: document.id, userId });
      throw error;
    }
  }

  async getDownloadUrl(userId: string, id: string) {
    const document = await this.documents.findOne({ where: { id, userId } });
    if (!document) throw new NotFoundException('Document not found');
    return { url: await this.storage.createSignedDownloadUrl(document.storagePath), expiresInSeconds: 300 };
  }

  async getOwnedDocuments(userId: string) {
    return this.documents.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async readText(userId: string, document: Document): Promise<string> {
    if (document.userId !== userId) throw new NotFoundException('Document not found');
    const bytes = await this.storage.readObject(document.storagePath);
    if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new PayloadTooLargeException('Documents are limited to 10 MB');
    if (document.mimeType === 'application/pdf') {
      const pdfParse = (await import('pdf-parse')).default;
      const parsed = await pdfParse(bytes);
      return parsed.text.slice(0, 20000);
    }
    if (document.mimeType === DOCUMENT_TYPES.docx.mimeType) {
      const mammoth = await import('mammoth');
      const parsed = await mammoth.extractRawText({ buffer: bytes });
      return parsed.value.slice(0, 20000);
    }
    return '';
  }
}