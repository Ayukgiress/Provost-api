import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, IsString, Max, MaxLength, Min } from 'class-validator';

export const DOCUMENT_TYPES = {
  pdf: { mimeType: 'application/pdf', extension: 'pdf' },
  docx: { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extension: 'docx' },
  jpg: { mimeType: 'image/jpeg', extension: 'jpg' },
  png: { mimeType: 'image/png', extension: 'png' },
} as const;

export class CreateDocumentUploadDto {
  @ApiProperty({ example: 'Personal statement' })
  @IsString() @MaxLength(120)
  label: string;

  @ApiProperty({ enum: Object.keys(DOCUMENT_TYPES) })
  @IsIn(Object.keys(DOCUMENT_TYPES))
  fileType: keyof typeof DOCUMENT_TYPES;

  @ApiProperty({ minimum: 1, maximum: 10485760 })
  @IsInt() @Min(1) @Max(10 * 1024 * 1024)
  sizeBytes: number;
}