import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '@provost/common';

@Injectable()
export class SupabaseStorageService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get settings() {
    const url = this.config.get('SUPABASE_URL', { infer: true });
    const key = this.config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
    if (!url || !key) throw new ServiceUnavailableException('Supabase Storage is not configured');
    return { url: url.replace(/\/$/, ''), key };
  }

  private get bucket() {
    return this.config.get('SUPABASE_STORAGE_BUCKET', { infer: true });
  }

  private objectPath(path: string): string {
    return path.split('/').map(encodeURIComponent).join('/');
  }

  private storageUrl(baseUrl: string, signedUrl: string): string {
    if (/^https?:\/\//i.test(signedUrl)) return signedUrl;
    return `${baseUrl}/storage/v1/${signedUrl.replace(/^\/?(?:storage\/v1\/)?/, '')}`;
  }

  async createSignedUploadUrl(path: string): Promise<string> {
    const { url, key } = this.settings;
    const bucketResponse = await fetch(`${url}/storage/v1/bucket/${encodeURIComponent(this.bucket)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public: false,
        file_size_limit: 10 * 1024 * 1024,
        allowed_mime_types: [
          'application/pdf',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
        ],
      }),
    });
    if (!bucketResponse.ok) throw new ServiceUnavailableException('Could not enforce private document bucket limits');
    const response = await fetch(`${url}/storage/v1/object/upload/sign/${encodeURIComponent(this.bucket)}/${this.objectPath(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ upsert: false }),
    });
    if (!response.ok) throw new ServiceUnavailableException('Could not create a signed upload URL');
    const result = await response.json() as { url?: string; signedURL?: string; signedUrl?: string };
    const signedUrl = result.signedURL ?? result.signedUrl ?? result.url;
    if (!signedUrl) throw new ServiceUnavailableException('Supabase returned no signed upload URL');
    return this.storageUrl(url, signedUrl);
  }

  async createSignedDownloadUrl(path: string): Promise<string> {
    const { url, key } = this.settings;
    const response = await fetch(`${url}/storage/v1/object/sign/${encodeURIComponent(this.bucket)}/${this.objectPath(path)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresIn: 300 }),
    });
    if (!response.ok) throw new ServiceUnavailableException('Could not create a signed download URL');
    const result = await response.json() as { signedURL?: string; signedUrl?: string; url?: string };
    const signedUrl = result.signedURL ?? result.signedUrl ?? result.url;
    if (!signedUrl) throw new ServiceUnavailableException('Supabase returned no signed download URL');
    return this.storageUrl(url, signedUrl);
  }

  async readObject(path: string): Promise<Buffer> {
    const { url, key } = this.settings;
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(this.bucket)}/${this.objectPath(path)}`, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new ServiceUnavailableException('Could not read the uploaded document');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > 10 * 1024 * 1024) throw new ServiceUnavailableException('Uploaded document exceeds the 10 MB limit');
    return bytes;
  }

  async deleteObjects(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    const { url, key } = this.settings;
    const response = await fetch(`${url}/storage/v1/object/${encodeURIComponent(this.bucket)}`, {
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
