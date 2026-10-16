import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import { CreateReportDto } from './dto/create-report.dto.js';
import { ReportsService } from './reports.service.js';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('opportunities')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post(':id/report')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({ summary: 'Report a problematic opportunity' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiCreatedResponse({
    description:
      'A report; listings are automatically hidden at 3 pending reports',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReportDto,
  ) {
    return this.reports.create(user.id, id, dto);
  }
}
