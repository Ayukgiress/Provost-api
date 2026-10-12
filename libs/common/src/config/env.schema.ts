import { z } from 'zod';

/**
 * Environment variable schema, validated at startup with Zod.
 * Every runtime configuration value is declared here so the app fails fast
 * on misconfiguration instead of silently using undefined values.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  WORKER_PORT: z.coerce.number().int().positive().default(3001),

  // CORS allowlist — comma-separated origins
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((val) => val.split(',').map((o) => o.trim()).filter(Boolean)),

  // PostgreSQL (Supabase-hosted) connection string
  DATABASE_URL: z.string().url().startsWith('postgres'),

  // Supabase Auth — the API only verifies JWTs, it never issues them.
  // Either the JWT secret or the JWKS URL must be provided.
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_JWT_ISSUER: z.string().optional(),

  // Rate limiting
  THROTTLE_TTL: z.coerce.number().int().positive().default(60),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(20),

  // Swagger (disabled in production by default)
  SWAGGER_ENABLED: z
    .string()
    .default('')
    .transform((val) => {
      if (val === '') return undefined;
      return val.toLowerCase() === 'true';
    })
    .pipe(z.boolean().optional()),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_PRETTY: z.coerce.boolean().default(false),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate a raw env object (process.env by default) and return typed config.
 * Throws on validation failure so the app fails fast at startup.
 */
export function validateEnv(raw: Record<string, string | undefined> = process.env): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const messages = parsed.error.issues.map(
      (i) => `  - ${i.path.join('.')}: ${i.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${messages.join('\n')}\n` +
        'Copy .env.example to .env and fill in the required values.',
    );
  }
  return parsed.data;
}
