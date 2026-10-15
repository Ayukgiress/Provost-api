import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Public } from '@provost/common';
import { ListOpportunitiesDto } from './dto/list-opportunities.dto.js';
import { OpportunitiesService } from './opportunities.service.js';

@ApiTags('Opportunities')
@Controller('opportunities')
export class OpportunitiesController {
  constructor(private readonly opportunities: OpportunitiesService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Search published, unexpired opportunities' })
  @ApiOkResponse({ description: 'Paginated opportunity results; expired listings are excluded' })
  list(@Query() query: ListOpportunitiesDto) { return this.opportunities.list(query); }

  @Public()
  @Get(':slug')
  @ApiOperation({ summary: 'Get a published, unexpired opportunity by slug' })
  @ApiParam({ name: 'slug' })
  get(@Param('slug') slug: string) { return this.opportunities.getBySlug(slug); }
}
