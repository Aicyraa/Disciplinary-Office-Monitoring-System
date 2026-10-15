-- Adds the notices feature to a database that already has schema.sql applied (UI polish, 2026-10-13).
-- Run once on the development branch (and later on production). Safe to read first: it only
--   1. allows the new notification kind 'notice', and
--   2. creates the notices table.
-- Rollback: DROP TABLE notices; then put the old CHECK back (without 'notice') after deleting any 'notice' rows.

BEGIN;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_kind_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_kind_check CHECK (kind IN
  ('report','case','esc','sanction','appt','clr','account','newviol','notice'));

CREATE TABLE IF NOT EXISTS notices (
  notice_id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title                   text NOT NULL,
  message                 text NOT NULL,+
  *99
  instructions            text,
  expires_on              date,
  created_by_employee_id  varchar(20) NOT NULL REFERENCES employee_accounts(employee_id),
  date_created            timestamptz NOT NULL DEFAULT now(),
  date_updated            timestamptz NOT NULL DEFAULT now()
);

COMMIT;
