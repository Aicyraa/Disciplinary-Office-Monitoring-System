-- Read-only. Run before docs/db-restore-constraints.sql: every number must be 0 (has_btree_gist may be 0 or 1;
-- the restore script installs it). A non-zero column names the rule some existing rows break; fix those rows first.
SELECT
 (SELECT count(*) FROM pg_extension WHERE extname='btree_gist') AS has_btree_gist,
 (SELECT count(*) FROM student_accounts WHERE year_level NOT BETWEEN 1 AND 6) AS bad_year,
 (SELECT count(*) FROM violations WHERE severity NOT IN ('Minor','Major')) AS bad_severity,
 (SELECT count(*) FROM files WHERE mime_type NOT IN ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    OR size_bytes <= 0 OR size_bytes > 10485760 OR num_nonnulls(uploaded_by_student_id, uploaded_by_employee_id) <> 1) AS bad_files,
 (SELECT count(*) FROM disciplinary_cases WHERE source NOT IN ('gate','staff')
    OR status NOT IN ('reported','validated','for_sanction','resolved','rejected')
    OR NOT (student_id IS NOT NULL OR status IN ('reported','rejected'))
    OR NOT ((source='gate' AND claimed_student_id IS NOT NULL AND claimed_name IS NOT NULL) OR (source='staff' AND reported_by_employee_id IS NOT NULL))) AS bad_cases,
 (SELECT count(*) FROM (SELECT 1 FROM disciplinary_cases WHERE source='gate'
    GROUP BY claimed_student_id, handbook_entry_id, (case_date AT TIME ZONE 'Asia/Manila')::date HAVING count(*) > 1) d) AS duplicate_gate_reports,
 (SELECT count(*) FROM case_escalations WHERE major_case_id = minor_case_id) AS bad_escalations,
 (SELECT count(*) FROM case_status_history WHERE event_type NOT IN ('reported','validated','rejected','remark','sanction_assigned','escalated','flagged_escalated','resolved')
    OR (status_after IS NOT NULL AND status_after NOT IN ('reported','validated','for_sanction','resolved','rejected'))) AS bad_case_history,
 (SELECT count(*) FROM case_sanctions WHERE status NOT IN ('assigned','pending_verification','returned','completed')
    OR NOT (status <> 'completed' OR (date_completed IS NOT NULL AND verified_by_employee_id IS NOT NULL))) AS bad_case_sanctions,
 (SELECT count(*) FROM case_sanction_history WHERE event_type NOT IN ('assigned','proof_uploaded','proof_replaced','proof_removed','compliance_recorded','returned','verified')
    OR num_nonnulls(employee_id, student_id) <> 1) AS bad_sanction_history,
 (SELECT count(*) FROM appointments WHERE status NOT IN ('scheduled','rescheduled','completed','cancelled')
    OR end_date < start_date OR EXTRACT(dow FROM start_date) = 0 OR (status = 'cancelled' AND cancel_reason IS NULL)) AS bad_appointments,
 (SELECT count(*) FROM appointments a JOIN appointments b ON a.student_id = b.student_id AND a.appointment_id < b.appointment_id
    AND a.status IN ('scheduled','rescheduled') AND b.status IN ('scheduled','rescheduled')
    AND daterange(a.start_date, a.end_date, '[]') && daterange(b.start_date, b.end_date, '[]')) AS overlapping_appointments,
 (SELECT count(*) FROM appointment_history WHERE event_type NOT IN ('assigned','rescheduled','remarks_updated','completed','cancelled')) AS bad_appointment_history,
 (SELECT count(*) FROM clearances WHERE semester NOT BETWEEN 1 AND 3 OR status NOT IN ('pending','cleared')) AS bad_clearances,
 (SELECT count(*) FROM clearance_requirements WHERE status NOT IN ('pending','completed')) AS bad_clearance_requirements,
 (SELECT count(*) FROM clearance_history WHERE event_type NOT IN ('set_up','marked_done','reversed','requirement_added','requirement_removed')) AS bad_clearance_history,
 (SELECT count(*) FROM notifications WHERE recipient_type NOT IN ('student','staff')
    OR kind NOT IN ('report','case','esc','sanction','appt','clr','account','newviol','notice')
    OR (link_type IS NOT NULL AND link_type NOT IN ('case','sanction','appointment','student','clearance','inbox'))
    OR email_status NOT IN ('pending','sent','failed','skipped')
    OR (recipient_type = 'student') <> (student_id IS NOT NULL)) AS bad_notifications,
 (SELECT count(*) FROM handbook_entry_sanctions WHERE offense_number < 1) AS bad_offense_numbers;
