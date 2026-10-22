import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength, IsOptional, IsLocale } from 'class-validator';

export class ChatAssistantDto {
  @ApiProperty({ maxLength: 10000 })
  @IsString() @MinLength(1) @MaxLength(10000)
  message: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID()
  conversationId?: string;

  @ApiPropertyOptional({ description: 'BCP 47 locale tag, e.g. "fr" or "en-US"' })
  @IsOptional() @IsString() @MaxLength(20)
  locale?: string;
}