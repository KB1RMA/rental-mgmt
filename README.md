# rental-mgmt

Personal bookkeeping app for a single rental property: CSV bank-transaction import with rule-based categorization, a reconciled rent ledger, tax-assessment history, and a renewal-decision dashboard (monthly P&L + rent-renewal projections).

Built with TanStack Start (React) on Cloudflare Workers, D1, R2, and Better Auth.

## Local dev

```bash
npm install
npm run dev                        # vite dev server on :3000
npm run db:migrate:local           # apply all migrations
npm run db:seed:example:local      # placeholder property/lease/tenant
npm run db:seed:test-user:local
```

## Testing

```bash
npm test              # vitest unit tests
npm run test:e2e       # Playwright e2e tests
```
