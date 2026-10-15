-- SDAO / SDO Portal — FINAL schema (PostgreSQL on Neon)
-- Conventions: snake_case, identity (auto-increment) PKs everywhere EXCEPT student_accounts / employee_accounts,
-- all timestamps are timestamptz (store UTC, display Asia/Manila), enums are CHECK constraints (easy to change).
-- Run order: this file, then seed.sql.

CREATE EXTENSION IF NOT EXISTS btree_gist;   -- needed for the appointment-overlap constraint

-- =====================================================================
-- 1. ACCOUNTS
-- =====================================================================
CREATE TABLE programs (
  program_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  program_name  text NOT NULL UNIQUE
);

CREATE TABLE student_accounts (
  student_id            varchar(20) PRIMARY KEY,                 -- e.g. 2025-1030808
  student_email         text NOT NULL UNIQUE,
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  password_hashed       text NOT NULL,                           -- argon2/bcrypt hash, NEVER plain text
  must_change_password  boolean NOT NULL DEFAULT false,          -- true after a staff reset (temp password)
  year_level            smallint NOT NULL CHECK (year_level BETWEEN 1 AND 6),
  program_id            integer NOT NULL REFERENCES programs(program_id),
  is_active             boolean NOT NULL DEFAULT true,
  date_created          timestamptz NOT NULL DEFAULT now(),
  avatar_key text
);

CREATE TABLE employee_accounts (
  employee_id           varchar(20) PRIMARY KEY,                 -- e.g. E001
  employee_email        text NOT NULL UNIQUE,
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  password_hashed       text NOT NULL,
  must_change_password  boolean NOT NULL DEFAULT false,
  position              text NOT NULL,
  is_active             boolean NOT NULL DEFAULT true,
  date_created          timestamptz NOT NULL DEFAULT now(),
  avatar_key            text
);

-- =====================================================================
-- 2. HANDBOOK, SANCTIONS, SANCTION TEMPLATES, FILES
-- =====================================================================
CREATE TABLE violations (
  violation_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  violation_type  text NOT NULL UNIQUE,
  severity        text NOT NULL CHECK (severity IN ('Minor','Major')),
  description     text NOT NULL,
  is_system       boolean NOT NULL DEFAULT false              -- true = assigned by the system only (V068 '3 minor offense'); hidden from pickers
);

CREATE TABLE handbook_entries (
  handbook_entry_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  violation_id       integer NOT NULL UNIQUE REFERENCES violations(violation_id),
  handbook_section   text NOT NULL                                -- e.g. VI.D.1 (not unique: H036 and H068 both sit under VI.E.20)
);
CREATE INDEX ix_handbook_section ON handbook_entries(handbook_section);

CREATE TABLE sanctions (
  sanction_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sanction_type  text NOT NULL UNIQUE,                            -- Violation Slip, CATEGORY - 2, CONFISCATE ...
  description    text NOT NULL
);

-- Which sanctions the handbook allows for a violation, per offense number (1st / 2nd offense)
CREATE TABLE handbook_entry_sanctions (
  handbook_entry_sanction_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  handbook_entry_id           integer NOT NULL REFERENCES handbook_entries(handbook_entry_id),
  sanction_id                 integer NOT NULL REFERENCES sanctions(sanction_id),
  offense_number              smallint NOT NULL CHECK (offense_number >= 1),
  UNIQUE (handbook_entry_id, sanction_id, offense_number)
);

-- NEW: downloadable template + written requirements for each sanction (1 template per sanction)
CREATE TABLE sanction_templates (
  sanction_template_id    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sanction_id             integer NOT NULL UNIQUE REFERENCES sanctions(sanction_id),
  title                   text,
  description             text,
  requirements            text,
  updated_by_employee_id  varchar(20) REFERENCES employee_accounts(employee_id),
  date_updated            timestamptz NOT NULL DEFAULT now()
);

-- NEW: metadata for every uploaded file. The bytes live in Neon Object Storage (S3), keyed by storage_key.
CREATE TABLE files (
  file_id                    integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  storage_key                text NOT NULL UNIQUE,                -- object key in the bucket
  original_name              text NOT NULL,
  mime_type                  text NOT NULL CHECK (mime_type IN (
                               'application/pdf',
                               'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes                 integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),  -- 10 MB
  uploaded_by_student_id     varchar(20) REFERENCES student_accounts(student_id),
  uploaded_by_employee_id    varchar(20) REFERENCES employee_accounts(employee_id),
  date_uploaded              timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(uploaded_by_student_id, uploaded_by_employee_id) = 1)
);

CREATE TABLE sanction_template_files (
  sanction_template_id  integer NOT NULL REFERENCES sanction_templates(sanction_template_id) ON DELETE CASCADE,
  file_id               integer NOT NULL UNIQUE REFERENCES files(file_id),
  PRIMARY KEY (sanction_template_id, file_id)
);

-- =====================================================================
-- 3. CASES (gate-form reports and staff-recorded cases all land directly in disciplinary_cases)
-- =====================================================================
CREATE TABLE disciplinary_cases (
  disciplinary_case_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id             varchar(20) REFERENCES student_accounts(student_id),   -- NULL only while a gate report's ID is unmatched
  handbook_entry_id      integer NOT NULL REFERENCES handbook_entries(handbook_entry_id),
  original_handbook_entry_id integer REFERENCES handbook_entries(handbook_entry_id),  -- set when the 3rd minor is converted into the Major '3 minor offense'
  source                 text NOT NULL CHECK (source IN ('gate','staff')),
  reported_by_employee_id varchar(20) REFERENCES employee_accounts(employee_id),     -- set when staff record it
  -- exactly what the guard typed on the gate form (kept even when the ID is unmatched or later corrected)
  claimed_student_id     varchar(20),
  claimed_name           text,
  claimed_program        text,
  claimed_year           text,
  submission_ref         uuid,                                   -- cases created by ONE form submit share this (validate / reject together)
  case_date              timestamptz NOT NULL DEFAULT now(),
  status                 text NOT NULL DEFAULT 'reported'
                           CHECK (status IN ('reported','validated','for_sanction','resolved','rejected')),
  is_escalated           boolean NOT NULL DEFAULT false,         -- this MINOR case was counted into the 3-minor Major case
  resolved_without_sanction boolean NOT NULL DEFAULT false,
  date_resolved          timestamptz,
  CHECK (student_id IS NOT NULL OR status IN ('reported','rejected')),
  CHECK ((source = 'gate'  AND claimed_student_id IS NOT NULL AND claimed_name IS NOT NULL)
      OR (source = 'staff' AND reported_by_employee_id IS NOT NULL))
);
-- duplicate guard for gate reports: same ID + same violation + same Manila day
CREATE UNIQUE INDEX ux_cases_gate_dedupe ON disciplinary_cases
  (claimed_student_id, handbook_entry_id, ((case_date AT TIME ZONE 'Asia/Manila')::date))
  WHERE source = 'gate';
CREATE INDEX ix_cases_submission ON disciplinary_cases(submission_ref) WHERE submission_ref IS NOT NULL;
CREATE INDEX ix_cases_student ON disciplinary_cases(student_id, status);
CREATE INDEX ix_cases_status  ON disciplinary_cases(status, case_date);

-- NEW: the 3rd verified minor case is CONVERTED into a Major case ('3 minor offense', V068/H068):
-- its handbook_entry_id becomes H068 and original_handbook_entry_id keeps what it was. The two earlier minors get
-- is_escalated = true and one row here each, pointing at the converted case. Result: 2 escalated minors + 1 major.
CREATE TABLE case_escalations (
  case_escalation_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  major_case_id       integer NOT NULL REFERENCES disciplinary_cases(disciplinary_case_id),   -- the converted 3rd case
  minor_case_id       integer NOT NULL UNIQUE REFERENCES disciplinary_cases(disciplinary_case_id),  -- a minor is used once
  CHECK (major_case_id <> minor_case_id)
);

-- TIMELINE for cases (status changes, remarks, system events). Student sees it all.
CREATE TABLE case_status_history (
  history_id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  disciplinary_case_id  integer NOT NULL REFERENCES disciplinary_cases(disciplinary_case_id) ON DELETE CASCADE,
  event_type            text NOT NULL CHECK (event_type IN
                          ('reported','validated','rejected','remark','sanction_assigned','escalated','flagged_escalated','resolved')),
  status_after          text CHECK (status_after IN ('reported','validated','for_sanction','resolved','rejected')),
  remarks               text,
  employee_id           varchar(20) REFERENCES employee_accounts(employee_id),   -- NULL = system / gate
  date_updated          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ix_case_hist ON case_status_history(disciplinary_case_id, date_updated);

-- =====================================================================
-- 4. SANCTIONS ASSIGNED TO CASES + PROOF
-- =====================================================================
CREATE TABLE case_sanctions (
  case_sanction_id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  disciplinary_case_id      integer NOT NULL REFERENCES disciplinary_cases(disciplinary_case_id),
  sanction_id               integer NOT NULL REFERENCES sanctions(sanction_id),
  status                    text NOT NULL DEFAULT 'assigned'
                              CHECK (status IN ('assigned','pending_verification','returned','completed')),
  date_assigned             timestamptz NOT NULL DEFAULT now(),
  due_date                  date NOT NULL,                       -- NEW: flexible, chosen by staff when assigning
  date_submitted            timestamptz,                         -- when proof was submitted / compliance recorded
  date_completed            timestamptz,                         -- when verified
  assigned_by_employee_id   varchar(20) NOT NULL REFERENCES employee_accounts(employee_id),
  verified_by_employee_id   varchar(20) REFERENCES employee_accounts(employee_id),
  staff_note                text,                                -- instructions / reason for return
  compliance_note           text,
  UNIQUE (disciplinary_case_id, sanction_id),
  CHECK (status <> 'completed' OR (date_completed IS NOT NULL AND verified_by_employee_id IS NOT NULL))
);
CREATE INDEX ix_cs_status ON case_sanctions(status, due_date);

-- NEW: proof files uploaded by the student (max 5 per sanction enforced in the app/service layer)
CREATE TABLE case_sanction_files (
  case_sanction_file_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_sanction_id       integer NOT NULL REFERENCES case_sanctions(case_sanction_id) ON DELETE CASCADE,
  file_id                integer NOT NULL UNIQUE REFERENCES files(file_id),
  viewed_by_employee_id  varchar(20) REFERENCES employee_accounts(employee_id),
  date_viewed            timestamptz                              -- staff must open every file before verifying
);

-- TIMELINE for sanctions (assigned, proof uploaded/replaced/removed, returned, verified)
CREATE TABLE case_sanction_history (
  case_sanction_history_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  case_sanction_id          integer NOT NULL REFERENCES case_sanctions(case_sanction_id) ON DELETE CASCADE,
  event_type                text NOT NULL CHECK (event_type IN
                              ('assigned','proof_uploaded','proof_replaced','proof_removed','compliance_recorded','returned','verified')),
  remarks                   text,
  employee_id               varchar(20) REFERENCES employee_accounts(employee_id),
  student_id                varchar(20) REFERENCES student_accounts(student_id),
  date_logged               timestamptz NOT NULL DEFAULT now(),
  CHECK (num_nonnulls(employee_id, student_id) = 1)
);

-- =====================================================================
-- 5. APPOINTMENTS (6-working-day window, 7:00 AM - 5:00 PM, Mon-Sat, Asia/Manila)
-- =====================================================================
CREATE TABLE appointments (
  appointment_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id      varchar(20) NOT NULL REFERENCES student_accounts(student_id),
  employee_id     varchar(20) NOT NULL REFERENCES employee_accounts(employee_id),   -- who assigned it
  start_date      date NOT NULL,                                 -- not Sunday, today .. +60 days (app rule)
  end_date        date NOT NULL,                                 -- start + 5 more working days (Sundays skipped), app-computed
  purpose         text NOT NULL,
  notes           text,
  status          text NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled','rescheduled','completed','cancelled')),
  cancel_reason   text,
  date_created    timestamptz NOT NULL DEFAULT now(),
  date_updated    timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date >= start_date),
  CHECK (EXTRACT(dow FROM start_date) <> 0),
  CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL),
  -- a student cannot have two live appointments whose windows overlap
  EXCLUDE USING gist (student_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
    WHERE (status IN ('scheduled','rescheduled'))
);

CREATE TABLE appointment_history (
  appointment_history_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id          integer NOT NULL REFERENCES appointments(appointment_id) ON DELETE CASCADE,
  event_type              text NOT NULL CHECK (event_type IN ('assigned','rescheduled','remarks_updated','completed','cancelled')),
  remarks                 text,
  employee_id             varchar(20) NOT NULL REFERENCES employee_accounts(employee_id),
  date_logged             timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 6. CLEARANCE (manual, staff-controlled)
-- =====================================================================
CREATE TABLE requirements (
  requirement_id     integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requirement_label  text NOT NULL UNIQUE,
  is_default         boolean NOT NULL DEFAULT false              -- default = added to every new clearance
);

CREATE TABLE clearances (
  clearance_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  student_id     varchar(20) NOT NULL REFERENCES student_accounts(student_id),
  employee_id    varchar(20) REFERENCES employee_accounts(employee_id),   -- who set it up
  academic_year  smallint NOT NULL,                              -- start year, e.g. 2026 = 2026-2027
  semester       smallint NOT NULL CHECK (semester BETWEEN 1 AND 3),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','cleared')),
  UNIQUE (student_id, academic_year, semester)
);

CREATE TABLE clearance_requirements (
  clearance_requirement_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clearance_id              integer NOT NULL REFERENCES clearances(clearance_id) ON DELETE CASCADE,
  requirement_id            integer NOT NULL REFERENCES requirements(requirement_id),
  status                    text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed')),
  remarks                   text,
  completed_by_employee_id  varchar(20) REFERENCES employee_accounts(employee_id),
  date_completed            timestamptz,
  UNIQUE (clearance_id, requirement_id)
);

-- NEW: change log for clearance (marked done, reversed + reason, added/removed requirement)
CREATE TABLE clearance_history (
  clearance_history_id  integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clearance_id          integer NOT NULL REFERENCES clearances(clearance_id) ON DELETE CASCADE,
  requirement_id        integer REFERENCES requirements(requirement_id),
  event_type            text NOT NULL CHECK (event_type IN ('set_up','marked_done','reversed','requirement_added','requirement_removed')),
  remarks               text,
  employee_id           varchar(20) NOT NULL REFERENCES employee_accounts(employee_id),
  date_logged           timestamptz NOT NULL DEFAULT now()
);

-- =====================================================================
-- 7. NOTIFICATIONS (in-app inbox + email): every admin update about a student's cases, sanctions, appointments, clearance
-- =====================================================================
-- NEW: one row per recipient per update. Staff share ONE mailbox (recipient_type = 'staff').
CREATE TABLE notifications (
  notification_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient_type    text NOT NULL CHECK (recipient_type IN ('student','staff')),
  student_id        varchar(20) REFERENCES student_accounts(student_id),
  kind              text NOT NULL CHECK (kind IN
                      ('report','case','esc','sanction','appt','clr','account','newviol','notice')),
  title             text NOT NULL,
  message           text NOT NULL,
  link_type         text CHECK (link_type IN ('case','sanction','appointment','student','clearance','inbox')),
  link_id           integer,
  idempotency_key   text NOT NULL UNIQUE,                         -- same update is never sent twice
  is_read           boolean NOT NULL DEFAULT false,
  date_created      timestamptz NOT NULL DEFAULT now(),
  email_status      text NOT NULL DEFAULT 'pending' CHECK (email_status IN ('pending','sent','failed','skipped')),
  date_email_sent   timestamptz,
  CHECK ((recipient_type = 'student') = (student_id IS NOT NULL))
);
-- NEW (UI polish, 2026-10-13): important notices the office broadcasts to every student. Publishing writes
-- one `notice` notification per active student (link_type 'inbox', link_id = notice_id); email goes out through
-- the usual delivery sweep. Edit rewrites those notifications; remove deletes them with the notice.
CREATE TABLE notices (
  notice_id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title                   text NOT NULL,
  message                 text NOT NULL,
  instructions            text,
  expires_on              date,                                -- Asia/Manila calendar day; hidden from inboxes after it
  created_by_employee_id  varchar(20) NOT NULL REFERENCES employee_accounts(employee_id),
  date_created            timestamptz NOT NULL DEFAULT now(),
  date_updated            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_notif_inbox ON notifications(student_id, is_read, date_created DESC);
CREATE INDEX ix_notif_email ON notifications(email_status) WHERE email_status = 'pending';
