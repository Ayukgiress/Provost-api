import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import { CreateDraftDto } from './dto/create-draft.dto.js';
import { DraftsService } from './drafts.service.js';
import { PlusEntitlementGuard } from './plus-entitlement.guard.js';

@ApiTags('Application drafts')
@ApiBearerAuth()
@Controller('me/drafts')
export class DraftsController {
  constructor(private readonly drafts: DraftsService) {}

  @Get()
  @ApiOperation({ summary: 'List the authenticated user’s drafts' })
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.drafts.list(user.id);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(PlusEntitlementGuard)
  @ApiOperation({
    summary:
      'Generate an unsent, fact-grounded application draft (Plus plan required)',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateDraftDto) {
    return this.drafts.create(user.id, dto);
  }
}
