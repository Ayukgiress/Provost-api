import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsUUID } from 'class-validator';

export class ConfirmAssistantActionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  conversationId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  actionId: string;

  @ApiProperty()
  @IsBoolean()
  approve: boolean;
}