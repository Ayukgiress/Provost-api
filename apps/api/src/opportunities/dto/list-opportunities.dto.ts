import { ApiPropertyOptional } from '@nestjs/swagger';
import { OpportunityType } from '@provost/database';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListOpportunitiesDto {
  @ApiPropertyOptional() @IsOptional() @IsString() search?: string;
  @ApiPropertyOptional({ enum: OpportunityType }) @IsOptional() @IsEnum(OpportunityType) type?: OpportunityType;
  @ApiPropertyOptional() @IsOptional() @IsString() country?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() level?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() field?: string;
  @ApiPropertyOptional({ type: Boolean, default: false })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean()
  closing_soon = false;
  @ApiPropertyOptional({ minimum: 1, default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
