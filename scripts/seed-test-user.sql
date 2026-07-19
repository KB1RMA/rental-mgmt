INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
VALUES (
  '948e3bd9-e1de-4490-b0f0-82899dca6d3e',
  'E2E Test',
  'e2e-test@example.com',
  1,
  unixepoch(),
  unixepoch()
);

INSERT INTO account (
  id, account_id, provider_id, user_id, password, created_at, updated_at
) VALUES (
  '6fc07427-d6ad-418e-a9b3-c232aea734c8',
  '948e3bd9-e1de-4490-b0f0-82899dca6d3e',
  'credential',
  '948e3bd9-e1de-4490-b0f0-82899dca6d3e',
  '1f520ef59e2fd10634ee3ee198f772f5:45e858efbcc7671f227c07e6b1765b8c24f6a58e1c011900af0da4ff749e9f23f3c9f93db0eeac6dbb4b31722801bbb29214365cb53b0e76ff9de98553244084',
  unixepoch(),
  unixepoch()
);
