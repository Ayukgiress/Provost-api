import { Controller, Delete, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, type AuthenticatedUser } from '@provost/common';
import { AccountService } from './account.service.js';

@ApiTags('Account')
@ApiBearerAuth()
@Controller('me')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Delete()
  @Throttle({ default: { limit: 2, ttl: 60_000 } })
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Permanently delete the applicant account, personal data, and stored files',
  })
  @ApiNoContentResponse({ description: 'Account deleted' })
  async delete(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.accounts.delete(user.id);
  }
}
