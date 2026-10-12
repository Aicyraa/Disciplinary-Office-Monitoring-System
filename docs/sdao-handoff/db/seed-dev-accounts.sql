-- SDO Portal — DEVELOPMENT accounts (manual seed). Run AFTER schema.sql and seed.sql.
-- Accounts are added manually (SPEC decision 13): there is no "create account" screen in version 1.
--
-- DEV BRANCH ONLY. Never run this on the production branch.
-- Passwords are stored as bcrypt hashes (cost 12, bcryptjs-compatible), never plain text.
-- To make another hash:  cd api && node -e "import('bcryptjs').then(async m => console.log(await (m.default ?? m).hash('<password>', 12)))"
-- Safe to re-run: existing ids and emails are left untouched.

-- Student: 2nd year BSIT
INSERT INTO student_accounts
  (student_id, student_email, first_name, last_name, password_hashed, must_change_password, year_level, program_id, is_active)
SELECT
  '2025-1030808',
  'dagumandjf@students.nu-fairview.edu.ph',
  'Darlwyn Jee',
  'Daguman',
  '$2b$12$YEA5iLLADfY53mQj/GVctek.sydzkoUFMQT90oWQx0.pb6Nr3ZA.O',
  false,
  2,
  p.program_id,
  true
FROM programs p
WHERE p.program_name = 'BSIT'
ON CONFLICT DO NOTHING;

-- Staff (SDO officer). The password does not meet the app rule (at least one digit), so the
-- account is forced to choose a new one at first sign-in (must_change_password = true).
INSERT INTO employee_accounts
  (employee_id, employee_email, first_name, last_name, password_hashed, must_change_password, position, is_active)
VALUES
  ('E001',
   'loraine@nu-fairview.edu.ph',
   'Loraine',
   'Staff',
   '$2b$12$l2IsjCVVZoAaoieCbhtnv.y3BI8O5DV59KvpQMyQg.5v63ex2IS7y',
   true,
   'SDO Officer',
   true)
ON CONFLICT DO NOTHING;
