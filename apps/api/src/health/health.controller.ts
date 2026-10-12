import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@provost/common';

@ApiTags('health')
@Controller('health')
export class HealthController {
  /**
   * Liveness probe. Always returns 200 — the app must remain reachable
   * even if the database or other third-party services are down.
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness check' })
  check(): { status: 'ok'; timestamp: string } {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
