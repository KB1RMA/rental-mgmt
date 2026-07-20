# rental-mgmt

Personal rental-property bookkeeping app for a rental property Chris owns. TanStack Start (React) on Cloudflare Workers, D1, R2, Better Auth. Deployed at https://rental-mgmt.logbook.am via GitHub Actions CI/CD.

## Critical rules

- **Never write directly to the production D1 database** (no `wrangler d1 execute ... --remote`, ever, for any reason including "quick fixes"). Production changes go through migrations applied by the deploy pipeline, or through the app's own UI/server functions. If production data needs to change, build a migration or an in-app flow — don't run one-off commands against it.
- **Commit incrementally** using Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`), not one big commit per session.
- **No PII in this public repo.** `_docs/` (real lease PDF, real bank exports) is gitignored — never commit its contents, and never copy real names/amounts from it into fixtures or commit messages. `tests/fixtures/*.csv` are already sanitized placeholder examples — follow that pattern for new fixtures.

## Local dev

```
npm run dev                        # vite dev server on :3000
rm -rf .wrangler                   # wipe local D1 (safe, ephemeral, local-only)
npm run db:migrate:local           # apply all migrations
npm run db:seed:example:local      # placeholder property/lease/tenant
npm run db:seed:test-user:local    # e2e-test@example.com / "correct horse battery staple"
```

Real property/lease data lives in `scripts/seed-lease.sql` (gitignored, local-only) — apply with `wrangler d1 execute rental-mgmt-db --local --file=./scripts/seed-lease.sql` if you want real data in local dev. **Never run this file, or anything else, against `--remote`.**

## Testing

- Unit tests: `npm test` (vitest). Pure-function logic (CSV parsing, rules engine, rent ledger math) lives in `src/lib/**/*.test.ts` — prefer this over DB-touching tests where the logic can be isolated.
- E2E: `npm run test:e2e` (Playwright, single worker). **Reset local D1 to a clean state before a real verification run** (see local dev commands above) — state accumulated across many manual test runs in the same session causes flaky failures unrelated to app code.
- Dev-mode server functions occasionally throw a transient "Failed to fetch" on a cold hit (Vite SSR-transforming a heavy module for the first time). See `src/lib/retry-once.ts` — wrap idempotent operations in `retryOnce()` rather than chasing this as an app bug.
- When a UI feature needs verifying against real data, drive it through Playwright/the browser rather than assuming — this project has already caught several real bugs (CI never seeding local D1, a stale cf-typegen step, dark-mode form controls) this way.

## Deploy

Push to `main` → three GitHub Actions workflows run in parallel: lint/typecheck/test, e2e, and deploy. Deploy applies migrations to remote D1 (`wrangler d1 migrations apply DB --remote`) then deploys the Worker. No manual deploy steps — just push and watch `gh run list`.

## Architecture notes

- Single-property app for now (`properties` table has one row). Repositories generally assume `properties.at(0)` is "the" property — don't over-build multi-property UI ahead of need.
- Schema: `src/db/schema.ts` (Drizzle, all tables + relations in one file). Migrations: `migrations/*.sql`, including custom data-only migrations (category taxonomy, categorization rules) generated via `npx drizzle-kit generate --custom`.
- Auth: Better Auth, D1-backed sessions, single admin user (`disableSignUp: true` in `src/lib/auth.ts`). No self-registration — the `/signup` route was removed once the admin account existed.
- CSV import supports two source formats via a dropdown on `/transactions`: a property-manager export (has its own categories) and a raw bank statement export (no categories, relies entirely on the rules engine). See `src/lib/csv/parse.ts` and `parse-bank-statement.ts`.
- Transactions can be split across multiple categories (`transaction_splits` table + inline editor) for lump-sum payments covering more than one thing (e.g. a move-in payment = partial rent + prepaid rent + security deposit).
- Cloudflare binding access: `import { env } from 'cloudflare:workers'` works at module scope for bindings (D1/R2/vars) — this is Cloudflare's canonical pattern, different from generic edge platforms. Don't refactor this to per-request lazy access without a real reason.
