import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '@provost/common';

@ApiTags('health')
@Controller('health')
export class WorkerHealthController {
  @Public()
  @Get()
  @ApiOperation({ summary: 'Worker liveness check' })
  check(): { status: 'ok'; timestamp: string; service: 'worker' } {
    return { status: 'ok', timestamp: new Date().toISOString(), service: 'worker' };
  }
}
