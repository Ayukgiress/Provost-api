# Architecture

Provost is a TypeScript/NestJS monorepo with two runtime applications and three
shared libraries:

- `apps/api` is the authenticated HTTP API. Supabase issues JWTs; the API
  verifies them and reads roles from the signed `app_metadata.role` claim.
- `apps/worker` runs background scraping, extraction, and notification jobs.
- `libs/common` contains validated configuration, request IDs, safe structured
  logging, authentication, and role guards.
- `libs/database` owns TypeORM entities and explicit PostgreSQL migrations.
- `libs/matching` contains the profile/opportunity matching logic.

## Request security

JWT authentication and role checks are global. Only explicitly marked public
routes bypass JWT verification. Applicants never choose a user ID: `/me` route
handlers pass the verified JWT subject to services, and tenant-owned queries
include that subject in their database predicates. Admin endpoints declare
admin/reviewer roles at the controller or handler. Sensitive write operations
have tighter per-route throttles than the global limit.

## Persistence and jobs

PostgreSQL is the system of record. `synchronize` remains disabled; schema
changes are committed as TypeORM migrations and applied separately from app
startup. Scraping is performed by the worker and uses persisted source,
snapshot, scrape-run, and review-item records before admins publish opportunities.

## Observability

Each request receives a validated or generated `X-Request-Id`. Completion logs
contain only request ID, HTTP method, matched route template, status, and
duration. Request/response bodies, query strings, cookies, authorization
headers, IP addresses, and exception messages/stacks are deliberately omitted.
