import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import { CreateSavedDto } from './dto/create-saved.dto.js';
import { DeleteSavedDto } from './dto/delete-saved.dto.js';
import { UpdateSavedDto } from './dto/update-saved.dto.js';
import { SavedService } from './saved.service.js';

@ApiTags('Saved opportunities')
@ApiBearerAuth()
@Controller('me/saved')
export class SavedController {
  constructor(private readonly saved: SavedService) {}

  @Get()
  @ApiOperation({ summary: 'List saved opportunities' })
  @ApiOkResponse({ description: 'Applicant saved items' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.saved.list(user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Save an opportunity (free plan limited to 3 active items)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSavedDto) {
    return this.saved.create(user.id, dto);
  }

  @Patch()
  @ApiOperation({ summary: 'Update a saved opportunity status or notes' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateSavedDto) {
    return this.saved.update(user.id, dto);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove a saved opportunity' })
  remove(@CurrentUser() user: AuthenticatedUser, @Query() dto: DeleteSavedDto) {
    return this.saved.remove(user.id, dto.opportunityId);
  }
}
