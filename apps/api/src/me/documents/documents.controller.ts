import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import { CreateDocumentUploadDto } from './dto/create-document-upload.dto.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('Document vault')
@ApiBearerAuth()
@Controller('me/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user’s documents' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.documents.list(user.id);
  }

  @Post('upload-url')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Create a signed upload URL for a PDF, DOCX, JPG, or PNG up to 10 MB',
  })
  createUpload(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateDocumentUploadDto,
  ) {
    return this.documents.createUpload(user.id, dto);
  }

  @Get(':id/download-url')
  @ApiOperation({
    summary: 'Create a short-lived signed download URL for an owned document',
  })
  download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documents.getDownloadUrl(user.id, id);
  }
}
