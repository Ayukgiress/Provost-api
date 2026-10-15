import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ProfileService } from './profile.service.js';

@ApiTags('Profile')
@ApiBearerAuth()
@Controller('me/profile')
export class ProfileController {
  constructor(private readonly profiles: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get the authenticated applicant profile' })
  @ApiOkResponse({ description: 'Profile and 0–100 completeness score' })
  get(@CurrentUser() user: AuthenticatedUser) { return this.profiles.get(user.id); }

  @Put()
  @ApiOperation({ summary: 'Create or update the authenticated applicant profile' })
  @ApiOkResponse({ description: 'Updated profile and completeness score' })
  update(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.profiles.update(user.id, dto);
  }
}
