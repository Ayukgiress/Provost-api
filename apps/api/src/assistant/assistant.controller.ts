import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import type { Request, Response } from 'express';
import { AssistantService, AssistantUsageSummary } from './assistant.service.js';
import { ChatAssistantDto } from './dto/chat-assistant.dto.js';
import { ConfirmAssistantActionDto } from './dto/confirm-assistant-action.dto.js';

@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
export class AssistantController {
  constructor(private readonly assistant: AssistantService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Get the signed-in user’s assistant message quota' })
  @ApiResponse({ status: 200, description: 'Returns current usage and limits for the assistant', type: Object })
  getUsage(@CurrentUser() user: AuthenticatedUser): Promise<AssistantUsageSummary> {
    return this.assistant.getUsage(user.id);
  }

  @Post('chat')
  @ApiOperation({ summary: 'Stream an assistant response (Server-Sent Events)' })
  @ApiResponse({ status: 200, description: 'SSE stream of assistant response events' })
  async chat(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChatAssistantDto,
    @Headers('accept-language') acceptLanguage: string | undefined,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    response.status(HttpStatus.OK);
    response.set({ 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    response.flushHeaders();
    const abort = new AbortController();
    // Cleanup SSE connection when client disconnects
    response.on('close', () => abort.abort());
    // Set request timeout to prevent hanging connections
    const timeout = setTimeout(() => abort.abort(), 120000); // 2 minute timeout
    try {
      for await (const event of this.assistant.chat(user.id, dto, acceptLanguage, abort.signal)) {
        if (response.destroyed) break;
        response.write(`event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`);
      }
    } finally {
      clearTimeout(timeout);
      if (!response.destroyed) response.end();
    }
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a pending assistant action' })
  @ApiResponse({ status: 200, description: 'Action confirmed successfully' })
  confirm(@CurrentUser() user: AuthenticatedUser, @Body() dto: ConfirmAssistantActionDto) {
    return this.assistant.confirm(user.id, dto.conversationId, dto.actionId, dto.approve);
  }
}