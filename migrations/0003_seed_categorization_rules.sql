-- Custom SQL migration file, put your code below! --
INSERT INTO categorization_rules (id, priority, field, match_type, pattern, category_id, active) VALUES
  ('00b4876c-9003-4eb0-8730-600ef54dc9a7', 10, 'description', 'contains', 'Ici Fee', '62046bd7-c4f1-4008-a65f-575dc6b398bc', 1),
  ('4ac6a8a1-dd13-4936-b405-c5e88759eaac', 10, 'description', 'contains', 'Safety Deposit', '7ce2eaa8-6672-4274-b957-cd0deabfdb40', 1);
