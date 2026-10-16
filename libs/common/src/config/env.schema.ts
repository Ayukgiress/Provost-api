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

  // Worker integrations are optional so liveness is independent of vendors.
  SCRAPER_USER_AGENT: z.string().default('ProvostBot/1.0'),
  SCRAPER_CONTACT_EMAIL: z.string().email().default('contact@provost.app'),
  SCRAPER_DOMAIN_DELAY_MS: z.coerce.number().int().nonnegative().default(1500),
  SCRAPER_TIMEOUT_MS: z.coerce.number().int().positive().default(20000),
  TRUSTED_OFFICIAL_DOMAINS: z.string().default('').transform((value) => value.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean)),
  EXTRACTION_PROVIDER: z.enum(['none', 'openai-compatible']).default('none'),
  EXTRACTION_API_KEY: z.string().optional(),
  EXTRACTION_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
  EXTRACTION_MODEL: z.string().default('gpt-4o-mini'),
  // Ollama connectivity is checked per request and never blocks startup.
  ASSISTANT_NAME: z.string().trim().min(1).default('Provost'),
  AI_PROVIDER: z.enum(['ollama']).default('ollama'),
  AI_API_KEY: z.string().optional(),
  AI_BASE_URL: z.string().url().default('http://localhost:11434'),
  AI_MODEL_FAST: z.string().trim().min(1).default('qwen2.5:3b'),
  AI_MODEL_STRONG: z.string().trim().min(1).default('qwen2.5:7b'),
  ASSISTANT_LIMIT_FREE: z.coerce.number().int().nonnegative().default(5),
  ASSISTANT_LIMIT_PLUS: z.coerce.number().int().nonnegative().default(50),
  EMAIL_PROVIDER: z.enum(['none', 'resend']).default('none'),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Provost <updates@provost.app>'),

  // Supabase Auth — the API only verifies JWTs, it never issues them.
  // Either the JWT secret or the JWKS URL must be provided.
  SUPABASE_JWT_SECRET: z.string().optional(),
  SUPABASE_JWKS_URL: z.string().url().optional(),
  SUPABASE_JWT_ISSUER: z.string().optional(),
  // Optional service-role configuration used only for account and file deletion.
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default('documents'),

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
