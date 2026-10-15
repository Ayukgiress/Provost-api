import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class DeleteSavedDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  opportunityId: string;
}
