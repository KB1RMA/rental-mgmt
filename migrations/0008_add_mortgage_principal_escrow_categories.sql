-- Custom SQL migration file, put your code below! --
-- Splits the lump "Mortgage Interest" category into its real components so a
-- mortgage payment can be split (via transaction_splits) into Principal
-- (equity paydown, not a deductible expense), Interest (kept on the existing
-- Mortgage Interest category/Schedule E line), and Escrow (funds the
-- property-tax bill, grouped under the "taxes" Schedule E line).
INSERT INTO categories (id, name, type, schedule_e_line) VALUES
  ('7ec5ada1-c564-4c14-a3de-d6cd08e15601', 'Mortgage Principal', 'equity', NULL),
  ('f4c15b62-11ee-4dd6-aee3-9694e7e90d58', 'Mortgage Escrow', 'expense', 'taxes');
