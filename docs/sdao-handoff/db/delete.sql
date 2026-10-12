-- SDO Portal: wipe the DATA CREATED WHILE TESTING (development branch only).
--
-- DEV BRANCH ONLY. Never run this on the production branch. It deletes people, cases, files and history.
-- Run it yourself (agents never run it): Neon console SQL editor on the development branch, or
--   psql "$DATABASE_URL_UNPOOLED" -f docs/sdao-handoff/db/delete.sql
-- Then run seed-dev-accounts.sql, otherwise nobody can sign in.
--
-- DELETED (everything the app writes while it is used):
--   student_accounts, employee_accounts            (so the demo accounts can be seeded again)
--   disciplinary_cases, case_escalations, case_status_history
--   case_sanctions, case_sanction_files, case_sanction_history
--   appointments, appointment_history
--   clearances, clearance_requirements, clearance_history, and custom requirements (is_default = false)
--   notifications, files and sanction_template_files (file rows only), the login `session` table
--
-- KEPT (the reference data the app needs; never touched):
--   programs, violations, handbook_entries, handbook_entry_sanctions, sanctions,
--   requirements where is_default = true, sanction_templates (the text; its `updated_by` is cleared)
--   Violations or handbook edits made while testing are kept too: they cannot be told apart from real ones.
--
-- NOT TOUCHED BY SQL: the objects in the storage buckets (proof files, template files). Their rows are gone, so
-- they are orphans: empty the buckets in the Neon console if you want the space back.
--
-- Numbering starts again from 1 for every emptied table (cases, sanctions, appointments, clearances,
-- notifications, files), so a fresh demo shows C001 / SDO-yyyy-001 again.

BEGIN;

-- Children first, so every foreign key is satisfied.
DELETE FROM notifications;
DELETE FROM clearance_history;
DELETE FROM clearance_requirements;
DELETE FROM clearances;
DELETE FROM appointment_history;
DELETE FROM appointments;
DELETE FROM case_sanction_history;
DELETE FROM case_sanction_files;
DELETE FROM case_sanctions;
DELETE FROM case_escalations;
DELETE FROM case_status_history;
DELETE FROM disciplinary_cases;
DELETE FROM sanction_template_files;
DELETE FROM files;

-- Custom checklist items staff added for one student; the four standard ones stay.
DELETE FROM requirements WHERE is_default = false;

-- Template text stays; only who last edited it (an employee about to be deleted) is cleared.
UPDATE sanction_templates SET updated_by_employee_id = NULL;

-- People last.
DELETE FROM student_accounts;
DELETE FROM employee_accounts;

-- connect-pg-simple's table (created by the API at first start); sessions point at deleted accounts.
DO $$
BEGIN
  IF to_regclass('public.session') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.session';
  END IF;
END
$$;

-- Start the counters of the emptied tables again.
ALTER TABLE notifications           ALTER COLUMN notification_id          RESTART WITH 1;
ALTER TABLE clearance_history       ALTER COLUMN clearance_history_id     RESTART WITH 1;
ALTER TABLE clearance_requirements  ALTER COLUMN clearance_requirement_id RESTART WITH 1;
ALTER TABLE clearances              ALTER COLUMN clearance_id             RESTART WITH 1;
ALTER TABLE appointment_history     ALTER COLUMN appointment_history_id   RESTART WITH 1;
ALTER TABLE appointments            ALTER COLUMN appointment_id           RESTART WITH 1;
ALTER TABLE case_sanction_history   ALTER COLUMN case_sanction_history_id RESTART WITH 1;
ALTER TABLE case_sanction_files     ALTER COLUMN case_sanction_file_id    RESTART WITH 1;
ALTER TABLE case_sanctions          ALTER COLUMN case_sanction_id         RESTART WITH 1;
ALTER TABLE case_escalations        ALTER COLUMN case_escalation_id       RESTART WITH 1;
ALTER TABLE case_status_history     ALTER COLUMN history_id               RESTART WITH 1;
ALTER TABLE disciplinary_cases      ALTER COLUMN disciplinary_case_id     RESTART WITH 1;
ALTER TABLE files                   ALTER COLUMN file_id                  RESTART WITH 1;

COMMIT;

-- Check: the emptied tables read 0, the kept tables keep their rows.
SELECT 'student_accounts' AS table_name, count(*) AS rows FROM student_accounts
UNION ALL SELECT 'employee_accounts', count(*) FROM employee_accounts
UNION ALL SELECT 'disciplinary_cases', count(*) FROM disciplinary_cases
UNION ALL SELECT 'notifications', count(*) FROM notifications
UNION ALL SELECT 'files', count(*) FROM files
UNION ALL SELECT 'violations (kept)', count(*) FROM violations
UNION ALL SELECT 'handbook_entries (kept)', count(*) FROM handbook_entries
UNION ALL SELECT 'sanctions (kept)', count(*) FROM sanctions
UNION ALL SELECT 'requirements (kept, 4 standard)', count(*) FROM requirements
UNION ALL SELECT 'programs (kept)', count(*) FROM programs;
