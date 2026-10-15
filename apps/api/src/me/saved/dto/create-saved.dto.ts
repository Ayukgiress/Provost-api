import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class CreateSavedDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  opportunityId: string;
}
