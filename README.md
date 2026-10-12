# Provost API

Backend for **Provost** — a scholarship, fellowship & grant discovery and
application-tracking platform. The API ingests opportunities from scraped
sources, matches them against user profiles, and lets applicants track their
applications.

This is a NestJS monorepo.

## Architecture

```
apps/
  api/        # HTTP API (NestJS) — serves clients, enforces auth, business logic
  worker/     # Background worker (NestJS) — scheduled scraping, AI extraction, reminders
libs/
  common/     # Cross-cutting: Zod-validated config, pino logging, JWT + RBAC guards
  database/   # TypeORM entities, migrations, data source, seed script
  matching/   # Pure profile↔opportunity matching engine (no DB, no Nest)
```

## Tech stack

- **NestJS 12** + TypeScript (strict)
- **PostgreSQL 16** + **TypeORM 1.1** (migrations, never `synchronize`)
- **Supabase Auth** — the API only *verifies* JWTs; it never issues them
- **Zod** for environment validation
- **pino** structured logging with request-id propagation
- **helmet**, **class-validator** global pipes, **@nestjs/throttler** rate limiting
- **Swagger** at `/docs` (dev only)

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (for local Postgres)

## Setup

### 1. Install dependencies

```bash
pnpm install
```

### 2. Start local Postgres

```bash
docker compose up -d
```

This starts PostgreSQL on `localhost:5432` with database `provost` / user
`provost` / password `provost`.

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:

- `DATABASE_URL` — already points at the docker-compose Postgres.
- `SUPABASE_JWT_SECRET` **or** `SUPABASE_JWKS_URL` — required for JWT
  verification. For local development you can use any non-empty secret to
  satisfy the validator; real tokens only verify against the real Supabase
  secret/JWKS.

See `.env.example` for the full list of variables. All variables are validated
with Zod at startup — the app refuses to start on invalid config.

### 4. Run database migrations

```bash
pnpm migration:run
```

### 5. (Optional) Seed sample data

```bash
pnpm seed
```

Inserts 5 funders and 15 realistic (clearly fake) sample opportunities.

### 6. Run the API

```bash
pnpm start:dev          # API on http://localhost:3000
pnpm start:worker:dev   # Worker health on http://localhost:3001
```

Swagger UI is available at http://localhost:3000/docs.

## Commands

| Command | Description |
| --- | --- |
| `pnpm start:dev` | Start the API in watch mode |
| `pnpm start:worker:dev` | Start the worker in watch mode |
| `pnpm build` | Build the API |
| `pnpm build:all` | Build API + worker |
| `pnpm typecheck` | TypeScript type-check |
| `pnpm lint` | Lint with oxlint |
| `pnpm test` | Run unit tests (vitest) |
| `pnpm test:e2e` | Run e2e tests |
| `pnpm migration:generate <name>` | Generate a migration from entity changes |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:revert` | Revert the last migration |
| `pnpm seed` | Run the database seed script |

## Migrations

Migrations live in `libs/database/src/migrations/`. The app **never** runs
migrations — they are applied via the CLI:

```bash
pnpm migration:generate AddColumnFoo   # auto-generate from entity diff
pnpm migration:run                     # apply
pnpm migration:revert                  # rollback the most recent one
```

The database connection is established in the background and does **not** block
app startup. `GET /health` always returns 200 even when Postgres is down.

## Authentication & authorization

- Every route requires a valid Supabase JWT in the `Authorization: Bearer <token>`
  header by default.
- Mark routes public with the `@Public()` decorator (e.g. `/health`).
- Restrict routes to roles with `@Roles(UserRole.Admin)`.
- Roles are read from the JWT `app_metadata.role` claim.
- Access the authenticated user in a handler with `@CurrentUser()`.

## Logging

Structured JSON logging via pino. Each request gets a unique `X-Request-Id`
(generated if not supplied by the client) that is attached to all log lines.
Set `LOG_PRETTY=true` for human-readable output in development.
