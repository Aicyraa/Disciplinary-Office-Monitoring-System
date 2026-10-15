-- CreateTable
CREATE TABLE "appointment_history" (
    "appointment_history_id" SERIAL NOT NULL,
    "appointment_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "remarks" TEXT,
    "employee_id" VARCHAR(20) NOT NULL,
    "date_logged" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_history_pkey" PRIMARY KEY ("appointment_history_id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "appointment_id" SERIAL NOT NULL,
    "student_id" VARCHAR(20) NOT NULL,
    "employee_id" VARCHAR(20) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "purpose" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "cancel_reason" TEXT,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("appointment_id")
);

-- CreateTable
CREATE TABLE "case_escalations" (
    "case_escalation_id" SERIAL NOT NULL,
    "major_case_id" INTEGER NOT NULL,
    "minor_case_id" INTEGER NOT NULL,

    CONSTRAINT "case_escalations_pkey" PRIMARY KEY ("case_escalation_id")
);

-- CreateTable
CREATE TABLE "case_sanction_files" (
    "case_sanction_file_id" SERIAL NOT NULL,
    "case_sanction_id" INTEGER NOT NULL,
    "file_id" INTEGER NOT NULL,
    "viewed_by_employee_id" VARCHAR(20),
    "date_viewed" TIMESTAMPTZ(6),

    CONSTRAINT "case_sanction_files_pkey" PRIMARY KEY ("case_sanction_file_id")
);

-- CreateTable
CREATE TABLE "case_sanction_history" (
    "case_sanction_history_id" SERIAL NOT NULL,
    "case_sanction_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "remarks" TEXT,
    "employee_id" VARCHAR(20),
    "student_id" VARCHAR(20),
    "date_logged" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_sanction_history_pkey" PRIMARY KEY ("case_sanction_history_id")
);

-- CreateTable
CREATE TABLE "case_sanctions" (
    "case_sanction_id" SERIAL NOT NULL,
    "disciplinary_case_id" INTEGER NOT NULL,
    "sanction_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'assigned',
    "date_assigned" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_date" DATE NOT NULL,
    "date_submitted" TIMESTAMPTZ(6),
    "date_completed" TIMESTAMPTZ(6),
    "assigned_by_employee_id" VARCHAR(20) NOT NULL,
    "verified_by_employee_id" VARCHAR(20),
    "staff_note" TEXT,
    "compliance_note" TEXT,

    CONSTRAINT "case_sanctions_pkey" PRIMARY KEY ("case_sanction_id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "history_id" SERIAL NOT NULL,
    "disciplinary_case_id" INTEGER NOT NULL,
    "event_type" TEXT NOT NULL,
    "status_after" TEXT,
    "remarks" TEXT,
    "employee_id" VARCHAR(20),
    "date_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateTable
CREATE TABLE "clearance_history" (
    "clearance_history_id" SERIAL NOT NULL,
    "clearance_id" INTEGER NOT NULL,
    "requirement_id" INTEGER,
    "event_type" TEXT NOT NULL,
    "remarks" TEXT,
    "employee_id" VARCHAR(20) NOT NULL,
    "date_logged" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clearance_history_pkey" PRIMARY KEY ("clearance_history_id")
);

-- CreateTable
CREATE TABLE "clearance_requirements" (
    "clearance_requirement_id" SERIAL NOT NULL,
    "clearance_id" INTEGER NOT NULL,
    "requirement_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "remarks" TEXT,
    "completed_by_employee_id" VARCHAR(20),
    "date_completed" TIMESTAMPTZ(6),

    CONSTRAINT "clearance_requirements_pkey" PRIMARY KEY ("clearance_requirement_id")
);

-- CreateTable
CREATE TABLE "clearances" (
    "clearance_id" SERIAL NOT NULL,
    "student_id" VARCHAR(20) NOT NULL,
    "employee_id" VARCHAR(20),
    "academic_year" SMALLINT NOT NULL,
    "semester" SMALLINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',

    CONSTRAINT "clearances_pkey" PRIMARY KEY ("clearance_id")
);

-- CreateTable
CREATE TABLE "disciplinary_cases" (
    "disciplinary_case_id" SERIAL NOT NULL,
    "student_id" VARCHAR(20),
    "handbook_entry_id" INTEGER NOT NULL,
    "original_handbook_entry_id" INTEGER,
    "source" TEXT NOT NULL,
    "reported_by_employee_id" VARCHAR(20),
    "claimed_student_id" VARCHAR(20),
    "claimed_name" TEXT,
    "claimed_program" TEXT,
    "claimed_year" TEXT,
    "submission_ref" UUID,
    "case_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'reported',
    "is_escalated" BOOLEAN NOT NULL DEFAULT false,
    "resolved_without_sanction" BOOLEAN NOT NULL DEFAULT false,
    "date_resolved" TIMESTAMPTZ(6),

    CONSTRAINT "disciplinary_cases_pkey" PRIMARY KEY ("disciplinary_case_id")
);

-- CreateTable
CREATE TABLE "employee_accounts" (
    "employee_id" VARCHAR(20) NOT NULL,
    "employee_email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "password_hashed" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "position" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatar_key" TEXT,

    CONSTRAINT "employee_accounts_pkey" PRIMARY KEY ("employee_id")
);

-- CreateTable
CREATE TABLE "files" (
    "file_id" SERIAL NOT NULL,
    "storage_key" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by_student_id" VARCHAR(20),
    "uploaded_by_employee_id" VARCHAR(20),
    "date_uploaded" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("file_id")
);

-- CreateTable
CREATE TABLE "handbook_entries" (
    "handbook_entry_id" SERIAL NOT NULL,
    "violation_id" INTEGER NOT NULL,
    "handbook_section" TEXT NOT NULL,

    CONSTRAINT "handbook_entries_pkey" PRIMARY KEY ("handbook_entry_id")
);

-- CreateTable
CREATE TABLE "handbook_entry_sanctions" (
    "handbook_entry_sanction_id" SERIAL NOT NULL,
    "handbook_entry_id" INTEGER NOT NULL,
    "sanction_id" INTEGER NOT NULL,
    "offense_number" SMALLINT NOT NULL,

    CONSTRAINT "handbook_entry_sanctions_pkey" PRIMARY KEY ("handbook_entry_sanction_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "recipient_type" TEXT NOT NULL,
    "student_id" VARCHAR(20),
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link_type" TEXT,
    "link_id" INTEGER,
    "idempotency_key" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "email_status" TEXT NOT NULL DEFAULT 'pending',
    "date_email_sent" TIMESTAMPTZ(6),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "notices" (
    "notice_id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "instructions" TEXT,
    "expires_on" DATE,
    "created_by_employee_id" VARCHAR(20) NOT NULL,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("notice_id")
);

-- CreateTable
CREATE TABLE "programs" (
    "program_id" SERIAL NOT NULL,
    "program_name" TEXT NOT NULL,

    CONSTRAINT "programs_pkey" PRIMARY KEY ("program_id")
);

-- CreateTable
CREATE TABLE "requirements" (
    "requirement_id" SERIAL NOT NULL,
    "requirement_label" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("requirement_id")
);

-- CreateTable
CREATE TABLE "sanction_template_files" (
    "sanction_template_id" INTEGER NOT NULL,
    "file_id" INTEGER NOT NULL,

    CONSTRAINT "sanction_template_files_pkey" PRIMARY KEY ("sanction_template_id","file_id")
);

-- CreateTable
CREATE TABLE "sanction_templates" (
    "sanction_template_id" SERIAL NOT NULL,
    "sanction_id" INTEGER NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "requirements" TEXT,
    "updated_by_employee_id" VARCHAR(20),
    "date_updated" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sanction_templates_pkey" PRIMARY KEY ("sanction_template_id")
);

-- CreateTable
CREATE TABLE "sanctions" (
    "sanction_id" SERIAL NOT NULL,
    "sanction_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "sanctions_pkey" PRIMARY KEY ("sanction_id")
);

-- CreateTable
CREATE TABLE "student_accounts" (
    "student_id" VARCHAR(20) NOT NULL,
    "student_email" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "password_hashed" TEXT NOT NULL,
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "year_level" SMALLINT NOT NULL,
    "program_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "date_created" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avatar_key" TEXT,

    CONSTRAINT "student_accounts_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "violations" (
    "violation_id" SERIAL NOT NULL,
    "violation_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "violations_pkey" PRIMARY KEY ("violation_id")
);

-- CreateTable
CREATE TABLE "session" (
    "sid" VARCHAR NOT NULL,
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);

-- CreateIndex
CREATE UNIQUE INDEX "case_escalations_minor_case_id_key" ON "case_escalations"("minor_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_sanction_files_file_id_key" ON "case_sanction_files"("file_id");

-- CreateIndex
CREATE INDEX "ix_cs_status" ON "case_sanctions"("status", "due_date");

-- CreateIndex
CREATE UNIQUE INDEX "case_sanctions_disciplinary_case_id_sanction_id_key" ON "case_sanctions"("disciplinary_case_id", "sanction_id");

-- CreateIndex
CREATE INDEX "ix_case_hist" ON "case_status_history"("disciplinary_case_id", "date_updated");

-- CreateIndex
CREATE UNIQUE INDEX "clearance_requirements_clearance_id_requirement_id_key" ON "clearance_requirements"("clearance_id", "requirement_id");

-- CreateIndex
CREATE UNIQUE INDEX "clearances_student_id_academic_year_semester_key" ON "clearances"("student_id", "academic_year", "semester");

-- CreateIndex
CREATE INDEX "ix_cases_status" ON "disciplinary_cases"("status", "case_date");

-- CreateIndex
CREATE INDEX "ix_cases_student" ON "disciplinary_cases"("student_id", "status");

-- CreateIndex
CREATE INDEX "ix_cases_submission" ON "disciplinary_cases"("submission_ref") WHERE (submission_ref IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "employee_accounts_employee_email_key" ON "employee_accounts"("employee_email");

-- CreateIndex
CREATE UNIQUE INDEX "files_storage_key_key" ON "files"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "handbook_entries_violation_id_key" ON "handbook_entries"("violation_id");

-- CreateIndex
CREATE INDEX "ix_handbook_section" ON "handbook_entries"("handbook_section");

-- CreateIndex
CREATE UNIQUE INDEX "handbook_entry_sanctions_handbook_entry_id_sanction_id_offe_key" ON "handbook_entry_sanctions"("handbook_entry_id", "sanction_id", "offense_number");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_idempotency_key_key" ON "notifications"("idempotency_key");

-- CreateIndex
CREATE INDEX "ix_notif_email" ON "notifications"("email_status") WHERE (email_status = 'pending'::text);

-- CreateIndex
CREATE INDEX "ix_notif_inbox" ON "notifications"("student_id", "is_read", "date_created" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "programs_program_name_key" ON "programs"("program_name");

-- CreateIndex
CREATE UNIQUE INDEX "requirements_requirement_label_key" ON "requirements"("requirement_label");

-- CreateIndex
CREATE UNIQUE INDEX "sanction_template_files_file_id_key" ON "sanction_template_files"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "sanction_templates_sanction_id_key" ON "sanction_templates"("sanction_id");

-- CreateIndex
CREATE UNIQUE INDEX "sanctions_sanction_type_key" ON "sanctions"("sanction_type");

-- CreateIndex
CREATE UNIQUE INDEX "student_accounts_student_email_key" ON "student_accounts"("student_email");

-- CreateIndex
CREATE UNIQUE INDEX "violations_violation_type_key" ON "violations"("violation_type");

-- CreateIndex
CREATE INDEX "IDX_session_expire" ON "session"("expire");

-- AddForeignKey
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("appointment_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointment_history" ADD CONSTRAINT "appointment_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_accounts"("student_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_escalations" ADD CONSTRAINT "case_escalations_major_case_id_fkey" FOREIGN KEY ("major_case_id") REFERENCES "disciplinary_cases"("disciplinary_case_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_escalations" ADD CONSTRAINT "case_escalations_minor_case_id_fkey" FOREIGN KEY ("minor_case_id") REFERENCES "disciplinary_cases"("disciplinary_case_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanction_files" ADD CONSTRAINT "case_sanction_files_case_sanction_id_fkey" FOREIGN KEY ("case_sanction_id") REFERENCES "case_sanctions"("case_sanction_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanction_files" ADD CONSTRAINT "case_sanction_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("file_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanction_files" ADD CONSTRAINT "case_sanction_files_viewed_by_employee_id_fkey" FOREIGN KEY ("viewed_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanction_history" ADD CONSTRAINT "case_sanction_history_case_sanction_id_fkey" FOREIGN KEY ("case_sanction_id") REFERENCES "case_sanctions"("case_sanction_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanction_history" ADD CONSTRAINT "case_sanction_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanction_history" ADD CONSTRAINT "case_sanction_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_accounts"("student_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanctions" ADD CONSTRAINT "case_sanctions_assigned_by_employee_id_fkey" FOREIGN KEY ("assigned_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanctions" ADD CONSTRAINT "case_sanctions_disciplinary_case_id_fkey" FOREIGN KEY ("disciplinary_case_id") REFERENCES "disciplinary_cases"("disciplinary_case_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanctions" ADD CONSTRAINT "case_sanctions_sanction_id_fkey" FOREIGN KEY ("sanction_id") REFERENCES "sanctions"("sanction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_sanctions" ADD CONSTRAINT "case_sanctions_verified_by_employee_id_fkey" FOREIGN KEY ("verified_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_disciplinary_case_id_fkey" FOREIGN KEY ("disciplinary_case_id") REFERENCES "disciplinary_cases"("disciplinary_case_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearance_history" ADD CONSTRAINT "clearance_history_clearance_id_fkey" FOREIGN KEY ("clearance_id") REFERENCES "clearances"("clearance_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearance_history" ADD CONSTRAINT "clearance_history_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearance_history" ADD CONSTRAINT "clearance_history_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("requirement_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearance_requirements" ADD CONSTRAINT "clearance_requirements_clearance_id_fkey" FOREIGN KEY ("clearance_id") REFERENCES "clearances"("clearance_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearance_requirements" ADD CONSTRAINT "clearance_requirements_completed_by_employee_id_fkey" FOREIGN KEY ("completed_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearance_requirements" ADD CONSTRAINT "clearance_requirements_requirement_id_fkey" FOREIGN KEY ("requirement_id") REFERENCES "requirements"("requirement_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearances" ADD CONSTRAINT "clearances_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clearances" ADD CONSTRAINT "clearances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_accounts"("student_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disciplinary_cases" ADD CONSTRAINT "disciplinary_cases_handbook_entry_id_fkey" FOREIGN KEY ("handbook_entry_id") REFERENCES "handbook_entries"("handbook_entry_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disciplinary_cases" ADD CONSTRAINT "disciplinary_cases_original_handbook_entry_id_fkey" FOREIGN KEY ("original_handbook_entry_id") REFERENCES "handbook_entries"("handbook_entry_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disciplinary_cases" ADD CONSTRAINT "disciplinary_cases_reported_by_employee_id_fkey" FOREIGN KEY ("reported_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "disciplinary_cases" ADD CONSTRAINT "disciplinary_cases_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_accounts"("student_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_employee_id_fkey" FOREIGN KEY ("uploaded_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_student_id_fkey" FOREIGN KEY ("uploaded_by_student_id") REFERENCES "student_accounts"("student_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "handbook_entries" ADD CONSTRAINT "handbook_entries_violation_id_fkey" FOREIGN KEY ("violation_id") REFERENCES "violations"("violation_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "handbook_entry_sanctions" ADD CONSTRAINT "handbook_entry_sanctions_handbook_entry_id_fkey" FOREIGN KEY ("handbook_entry_id") REFERENCES "handbook_entries"("handbook_entry_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "handbook_entry_sanctions" ADD CONSTRAINT "handbook_entry_sanctions_sanction_id_fkey" FOREIGN KEY ("sanction_id") REFERENCES "sanctions"("sanction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_accounts"("student_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_employee_id_fkey" FOREIGN KEY ("created_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sanction_template_files" ADD CONSTRAINT "sanction_template_files_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("file_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sanction_template_files" ADD CONSTRAINT "sanction_template_files_sanction_template_id_fkey" FOREIGN KEY ("sanction_template_id") REFERENCES "sanction_templates"("sanction_template_id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sanction_templates" ADD CONSTRAINT "sanction_templates_sanction_id_fkey" FOREIGN KEY ("sanction_id") REFERENCES "sanctions"("sanction_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sanction_templates" ADD CONSTRAINT "sanction_templates_updated_by_employee_id_fkey" FOREIGN KEY ("updated_by_employee_id") REFERENCES "employee_accounts"("employee_id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "student_accounts" ADD CONSTRAINT "student_accounts_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "programs"("program_id") ON DELETE NO ACTION ON UPDATE NO ACTION;
