-- Restore the rules that live only in SQL (CHECK, the appointment overlap EXCLUDE, the gate de-dupe index)
-- and add the foreign-key indexes from PERFORMANCE-SPEC D4.
-- Source of the rules: docs/sdao-handoff/db/schema.sql as of commit a665f9e^ (the last version in git).
-- Why: on 2026-10-16 the development branch had none of these (only PK, FK, NOT NULL and plain indexes),
-- most likely because it was built from the Prisma schema, which cannot express them.
--
-- Safe to run more than once: every constraint is dropped first if it exists, every index uses IF NOT EXISTS.
-- All or nothing: one transaction. If any existing row breaks a rule, the whole script stops and nothing changes;
-- run docs/db-preflight.sql to see which rule and fix that data first.
-- Run on the development branch first, then production. Never through `prisma db push`.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- needed by the appointment overlap constraint

-- 1. Accounts and handbook -----------------------------------------------------------------------------------
ALTER TABLE student_accounts DROP CONSTRAINT IF EXISTS student_accounts_year_level_check;
ALTER TABLE student_accounts ADD CONSTRAINT student_accounts_year_level_check CHECK (year_level BETWEEN 1 AND 6);

ALTER TABLE violations DROP CONSTRAINT IF EXISTS violations_severity_check;
ALTER TABLE violations ADD CONSTRAINT violations_severity_check CHECK (severity IN ('Minor','Major'));

ALTER TABLE handbook_entry_sanctions DROP CONSTRAINT IF EXISTS handbook_entry_sanctions_offense_number_check;
ALTER TABLE handbook_entry_sanctions ADD CONSTRAINT handbook_entry_sanctions_offense_number_check CHECK (offense_number >= 1);

-- 2. Files ---------------------------------------------------------------------------------------------------
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_mime_type_check;
ALTER TABLE files ADD CONSTRAINT files_mime_type_check CHECK (mime_type IN (
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'));
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_size_bytes_check;
ALTER TABLE files ADD CONSTRAINT files_size_bytes_check CHECK (size_bytes > 0 AND size_bytes <= 10485760);
ALTER TABLE files DROP CONSTRAINT IF EXISTS files_one_uploader_check;
ALTER TABLE files ADD CONSTRAINT files_one_uploader_check CHECK (num_nonnulls(uploaded_by_student_id, uploaded_by_employee_id) = 1);

-- 3. Cases ---------------------------------------------------------------------------------------------------
ALTER TABLE disciplinary_cases DROP CONSTRAINT IF EXISTS disciplinary_cases_source_check;
ALTER TABLE disciplinary_cases ADD CONSTRAINT disciplinary_cases_source_check CHECK (source IN ('gate','staff'));
ALTER TABLE disciplinary_cases DROP CONSTRAINT IF EXISTS disciplinary_cases_status_check;
ALTER TABLE disciplinary_cases ADD CONSTRAINT disciplinary_cases_status_check
  CHECK (status IN ('reported','validated','for_sanction','resolved','rejected'));
ALTER TABLE disciplinary_cases DROP CONSTRAINT IF EXISTS disciplinary_cases_student_required_check;
ALTER TABLE disciplinary_cases ADD CONSTRAINT disciplinary_cases_student_required_check
  CHECK (student_id IS NOT NULL OR status IN ('reported','rejected'));
ALTER TABLE disciplinary_cases DROP CONSTRAINT IF EXISTS disciplinary_cases_source_fields_check;
ALTER TABLE disciplinary_cases ADD CONSTRAINT disciplinary_cases_source_fields_check
  CHECK ((source = 'gate'  AND claimed_student_id IS NOT NULL AND claimed_name IS NOT NULL)
      OR (source = 'staff' AND reported_by_employee_id IS NOT NULL));
-- duplicate guard for gate reports: same ID + same violation + same Manila day
CREATE UNIQUE INDEX IF NOT EXISTS ux_cases_gate_dedupe ON disciplinary_cases
  (claimed_student_id, handbook_entry_id, ((case_date AT TIME ZONE 'Asia/Manila')::date))
  WHERE source = 'gate';

ALTER TABLE case_escalations DROP CONSTRAINT IF EXISTS case_escalations_not_self_check;
ALTER TABLE case_escalations ADD CONSTRAINT case_escalations_not_self_check CHECK (major_case_id <> minor_case_id);

ALTER TABLE case_status_history DROP CONSTRAINT IF EXISTS case_status_history_event_type_check;
ALTER TABLE case_status_history ADD CONSTRAINT case_status_history_event_type_check CHECK (event_type IN
  ('reported','validated','rejected','remark','sanction_assigned','escalated','flagged_escalated','resolved'));
ALTER TABLE case_status_history DROP CONSTRAINT IF EXISTS case_status_history_status_after_check;
ALTER TABLE case_status_history ADD CONSTRAINT case_status_history_status_after_check
  CHECK (status_after IN ('reported','validated','for_sanction','resolved','rejected'));

-- 4. Sanctions on cases --------------------------------------------------------------------------------------
ALTER TABLE case_sanctions DROP CONSTRAINT IF EXISTS case_sanctions_status_check;
ALTER TABLE case_sanctions ADD CONSTRAINT case_sanctions_status_check
  CHECK (status IN ('assigned','pending_verification','returned','completed'));
ALTER TABLE case_sanctions DROP CONSTRAINT IF EXISTS case_sanctions_completed_check;
ALTER TABLE case_sanctions ADD CONSTRAINT case_sanctions_completed_check
  CHECK (status <> 'completed' OR (date_completed IS NOT NULL AND verified_by_employee_id IS NOT NULL));

ALTER TABLE case_sanction_history DROP CONSTRAINT IF EXISTS case_sanction_history_event_type_check;
ALTER TABLE case_sanction_history ADD CONSTRAINT case_sanction_history_event_type_check CHECK (event_type IN
  ('assigned','proof_uploaded','proof_replaced','proof_removed','compliance_recorded','returned','verified'));
ALTER TABLE case_sanction_history DROP CONSTRAINT IF EXISTS case_sanction_history_one_actor_check;
ALTER TABLE case_sanction_history ADD CONSTRAINT case_sanction_history_one_actor_check
  CHECK (num_nonnulls(employee_id, student_id) = 1);

-- 5. Appointments --------------------------------------------------------------------------------------------
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('scheduled','rescheduled','completed','cancelled'));
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_dates_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_dates_check CHECK (end_date >= start_date);
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_not_sunday_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_not_sunday_check CHECK (EXTRACT(dow FROM start_date) <> 0);
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_cancel_reason_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_cancel_reason_check
  CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL);
-- a student cannot have two live appointments whose windows overlap
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_no_overlap;
ALTER TABLE appointments ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (student_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
  WHERE (status IN ('scheduled','rescheduled'));

ALTER TABLE appointment_history DROP CONSTRAINT IF EXISTS appointment_history_event_type_check;
ALTER TABLE appointment_history ADD CONSTRAINT appointment_history_event_type_check
  CHECK (event_type IN ('assigned','rescheduled','remarks_updated','completed','cancelled'));

-- 6. Clearance -----------------------------------------------------------------------------------------------
ALTER TABLE clearances DROP CONSTRAINT IF EXISTS clearances_semester_check;
ALTER TABLE clearances ADD CONSTRAINT clearances_semester_check CHECK (semester BETWEEN 1 AND 3);
ALTER TABLE clearances DROP CONSTRAINT IF EXISTS clearances_status_check;
ALTER TABLE clearances ADD CONSTRAINT clearances_status_check CHECK (status IN ('pending','cleared'));

ALTER TABLE clearance_requirements DROP CONSTRAINT IF EXISTS clearance_requirements_status_check;
ALTER TABLE clearance_requirements ADD CONSTRAINT clearance_requirements_status_check CHECK (status IN ('pending','completed'));

ALTER TABLE clearance_history DROP CONSTRAINT IF EXISTS clearance_history_event_type_check;
ALTER TABLE clearance_history ADD CONSTRAINT clearance_history_event_type_check
  CHECK (event_type IN ('set_up','marked_done','reversed','requirement_added','requirement_removed'));

-- 7. Notifications -------------------------------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_type_check CHECK (recipient_type IN ('student','staff'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN
  ('report','case','esc','sanction','appt','clr','account','newviol','notice'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_link_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_link_type_check
  CHECK (link_type IN ('case','sanction','appointment','student','clearance','inbox'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_email_status_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_email_status_check
  CHECK (email_status IN ('pending','sent','failed','skipped'));
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_recipient_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_recipient_check
  CHECK ((recipient_type = 'student') = (student_id IS NOT NULL));

-- 8. Foreign-key indexes on read paths (PERFORMANCE-SPEC D4, approved 2026-10-16) -----------------------------
-- The overlap constraint's index only covers live appointments; a student's full history needs this one.
CREATE INDEX IF NOT EXISTS ix_appt_student     ON appointments(student_id, start_date);
CREATE INDEX IF NOT EXISTS ix_appt_hist       ON appointment_history(appointment_id);
CREATE INDEX IF NOT EXISTS ix_cs_files         ON case_sanction_files(case_sanction_id);
CREATE INDEX IF NOT EXISTS ix_cs_hist          ON case_sanction_history(case_sanction_id);
CREATE INDEX IF NOT EXISTS ix_clearance_hist   ON clearance_history(clearance_id);
CREATE INDEX IF NOT EXISTS ix_escalation_major ON case_escalations(major_case_id);

COMMIT;

-- Check afterwards (expect rows for c = CHECK and x = exclusion, next to f, n, p):
--   SELECT contype, count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
--   WHERE n.nspname = 'public' GROUP BY 1 ORDER BY 1;
