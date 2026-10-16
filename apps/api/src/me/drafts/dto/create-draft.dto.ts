import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDraftDto {
  @ApiProperty({ description: 'Opportunity for which the application draft is being prepared' })
  @IsUUID()
  opportunityId: string;

  @ApiPropertyOptional({ description: 'Essay question or application prompt; treated as instructions, not as a source of applicant facts' })
  @IsOptional() @IsString() @MaxLength(5000)
  prompt?: string;
}