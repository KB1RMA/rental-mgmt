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

## Phase tracking

Original plan: `/Users/chris/.claude/plans/i-want-to-build-prancy-quail.md` (may be stale on specifics — the list below reflects actual status; check task list via TaskList for anything more current).

- ✅ Phase 1: Scaffold, auth, CI/CD
- ✅ Phase 2: Domain schema, lease/documents
- ✅ Phase 3: CSV import, categorization, rent ledger (+ bank-statement format and transaction splits added afterward, not in the original plan)
- ⏳ Phase 4: Plaid sync via cron — not started
- ✅ Phase 5: Assessor data (amended — see below)
- ✅ Phase 6: Renewal decision dashboard (see below)

### Phase 5 (assessor data) — amended approach

Original plan called for server-side scraping (HTMLRewriter, R2 archive, cron). Amended: **no deployed scraping**. Instead:

- `scripts/scrape-assessor.mjs` (`npm run scrape:assessor`) fetches the assessor (Vision Government Solutions, `gis.vgsi.com/<town>`) parcel page locally, using `ASSESSOR_PID` and `ASSESSOR_TOWN` from `.env` (gitignored — never hardcode the parcel id, town, or address in committed files), and writes raw HTML + a `tax-assessments.csv` into gitignored `_docs/`.
- The app has a `/tax-assessments` page: CSV import (upserts on the `(propertyId, fiscalYear)` unique key — re-uploading the same file is idempotent), a manual-entry/correction form, and a history table with per-row delete. See `src/lib/csv/parse-tax-assessments.ts`, `src/lib/tax-assessments.functions.ts`, `src/db/repositories/tax-assessments.ts`.
- To get real data into production: run the scrape script locally, then upload the resulting `_docs/tax-assessments.csv` through the deployed `/tax-assessments` UI by hand. Nothing scraped ever touches git or gets written directly to the DB.
- `rawDocumentId`/`scrapedAt` columns on `tax_assessments` are unused by this flow (raw HTML lives in local `_docs/`, not R2) — left null.

### Phase 6 (renewal decision dashboard)

- `/renewal` shows a monthly P&L since the active lease's start (income vs expenses, classified via `categories.type`/`scheduleELine`, not transaction sign) and an editable, persisted rent-renewal projection. Pure math in `src/lib/profit/monthly-pnl.ts` and `projection.ts`; orchestration in `src/lib/renewal.functions.ts`.
- Two views, toggled client-side: **cash flow** (every dollar out, including the full mortgage payment) and **operating** (excludes an editable monthly mortgage-principal estimate). The mortgage payment is categorized as one lump `Mortgage Interest`/`mortgage_interest` transaction that already includes the escrowed property tax — `tax_assessments.annualTaxCents` is shown as informational context only and is never added as a separate expense (would double-count).
- Projection assumptions (`proposedRentCents`, `monthlyPrincipalCents`, optional `monthlyExpenseOverrideCents`, `notes`) persist in the new `renewal_assumptions` table, one row per property, upserted like `tax_assessments`. Left blank, the expense assumption seeds from the trailing-12-month actuals average (excluding the current in-progress month).
- Chart: Recharts (`src/components/monthly-pnl-chart.tsx`), rendered inside `ClientOnly` since it needs the DOM to measure itself. Colors follow the dataviz skill's validated categorical palette, not ad hoc hex values.
