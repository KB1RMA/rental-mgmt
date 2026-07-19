INSERT INTO properties (id, name, address_line1, city, state, zip, notes, created_at)
VALUES (
  '27b9f5c1-22da-4fcb-85d1-8a9d90b6e324',
  'Example Property',
  '123 Example Street',
  'Sampletown',
  'MA',
  '00000',
  'Placeholder property for local dev and CI.',
  unixepoch()
);

INSERT INTO units (id, property_id, label, created_at)
VALUES (
  '2f4ee199-a86b-4099-b9f9-66ea5a1c5cc1',
  '27b9f5c1-22da-4fcb-85d1-8a9d90b6e324',
  'Main',
  unixepoch()
);

INSERT INTO tenants (id, name, email, phone, created_at)
VALUES (
  '4320b830-b1eb-49bb-99d3-2e543bdc86bd',
  'Jordan Tenant',
  'tenant@example.com',
  '555-0100',
  unixepoch()
);

INSERT INTO leases (
  id, unit_id, start_date, end_date, rent_cents, rent_due_day,
  late_fee_cents, late_fee_grace_days, security_deposit_cents, notice_days,
  status, created_at
) VALUES (
  '82bfc4b2-103a-49f8-b685-cb74f383b90a',
  '2f4ee199-a86b-4099-b9f9-66ea5a1c5cc1',
  '2025-11-15',
  '2026-11-30',
  295000,
  1,
  15000,
  30,
  295000,
  60,
  'active',
  unixepoch()
);

INSERT INTO lease_tenants (lease_id, tenant_id)
VALUES (
  '82bfc4b2-103a-49f8-b685-cb74f383b90a',
  '4320b830-b1eb-49bb-99d3-2e543bdc86bd'
);
