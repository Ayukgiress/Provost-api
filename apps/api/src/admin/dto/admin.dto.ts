import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  OpportunityType,
  ReviewQueue,
  TrustTier,
} from '@provost/database';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsArray,
  IsBoolean,
  IsDefined,
  IsEnum,
  IsInt,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class AdminListDto {
  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit = 20;
}

export class ReviewQueueListDto extends AdminListDto {
  @ApiPropertyOptional({ enum: ReviewQueue })
  @IsOptional() @IsEnum(ReviewQueue)
  queue?: ReviewQueue;
}

export class AdminReportListDto extends AdminListDto {
  @ApiPropertyOptional({ example: 'pending' })
  @IsOptional() @IsString()
  status?: string;
}

export class OpportunityFieldsDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  title?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional() @IsUUID()
  funderId?: string;

  @ApiPropertyOptional({ enum: OpportunityType })
  @IsOptional() @IsEnum(OpportunityType)
  type?: OpportunityType;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  amount?: string | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  currency?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional() @IsDateString()
  deadline?: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  @IsOptional() @IsObject()
  eligibility?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  requirements?: string | null;

  @ApiPropertyOptional({ type: [String], nullable: true })
  @IsOptional() @IsArray()
  documentsNeeded?: string[] | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @IsUrl({ require_protocol: true })
  applyUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @IsUrl({ require_protocol: true })
  sourceUrl?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional() @IsString()
  summary?: string | null;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional() @IsString() @MaxLength(200)
  slug?: string;
}

export class CreateOpportunityDto extends OpportunityFieldsDto {
  @ApiProperty() @IsDefined()
  declare title: string;

  @ApiProperty({ format: 'uuid' }) @IsDefined()
  declare funderId: string;

  @ApiProperty({ enum: OpportunityType }) @IsDefined()
  declare type: OpportunityType;
}

export class ReviewRejectDto {
  @ApiProperty({ maxLength: 4000 })
  @IsString() @MaxLength(4000)
  reason: string;
}

export class ReviewMoreInfoDto extends ReviewRejectDto {}

export class CreateSourceDto {
  @ApiProperty() @IsUrl({ require_protocol: true })
  url: string;

  @ApiPropertyOptional() @IsOptional() @IsString()
  country?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString()
  type?: string | null;

  @ApiPropertyOptional({ enum: TrustTier }) @IsOptional() @IsEnum(TrustTier)
  trustTier?: TrustTier;

  @ApiPropertyOptional({ minimum: 1, default: 60 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  frequencyMinutes?: number;

  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean()
  needsBrowser?: boolean;
}

export class UpdateSourceDto {
  @ApiPropertyOptional() @IsOptional() @IsUrl({ require_protocol: true })
  url?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString()
  country?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsString()
  type?: string | null;

  @ApiPropertyOptional({ enum: TrustTier }) @IsOptional() @IsEnum(TrustTier)
  trustTier?: TrustTier;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  frequencyMinutes?: number;

  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean()
  needsBrowser?: boolean;

  @ApiPropertyOptional({ type: Boolean }) @IsOptional() @IsBoolean()
  active?: boolean;
}

export class ResolveReportDto {
  @ApiProperty({ enum: ['resolved', 'dismissed'] })
  @IsIn(['resolved', 'dismissed'])
  status: 'resolved' | 'dismissed';

  @ApiPropertyOptional({ maxLength: 4000 })
  @IsOptional() @IsString() @MaxLength(4000)
  note?: string;
}