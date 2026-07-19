-- Custom SQL migration file, put your code below! --
-- Broaden the existing bank-fee rule to also catch "POS Purchase Non-PIN
-- ICI*FEE" (raw bank export), not just "Ici Fee ..." (property-manager export).
UPDATE categorization_rules SET pattern = 'ICI' WHERE id = '00b4876c-9003-4eb0-8730-600ef54dc9a7';

INSERT INTO categories (id, name, type, schedule_e_line) VALUES
  ('186e2ddc-3972-459f-8942-5a80f82425f6', 'Ignore', 'ignore', NULL);

INSERT INTO categorization_rules (id, priority, field, match_type, pattern, category_id, active) VALUES
  ('2f917d4f-3e2b-4c68-a633-25ed8d8309fe', 10, 'description', 'contains', 'WF HOME MTG', 'a4ba3ac4-483e-4bfe-9c5f-f98d24e37173', 1),
  ('86cb6796-07f5-41d4-ac8d-f5f266996132', 10, 'description', 'contains', 'Acct-to-Acct Transfer CITY OF', '8b564b98-0bf2-470f-8a79-080b375bd4d8', 1),
  ('0862e8c8-9836-46f8-b146-6e08ef1ff159', 10, 'description', 'contains', 'Insufficient Funds Fee', '62046bd7-c4f1-4008-a65f-575dc6b398bc', 1),
  ('566018db-6784-4a47-acd6-9d97834b63a6', 10, 'description', 'contains', 'Overdraft Fee', '62046bd7-c4f1-4008-a65f-575dc6b398bc', 1),
  ('bf5da1c6-4c18-410f-859f-00cd289e34c3', 10, 'description', 'contains', 'INFOSN CK WEBXFR/TRANSFER', '62046bd7-c4f1-4008-a65f-575dc6b398bc', 1),
  ('9afa67df-2744-4035-86f5-4dfa628ddb61', 10, 'description', 'contains', 'Remote Deposit', '93acc0fa-85cc-4300-8f43-f3755da69e2b', 1),
  ('f4703651-fa00-4447-9a15-2d2b78e738d1', 10, 'description', 'contains', 'ACCTVERIFY', '186e2ddc-3972-459f-8942-5a80f82425f6', 1);
