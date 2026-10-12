-- SDO Portal — DEVELOPMENT / DEMO accounts (manual seed). Run AFTER schema.sql and seed.sql
-- (and after delete.sql when you are starting the demo from a clean slate).
-- Accounts are added manually (SPEC decision 13): there is no "create account" screen in version 1.
--
-- DEV BRANCH ONLY. Never run this on the production branch.
-- Passwords are stored as bcrypt hashes (cost 12, bcryptjs-compatible), never plain text.
-- To make another hash:  node -e "import('bcryptjs').then(async m => console.log(await (m.default ?? m).hash('<password>', 12)))"   (run inside api/)
-- Safe to re-run: existing ids and emails are left untouched.
--
-- The two new accounts and the new staff account share one TEMPORARY password. They are created with
-- must_change_password = true, so the first sign-in forces a new one (the human chose the password: see the
-- hand-over note in CONTEXT.md; it is never written in this file).
--
-- EDIT BEFORE RUNNING the lines marked EDIT: the student ids, and the first names, are placeholders because the
-- request only gave the e-mail addresses. Student ids must look like YYYY-NNNNNNN (7 digits).

-- ---------------------------------------------------------------------------------------------------------
-- Students
-- ---------------------------------------------------------------------------------------------------------

-- Student 1: dagumandjf (unchanged: same id, name and password hash as before).
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

-- Student 2: catolicoasr.
INSERT INTO student_accounts
  (student_id, student_email, first_name, last_name, password_hashed, must_change_password, year_level, program_id, is_active)
SELECT
  '2025-1030809',                                        -- EDIT: the real student id
  'catolicoasr@students.nu-fairview.edu.ph',
  'A. S.',                                               -- EDIT: the real first name
  'Catolico',
  '$2b$12$/fim3kDaZw1rp6pTuvuKIO9cz4rzjmdeRgwLzO6pHO0bp1a8lkBaC',
  true,
  2,                                                     -- EDIT: year level (1 to 6)
  p.program_id,
  true
FROM programs p
WHERE p.program_name = 'BSIT'                            -- EDIT: program name from the programs table
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------------------------------------
-- Staff (SDO officers)
-- ---------------------------------------------------------------------------------------------------------

-- E001: the development officer from before. The password does not meet the app rule (it has no digit), so the
-- account is forced to choose a new one at first sign-in.
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

-- E002: feleoagd, the demo admin. It is a staff account that signs in with a STUDENT-domain address, because the
-- demo uses real student mailboxes. The API looks the address up in both account tables (api/src/auth/service.ts),
-- so it opens the staff portal. Do not also create a student account with this address.
INSERT INTO employee_accounts
  (employee_id, employee_email, first_name, last_name, password_hashed, must_change_password, position, is_active)
VALUES
  ('E002',
   'feleoagd@students.nu-fairview.edu.ph',
   'A. G.',                                              -- EDIT: the real first name
   'Feleo',
   '$2b$12$/fim3kDaZw1rp6pTuvuKIO9cz4rzjmdeRgwLzO6pHO0bp1a8lkBaC',
   true,
   'SDO Officer',
   true)
ON CONFLICT DO NOTHING;
