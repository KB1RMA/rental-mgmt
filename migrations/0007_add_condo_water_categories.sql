-- Custom SQL migration file, put your code below! --
-- No dedicated Schedule E line for condo/HOA fees; report under line 19 "Other".
-- Water & Sewer stays on the "utilities" Schedule E line, just split out from
-- the generic Utilities category for more specific tracking.
INSERT INTO categories (id, name, type, schedule_e_line) VALUES
  ('717f4618-3795-47e2-87d7-fe5b417413b0', 'Condo Fees', 'expense', 'other'),
  ('03146f5d-dee7-42db-ae5e-bd7b1d514eb8', 'Water & Sewer', 'expense', 'utilities');