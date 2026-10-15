import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@provost/common';

@Injectable()
export class SupabaseStorageService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get settings() {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const key = this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
    if (!url || !key) throw new ServiceUnavailableException('Account deletion requires Supabase service-role configuration');
    return { url: url.replace(/\/$/, ''), key };
  }

  async deleteObjects(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { url, key } = this.settings;
    const bucket = this.config.get('SUPABASE_STORAGE_BUCKET', { infer: true });
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: paths }),
    });
    if (!response.ok) throw new ServiceUnavailableException('Could not remove stored user files');
  }

  async deleteAuthUser(userId: string): Promise<void> {
    const { url, key } = this.settings;
    const response = await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE', headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    if (!response.ok && response.status !== 404) throw new ServiceUnavailableException('Could not delete Supabase user account');
  }
}
