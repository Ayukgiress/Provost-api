import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, Roles, UserRole, type AuthenticatedUser } from '@provost/common';
import {
  AdminListDto,
  AdminReportListDto,
  CreateOpportunityDto,
  CreateSourceDto,
  OpportunityFieldsDto,
  ResolveReportDto,
  ReviewMoreInfoDto,
  ReviewQueueListDto,
  ReviewRejectDto,
  UpdateSourceDto,
} from './dto/admin.dto.js';
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@Roles(UserRole.Admin)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('dashboard')
  dashboard() { return this.admin.dashboard(); }

  @Get('review-queue')
  @Roles(UserRole.Admin, UserRole.Reviewer)
  listReviewQueue(@Query() query: ReviewQueueListDto) { return this.admin.listReviewQueue(query); }

  @Get('review-queue/:id')
  @Roles(UserRole.Admin, UserRole.Reviewer)
  getReviewItem(@Param('id', ParseUUIDPipe) id: string) { return this.admin.getReviewItem(id); }

  @Post('review-queue/:id/approve')
  @Roles(UserRole.Admin, UserRole.Reviewer)
  approveReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() fields?: OpportunityFieldsDto,
  ) { return this.admin.approveReview(id, user.id, user.role === UserRole.Admin, fields); }

  @Post('review-queue/:id/publish')
  publishApprovedReview(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.publishApprovedReview(id, user.id);
  }

  @Post('review-queue/:id/reject')
  @Roles(UserRole.Admin, UserRole.Reviewer)
  rejectReview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewRejectDto,
  ) { return this.admin.rejectReview(id, user.id, dto); }

  @Post('review-queue/:id/request-more-info')
  @Roles(UserRole.Admin, UserRole.Reviewer)
  requestMoreInfo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewMoreInfoDto,
  ) { return this.admin.requestMoreInfo(id, user.id, dto); }

  @Post('opportunities')
  createOpportunity(@Body() dto: CreateOpportunityDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createOpportunity(dto, user.id);
  }

  @Patch('opportunities/:id')
  editOpportunity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OpportunityFieldsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.admin.editOpportunity(id, dto, user.id); }

  @Post('opportunities/:id/unpublish')
  unpublishOpportunity(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.unpublishOpportunity(id, user.id);
  }

  @Get('sources')
  listSources(@Query() query: AdminListDto) { return this.admin.listSources(query); }

  @Post('sources')
  createSource(@Body() dto: CreateSourceDto, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.createSource(dto, user.id);
  }

  @Patch('sources/:id')
  updateSource(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSourceDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.admin.updateSource(id, dto, user.id); }

  @Post('sources/:id/run-now')
  @HttpCode(202)
  runSourceNow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.admin.runSourceNow(id, user.id);
  }

  @Get('sources/:id/scrape-runs')
  listScrapeRuns(@Param('id', ParseUUIDPipe) id: string, @Query() query: AdminListDto) {
    return this.admin.listScrapeRuns(id, query);
  }

  @Get('reports')
  listReports(@Query() query: AdminReportListDto) { return this.admin.listReports(query); }

  @Patch('reports/:id/resolve')
  resolveReport(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() user: AuthenticatedUser,
  ) { return this.admin.resolveReport(id, dto, user.id); }
}