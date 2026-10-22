import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { createHmac, createVerify, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { JwksClient } from 'jwks-rsa';
import { UserRole, type AuthenticatedUser, type SupabaseJwtPayload } from '../types/index.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

/**
 * Verifies Supabase-issued JWTs. The API never issues tokens — Supabase Auth
 * does. This guard only verifies the signature and extracts the principal.
 *
 * Verification strategy follows the token's declared algorithm:
 *   - ES256 uses the asymmetric public key fetched from Supabase JWKS.
 *   - HS256 uses the configured legacy shared secret during key migrations.
 *
 * The guard never blocks application startup; JWKS keys are fetched and
 * cached lazily on the first authenticated request.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);
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
    // Supabase legacy HS256 tokens use `iss: "supabase"`; newer asymmetric
    // tokens use the project URL as issuer. Accept both only after signature
    // verification with the matching algorithm/key source.
    const acceptedIssuers = issuer ? [issuer, 'supabase'] : ['supabase'];
    let algorithm = 'unknown';

    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new UnauthorizedException('Malformed authentication token');

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as {
        alg?: string;
        kid?: string;
      };
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as SupabaseJwtPayload;
      algorithm = header.alg ?? 'unknown';
      const signedContent = `${parts[0]}.${parts[1]}`;
      const signature = Buffer.from(parts[2], 'base64url');

      let signatureValid = false;
      if (algorithm === 'ES256' && this.jwksClient && header.kid) {
        const signingKey = await this.jwksClient.getSigningKey(header.kid);
        const verifier = createVerify('SHA256');
        verifier.update(signedContent);
        verifier.end();
        // JWT ES256 signatures use IEEE-P1363 (r||s), unlike ASN.1 DER.
        signatureValid = verifier.verify(
          { key: signingKey.getPublicKey(), dsaEncoding: 'ieee-p1363' },
          signature,
        );
      } else if (algorithm === 'HS256' && secret) {
        const expectedSignature = createHmac('sha256', secret)
          .update(signedContent)
          .digest();
        signatureValid = signature.length === expectedSignature.length &&
          timingSafeEqual(signature, expectedSignature);
      } else {
        throw new UnauthorizedException(`JWT verification is not configured for ${algorithm} tokens`);
      }

      if (!signatureValid) throw new UnauthorizedException('Invalid authentication signature');

      const now = Math.floor(Date.now() / 1000);
      const validIssuer = typeof payload.iss === 'string' && acceptedIssuers.includes(payload.iss);
      const validAudience = payload.aud === 'authenticated' ||
        (Array.isArray(payload.aud) && payload.aud.includes('authenticated'));
      if (!validIssuer || !validAudience || typeof payload.sub !== 'string' || !payload.sub ||
          typeof payload.exp !== 'number' || payload.exp <= now ||
          (typeof (payload as SupabaseJwtPayload & { nbf?: number }).nbf === 'number' &&
            (payload as SupabaseJwtPayload & { nbf: number }).nbf > now)) {
        throw new UnauthorizedException('Invalid or expired authentication claims');
      }

      return payload;
    } catch (error) {
      this.logger.warn(
        `JWT verification failed (algorithm=${String(algorithm)}): ${error instanceof Error ? error.message : 'unknown verification error'}`,
      );
      throw new UnauthorizedException('Invalid or expired authentication token');
    }
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
