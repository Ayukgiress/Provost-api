import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { JwksClient } from 'jwks-rsa';
import { UserRole, type AuthenticatedUser, type SupabaseJwtPayload } from '../types/index.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Verifies Supabase-issued JWTs. The API never issues tokens — Supabase Auth
 * does. This guard only verifies the signature and extracts the principal.
 *
 * Verification strategy:
 *   - If `SUPABASE_JWT_SECRET` is set, verify with the shared secret (HS256).
 *   - Else if `SUPABASE_JWKS_URL` is set, fetch the public key from JWKS (RS256).
 *
 * The guard never blocks application startup; JWKS keys are fetched and
 * cached lazily on the first authenticated request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private jwksClient: JwksClient | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {
    const jwksUrl = this.config.get<string>('SUPABASE_JWKS_URL');
    if (jwksUrl) {
      this.jwksClient = new JwksClient({ jwksUri: jwksUrl, cache: true });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Allow routes marked @Public() to bypass authentication.
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    const payload = await this.verify(token);
    const user = this.toAuthenticatedUser(payload);
    // Attach the principal so @CurrentUser() can read it.
    (request as Request & { user: AuthenticatedUser }).user = user;
    return true;
  }

  private extractToken(request: Request): string | null {
    const header = request.headers.authorization;
    if (!header) return null;
    const [scheme, token] = header.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
    return token;
  }

  private async verify(token: string): Promise<SupabaseJwtPayload> {
    const secret = this.config.get<string>('SUPABASE_JWT_SECRET');
    const issuer = this.config.get<string>('SUPABASE_JWT_ISSUER');

    try {
      if (secret) {
        return jwt.verify(token, secret, {
          issuer,
        }) as SupabaseJwtPayload;
      }

      if (this.jwksClient) {
        const key = await this.getSigningKey(token);
        return jwt.verify(token, key, {
          issuer,
        }) as SupabaseJwtPayload;
      }

      throw new UnauthorizedException(
        'JWT verification is not configured: set SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL',
      );
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
  }

  private async getSigningKey(token: string): Promise<string> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded.header.kid !== 'string') {
      throw new UnauthorizedException('Malformed token header');
    }
    const key = await this.jwksClient!.getSigningKey(decoded.header.kid);
    return key.getPublicKey();
  }

  private toAuthenticatedUser(payload: SupabaseJwtPayload): AuthenticatedUser {
    const role = payload.app_metadata?.role ?? UserRole.Applicant;
    return {
      id: payload.sub,
      role,
      email: payload.email,
    };
  }
}
