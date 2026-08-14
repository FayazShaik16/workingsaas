-- ============================================================================
-- WORKLEDGER DATABASE PATCH v2
-- Run this ENTIRE script in Supabase SQL Editor (safe to run multiple times)
-- All statements use IF NOT EXISTS / CREATE OR REPLACE guards
-- ============================================================================

BEGIN;

-- ============================================================================
-- SECTION 1: FIX auth trigger (no_session bug for non-invited users)
-- ============================================================================
CREATE OR REPLACE FUNCTION handle_new_auth_user() RETURNS TRIGGER AS $$
DECLARE 
    v_invite_id UUID;
    v_invite_org_id UUID;
    v_invite_unit_id UUID;
    v_invite_role_id UUID;
    v_org_id UUID;
    v_role_id UUID;
    v_has_invitations BOOLEAN;
BEGIN
    -- Check if invitations table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invitations'
    ) INTO v_has_invitations;

    IF v_has_invitations THEN
        BEGIN
            EXECUTE 'SELECT id, organization_id, org_unit_id, intended_role_id FROM invitations WHERE email = $1 AND status = ''PENDING'' AND expires_at > clock_timestamp() ORDER BY created_at DESC LIMIT 1'
            INTO v_invite_id, v_invite_org_id, v_invite_unit_id, v_invite_role_id
            USING NEW.email;
        EXCEPTION WHEN OTHERS THEN
            v_invite_id := NULL;
        END;
    END IF;

    IF v_invite_id IS NOT NULL THEN
        -- Invited user signup flow
        INSERT INTO users (id, organization_id, org_unit_id, email, name, status)
        VALUES (
            NEW.id, v_invite_org_id, v_invite_unit_id, NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
            'ACTIVE'
        );
        IF v_invite_role_id IS NOT NULL THEN
            INSERT INTO user_roles (user_id, role_id)
            VALUES (NEW.id, v_invite_role_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        INSERT INTO wallets (organization_id, owner_user_id, purpose)
        VALUES (v_invite_org_id, NEW.id, 'PERSONAL')
        ON CONFLICT DO NOTHING;
        
        EXECUTE 'UPDATE invitations SET status = ''ACCEPTED'' WHERE id = $1' USING v_invite_id;
    ELSE
        -- Self-signup flow (New organization creator)
        INSERT INTO organizations (name, type)
        VALUES (
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)) || '''s Org',
            'GENERIC'::organization_type
        )
        RETURNING id INTO v_org_id;

        INSERT INTO users (id, organization_id, email, name, status)
        VALUES (
            NEW.id, v_org_id, NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
            'ACTIVE'
        );

        -- Create standard SYSTEM_ADMIN role for this new organization creator
        INSERT INTO roles (organization_id, name, scope_level, is_system_role)
        VALUES (v_org_id, 'System Administrator', 'SYSTEM_ADMIN', true)
        RETURNING id INTO v_role_id;

        INSERT INTO user_roles (user_id, role_id)
        VALUES (NEW.id, v_role_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO wallets (organization_id, owner_user_id, purpose)
        VALUES (v_org_id, NEW.id, 'PERSONAL')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user error: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate to bind to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();

-- ============================================================================
-- SECTION 2: Org + User columns for generalization
-- ============================================================================
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS terminology     JSONB NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS domain_settings JSONB NOT NULL DEFAULT '{}';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_reset_password  BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS temp_password_set_at TIMESTAMPTZ;

-- ============================================================================
-- SECTION 3: Academic Domain Tables
-- ============================================================================
CREATE TABLE IF NOT EXISTS academic_programs (
    id              UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    dept_id         UUID NOT NULL REFERENCES org_units(id)     ON DELETE CASCADE,
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    total_years     INT  NOT NULL DEFAULT 4,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    UNIQUE(organization_id, code)
);
CREATE INDEX IF NOT EXISTS idx_acad_programs_dept ON academic_programs(dept_id);

CREATE TABLE IF NOT EXISTS subjects (
    id              UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id)     ON DELETE CASCADE,
    program_id      UUID NOT NULL REFERENCES academic_programs(id) ON DELETE CASCADE,
    semester        INT  NOT NULL CHECK (semester BETWEEN 1 AND 8),
    code            TEXT NOT NULL,
    name            TEXT NOT NULL,
    credits         INT  NOT NULL DEFAULT 3,
    subject_type    TEXT NOT NULL DEFAULT 'THEORY'
                    CHECK (subject_type IN ('THEORY','LAB','ELECTIVE','PROJECT','SEMINAR')),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(program_id, semester, code)
);

CREATE TABLE IF NOT EXISTS academic_batches (
    id               UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id  UUID NOT NULL REFERENCES organizations(id)     ON DELETE CASCADE,
    program_id       UUID NOT NULL REFERENCES academic_programs(id) ON DELETE CASCADE,
    year_of_study    INT  NOT NULL CHECK (year_of_study BETWEEN 1 AND 4),
    section          TEXT NOT NULL,
    academic_year    TEXT NOT NULL,
    current_semester INT  NOT NULL CHECK (current_semester BETWEEN 1 AND 8),
    is_active        BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(program_id, year_of_study, section, academic_year)
);

CREATE TABLE IF NOT EXISTS subject_assignments (
    id              UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id)      ON DELETE CASCADE,
    batch_id        UUID NOT NULL REFERENCES academic_batches(id)   ON DELETE CASCADE,
    subject_id      UUID NOT NULL REFERENCES subjects(id)           ON DELETE CASCADE,
    faculty_id      UUID NOT NULL REFERENCES users(id)              ON DELETE CASCADE,
    academic_year   TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(batch_id, subject_id, faculty_id)
);
CREATE INDEX IF NOT EXISTS idx_subj_assign_faculty ON subject_assignments(faculty_id);

DO $$ BEGIN
    CREATE TYPE day_of_week_enum AS ENUM ('MON','TUE','WED','THU','FRI','SAT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS timetable_slots (
    id                    UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id       UUID NOT NULL REFERENCES organizations(id)        ON DELETE CASCADE,
    subject_assignment_id UUID NOT NULL REFERENCES subject_assignments(id)  ON DELETE CASCADE,
    day_of_week           day_of_week_enum NOT NULL,
    period_number         INT  NOT NULL CHECK (period_number BETWEEN 1 AND 8),
    start_time            TIME NOT NULL,
    end_time              TIME NOT NULL,
    room                  TEXT,
    effective_from        DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to          DATE,
    is_active             BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS attendance_records (
    id                    UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id       UUID NOT NULL REFERENCES organizations(id)    ON DELETE CASCADE,
    timetable_slot_id     UUID NOT NULL REFERENCES timetable_slots(id)  ON DELETE CASCADE,
    faculty_id            UUID NOT NULL REFERENCES users(id)            ON DELETE CASCADE,
    conducted_on          DATE NOT NULL,
    status                TEXT NOT NULL DEFAULT 'SCHEDULED'
                          CHECK (status IN ('SCHEDULED','CONDUCTED','CANCELLED','HOLIDAY','LEAVE_APPROVED','SUBSTITUTED')),
    substitute_faculty_id UUID REFERENCES users(id),
    topic_covered         TEXT,
    marked_at             TIMESTAMPTZ,
    UNIQUE(timetable_slot_id, conducted_on)
);
CREATE INDEX IF NOT EXISTS idx_attendance_faculty_month ON attendance_records(faculty_id, conducted_on);

CREATE TABLE IF NOT EXISTS leave_requests (
    id              UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    faculty_id      UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    hod_id          UUID NOT NULL REFERENCES users(id),
    leave_date      DATE NOT NULL,
    reason          TEXT NOT NULL,
    leave_type      TEXT NOT NULL DEFAULT 'PERSONAL'
                    CHECK (leave_type IN ('PERSONAL','MEDICAL','SYLLABUS_COMPLETED','DUTY_LEAVE','OTHER')),
    status          TEXT NOT NULL DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
    hod_note        TEXT,
    decided_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- SECTION 4: Performance Snapshots (historical data NEVER lost after credit reset)
-- ============================================================================
CREATE TABLE IF NOT EXISTS performance_snapshots (
    id                           UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id                      UUID NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
    month                        DATE NOT NULL,
    total_scheduled              INT  NOT NULL DEFAULT 0,
    total_conducted              INT  NOT NULL DEFAULT 0,
    approved_leaves              INT  NOT NULL DEFAULT 0,
    cancelled_count              INT  NOT NULL DEFAULT 0,
    progress_pct                 NUMERIC(5,2)  NOT NULL DEFAULT 0,
    credits_earned               NUMERIC(12,4) NOT NULL DEFAULT 0,
    salary_released              BOOLEAN NOT NULL DEFAULT false,
    loan_amount                  NUMERIC(12,4) NOT NULL DEFAULT 0,
    unstructured_tasks_completed INT  NOT NULL DEFAULT 0,
    unstructured_credits_earned  NUMERIC(12,4) NOT NULL DEFAULT 0,
    snapshot_taken_at            TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    taken_by                     UUID REFERENCES users(id),
    UNIQUE(user_id, month)
);
CREATE INDEX IF NOT EXISTS idx_perf_snapshots_user ON performance_snapshots(user_id, month DESC);

-- ============================================================================
-- SECTION 5: Triggers
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_user_progress_pct() RETURNS TRIGGER AS $$
BEGIN
    UPDATE users SET progress_percentage = (
        SELECT COALESCE(ROUND(
            COUNT(*) FILTER (WHERE status IN ('CONDUCTED','LEAVE_APPROVED'))::NUMERIC /
            NULLIF(COUNT(*), 0) * 100, 2
        ), 0)
        FROM attendance_records
        WHERE faculty_id = NEW.faculty_id
          AND conducted_on >= DATE_TRUNC('month', CURRENT_DATE)
          AND conducted_on <  DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    )
    WHERE id = NEW.faculty_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_progress ON attendance_records;
CREATE TRIGGER trg_sync_progress
    AFTER INSERT OR UPDATE OF status ON attendance_records
    FOR EACH ROW EXECUTE FUNCTION sync_user_progress_pct();

CREATE OR REPLACE FUNCTION handle_leave_approval() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'APPROVED' AND OLD.status = 'PENDING' THEN
        UPDATE attendance_records
        SET status = 'LEAVE_APPROVED', marked_at = clock_timestamp()
        WHERE faculty_id = NEW.faculty_id
          AND conducted_on = NEW.leave_date
          AND status = 'SCHEDULED';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leave_approval ON leave_requests;
CREATE TRIGGER trg_leave_approval
    AFTER UPDATE OF status ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION handle_leave_approval();

-- ============================================================================
-- SECTION 6: Views
-- ============================================================================
CREATE OR REPLACE VIEW faculty_monthly_progress AS
SELECT
    ar.faculty_id,
    ar.organization_id,
    u.org_unit_id,
    u.name                                                       AS faculty_name,
    u.designation,
    DATE_TRUNC('month', ar.conducted_on)::DATE                  AS month,
    COUNT(*)                                                     AS total_scheduled,
    COUNT(*) FILTER (WHERE ar.status = 'CONDUCTED')             AS conducted,
    COUNT(*) FILTER (WHERE ar.status = 'LEAVE_APPROVED')        AS approved_leave,
    COUNT(*) FILTER (WHERE ar.status = 'CANCELLED')             AS cancelled,
    ROUND(
        COUNT(*) FILTER (WHERE ar.status IN ('CONDUCTED','LEAVE_APPROVED'))::NUMERIC /
        NULLIF(COUNT(*), 0) * 100, 2
    )                                                            AS progress_pct
FROM attendance_records ar
JOIN users u ON ar.faculty_id = u.id
GROUP BY ar.faculty_id, ar.organization_id, u.org_unit_id, u.name, u.designation,
         DATE_TRUNC('month', ar.conducted_on);

-- ============================================================================
-- SECTION 7: RLS - Department Data Isolation
-- ============================================================================
ALTER TABLE academic_programs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE academic_batches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE subject_assignments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable_slots       ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_snapshots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_org_wide_admin() RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = current_session_user_id()
          AND r.scope_level IN ('DIRECTOR','SYSTEM_ADMIN','FINANCE_ADMIN')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION my_dept_id() RETURNS UUID AS $$
    SELECT org_unit_id FROM users WHERE id = current_session_user_id();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_dept_lead_of(p_dept UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id = u.id
        JOIN roles r ON r.id = ur.role_id
        WHERE u.id = current_session_user_id()
          AND u.org_unit_id = p_dept
          AND r.scope_level IN ('ORG_UNIT_LEAD','DEPT_ADMIN')
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Academic programs
DROP POLICY IF EXISTS "acad_programs_select" ON academic_programs;
CREATE POLICY "acad_programs_select" ON academic_programs FOR SELECT USING (
    is_org_wide_admin() OR dept_id = my_dept_id()
);

-- Subjects
DROP POLICY IF EXISTS "subjects_select" ON subjects;
CREATE POLICY "subjects_select" ON subjects FOR SELECT USING (
    is_org_wide_admin()
    OR EXISTS (SELECT 1 FROM academic_programs ap WHERE ap.id = subjects.program_id AND ap.dept_id = my_dept_id())
);

-- Batches
DROP POLICY IF EXISTS "academic_batches_select" ON academic_batches;
CREATE POLICY "academic_batches_select" ON academic_batches FOR SELECT USING (
    is_org_wide_admin()
    OR EXISTS (SELECT 1 FROM academic_programs ap WHERE ap.id = academic_batches.program_id AND ap.dept_id = my_dept_id())
);

-- Assignments
DROP POLICY IF EXISTS "subject_assignments_select" ON subject_assignments;
CREATE POLICY "subject_assignments_select" ON subject_assignments FOR SELECT USING (
    is_org_wide_admin()
    OR faculty_id = current_session_user_id()
    OR is_dept_lead_of(my_dept_id())
);

-- Timetable
DROP POLICY IF EXISTS "timetable_slots_select" ON timetable_slots;
CREATE POLICY "timetable_slots_select" ON timetable_slots FOR SELECT USING (
    is_org_wide_admin()
    OR EXISTS (
        SELECT 1 FROM subject_assignments sa WHERE sa.id = timetable_slots.subject_assignment_id
        AND (sa.faculty_id = current_session_user_id() OR is_dept_lead_of(my_dept_id()))
    )
);

-- Attendance: self + dept HOD + admin
DROP POLICY IF EXISTS "attendance_records_select" ON attendance_records;
CREATE POLICY "attendance_records_select" ON attendance_records FOR SELECT USING (
    is_org_wide_admin()
    OR faculty_id = current_session_user_id()
    OR (is_dept_lead_of(my_dept_id())
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = attendance_records.faculty_id AND u.org_unit_id = my_dept_id()))
);

DROP POLICY IF EXISTS "attendance_records_insert" ON attendance_records;
CREATE POLICY "attendance_records_insert" ON attendance_records FOR INSERT WITH CHECK (
    faculty_id = current_session_user_id()
    OR is_dept_lead_of(my_dept_id())
    OR is_org_wide_admin()
);

DROP POLICY IF EXISTS "attendance_records_update" ON attendance_records;
CREATE POLICY "attendance_records_update" ON attendance_records FOR UPDATE USING (
    faculty_id = current_session_user_id()
    OR is_dept_lead_of(my_dept_id())
    OR is_org_wide_admin()
);

-- Leave requests
DROP POLICY IF EXISTS "leave_requests_select" ON leave_requests;
CREATE POLICY "leave_requests_select" ON leave_requests FOR SELECT USING (
    is_org_wide_admin()
    OR faculty_id = current_session_user_id()
    OR hod_id = current_session_user_id()
);

DROP POLICY IF EXISTS "leave_requests_insert" ON leave_requests;
CREATE POLICY "leave_requests_insert" ON leave_requests FOR INSERT WITH CHECK (
    faculty_id = current_session_user_id()
);

DROP POLICY IF EXISTS "leave_requests_update" ON leave_requests;
CREATE POLICY "leave_requests_update" ON leave_requests FOR UPDATE USING (
    hod_id = current_session_user_id() OR is_org_wide_admin()
);

-- Performance snapshots
DROP POLICY IF EXISTS "perf_snapshots_select" ON performance_snapshots;
CREATE POLICY "perf_snapshots_select" ON performance_snapshots FOR SELECT USING (
    is_org_wide_admin()
    OR user_id = current_session_user_id()
    OR (is_dept_lead_of(my_dept_id())
        AND EXISTS (SELECT 1 FROM users u WHERE u.id = performance_snapshots.user_id AND u.org_unit_id = my_dept_id()))
);

-- Tasks marketplace: dept-scoped OPEN tasks
DROP POLICY IF EXISTS "tasks_dept_scoped_select" ON tasks;
CREATE POLICY "tasks_dept_scoped_select" ON tasks FOR SELECT USING (
    is_org_wide_admin()
    OR assigned_to_id = current_session_user_id()
    OR creator_id     = current_session_user_id()
    OR (status = 'OPEN' AND org_unit_id = my_dept_id())
    OR (is_dept_lead_of(my_dept_id()) AND org_unit_id = my_dept_id())
);

-- ============================================================================
-- SECTION 8: Token transaction partitions (future-safe)
-- ============================================================================
CREATE TABLE IF NOT EXISTS token_transactions_y2026m09
    PARTITION OF token_transactions FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE IF NOT EXISTS token_transactions_y2026m10
    PARTITION OF token_transactions FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
CREATE TABLE IF NOT EXISTS token_transactions_y2026m11
    PARTITION OF token_transactions FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
CREATE TABLE IF NOT EXISTS token_transactions_y2026m12
    PARTITION OF token_transactions FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
CREATE TABLE IF NOT EXISTS token_transactions_y2027q1
    PARTITION OF token_transactions FOR VALUES FROM ('2027-01-01') TO ('2027-04-01');
CREATE TABLE IF NOT EXISTS token_transactions_y2027q2
    PARTITION OF token_transactions FOR VALUES FROM ('2027-04-01') TO ('2027-07-01');
CREATE TABLE IF NOT EXISTS token_transactions_y2027q3
    PARTITION OF token_transactions FOR VALUES FROM ('2027-07-01') TO ('2027-10-01');
CREATE TABLE IF NOT EXISTS token_transactions_y2027q4
    PARTITION OF token_transactions FOR VALUES FROM ('2027-10-01') TO ('2028-01-01');

-- ============================================================================
-- SECTION 9: Seed organization templates
-- ============================================================================
INSERT INTO organization_templates (key, label, default_unit_types, default_roles)
VALUES
    ('COLLEGE','College / University',
     '["Department","Programme","Section"]'::jsonb,
     '["Director","HOD","Dept Coordinator","Faculty","Finance Admin"]'::jsonb),
    ('ENTERPRISE','Enterprise / Corporate',
     '["Division","Team","Project Group"]'::jsonb,
     '["CEO/Director","Manager","Team Lead","Employee","Finance"]'::jsonb),
    ('HOSPITAL','Hospital / Healthcare',
     '["Department","Ward","Unit"]'::jsonb,
     '["CMO","Head of Dept","Coordinator","Staff","Finance"]'::jsonb),
    ('GENERIC','Generic Organization',
     '["Unit","Team","Group"]'::jsonb,
     '["Director","Lead","Admin","Member","Finance"]'::jsonb)
ON CONFLICT (key) DO UPDATE
    SET label = EXCLUDED.label,
        default_unit_types = EXCLUDED.default_unit_types,
        default_roles = EXCLUDED.default_roles;

COMMIT;

-- ============================================================================
-- VERIFY (run after COMMIT to confirm)
-- ============================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'academic_programs','subjects','academic_batches',
    'subject_assignments','timetable_slots','attendance_records',
    'leave_requests','performance_snapshots'
  )
ORDER BY table_name;
