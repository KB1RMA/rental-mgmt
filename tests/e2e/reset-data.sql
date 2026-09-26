-- Run against the LOCAL D1 before every e2e test (see fixtures.ts) so each
-- test starts from the same baseline: migrations + seed-lease.example.sql +
-- seed-test-user.sql, with none of the rows earlier tests (or earlier
-- attempts of the same test, on a CI retry) created.
--
-- Clears every table the app writes to at runtime. Leaves alone what
-- migrations and the seed scripts own (categories, categorization rules,
-- property/unit/tenant/lease, the test user and its sessions).
-- When adding a table the app writes to, add it here too — children before
-- parents, since D1 enforces foreign keys.
DELETE FROM rent_payments;
DELETE FROM rent_charges;
DELETE FROM transaction_splits;
DELETE FROM transactions;
DELETE FROM documents;
DELETE FROM tax_assessments;
DELETE FROM renewal_assumptions;
DELETE FROM comparable_rents;
DELETE FROM plaid_accounts;
DELETE FROM plaid_items;
