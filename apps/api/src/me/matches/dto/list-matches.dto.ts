import { ApiPropertyOptional } from '@nestjs/swagger';
import { OpportunityType } from '@provost/database';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListMatchesDto {
  @ApiPropertyOptional({ enum: ['eligible', 'partial', 'ineligible'] })
  @IsOptional() @IsString()
  verdict?: 'eligible' | 'partial' | 'ineligible';

  @ApiPropertyOptional({ enum: OpportunityType })
  @IsOptional() @IsEnum(OpportunityType) type?: OpportunityType;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
