import { ApiPropertyOptional } from '@nestjs/swagger';
import { SavedItemStatus } from '@provost/database';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class UpdateSavedDto {
  @ApiPropertyOptional({ format: 'uuid' }) @IsOptional() @IsUUID()
  opportunityId?: string;

  @ApiPropertyOptional({ enum: SavedItemStatus }) @IsOptional() @IsEnum(SavedItemStatus)
  status?: SavedItemStatus;

  @ApiPropertyOptional({ maxLength: 10000 }) @IsOptional() @IsString() @MaxLength(10000)
  notes?: string | null;
}
