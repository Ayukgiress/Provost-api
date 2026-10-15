import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import { ListMatchesDto } from './dto/list-matches.dto.js';
import { MatchesService } from './matches.service.js';

@ApiTags('Matches')
@ApiBearerAuth()
@Controller('me/matches')
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @Get()
  @ApiOperation({ summary: 'Get opportunities matched to the applicant profile' })
  @ApiOkResponse({ description: 'Paginated matches and counts by eligible, partial, and ineligible verdict' })
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListMatchesDto) {
    return this.matches.list(user.id, query);
  }
}
