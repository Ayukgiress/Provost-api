/**
 * Application roles, sourced from the Supabase JWT `app_metadata.role` claim.
 * Supabase Auth is the source of truth for roles — the API only reads them.
 */
export enum UserRole {
  Applicant = 'applicant',
  Admin = 'admin',
  Reviewer = 'reviewer',
}

/**
 * The authenticated principal attached to a request after JWT verification.
 * `id` is the Supabase user id (`sub` claim).
 */
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email?: string;
}

/**
 * Shape of the Supabase JWT payload we care about.
 * See https://supabase.com/docs/learn/auth-deep-dive/auth-deep-dive-jwts
 */
export interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  app_metadata?: {
    role?: UserRole;
  };
  exp?: number;
  iat?: number;
  aud?: string;
  iss?: string;
}
