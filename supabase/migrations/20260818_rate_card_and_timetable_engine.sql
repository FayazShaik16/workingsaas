-- ============================================================================
-- WORKLEDGER MIGRATION: Phase 1 Rate Card Engine, Timetable Matrix & Dynamic Denominator
-- Version: 20260818_rate_card_and_timetable_engine.sql
-- Description: Establishes versioned rate cards, academic curriculum entities,
--              weekly timetable slots, classroom attendance verification records,
--              and the deterministic cycle task compiler.
-- ============================================================================

BEGIN;

-- 1. Helper function for UUIDv7 generation if not present
CREATE OR REPLACE FUNCTION public.generate_uuid_v7()
RETURNS UUID AS $$
DECLARE
    v_time DOUBLE PRECISION := EXTRACT(EPOCH FROM clock_timestamp());
    v_msec BIGINT := FLOOR(v_time * 1000.0);
    v_bytes BYTEA;
BEGIN
    v_bytes := set_byte(
        set_byte(
            gen_random_bytes(16),
            6,
            (get_byte(gen_random_bytes(1), 0) & 15) | 112
        ),
        8,
        (get_byte(gen_random_bytes(1), 0) & 63) | 128
    );
    v_bytes := set_byte(v_bytes, 0, ((v_msec >> 40) & 255)::INT);
    v_bytes := set_byte(v_bytes, 1, ((v_msec >> 32) & 255)::INT);
    v_bytes := set_byte(v_bytes, 2, ((v_msec >> 24) & 255)::INT);
    v_bytes := set_byte(v_bytes, 3, ((v_msec >> 16) & 255)::INT);
    v_bytes := set_byte(v_bytes, 4, ((v_msec >> 8) & 255)::INT);
    v_bytes := set_byte(v_bytes, 5, (v_msec & 255)::INT);
    RETURN encode(v_bytes, 'hex')::UUID;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Versioned Rate Card Header (Governed & Locked per Semester)
CREATE TABLE IF NOT EXISTS public.rate_card_versions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    version_label TEXT NOT NULL, -- e.g. 'AY-2025-2026-ODD-V1'
    academic_year TEXT NOT NULL,  -- e.g. '2025-2026'
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_locked BOOLEAN NOT NULL DEFAULT false,
    locked_by UUID REFERENCES public.users(id),
    locked_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_org_rate_version UNIQUE(organization_id, version_label)
);

ALTER TABLE public.rate_card_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rate_card_versions_scope ON public.rate_card_versions;
CREATE POLICY rate_card_versions_scope ON public.rate_card_versions FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

-- 3. Enhance task_type_definitions with rate card linking and validation mode
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_type_definitions' AND column_name = 'rate_card_version_id') THEN
        ALTER TABLE public.task_type_definitions ADD COLUMN rate_card_version_id UUID REFERENCES public.rate_card_versions(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_type_definitions' AND column_name = 'code') THEN
        ALTER TABLE public.task_type_definitions ADD COLUMN code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_type_definitions' AND column_name = 'validation_mode') THEN
        ALTER TABLE public.task_type_definitions ADD COLUMN validation_mode TEXT DEFAULT 'ATTENDANCE_COUNT';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_type_definitions' AND column_name = 'requires_peer_review') THEN
        ALTER TABLE public.task_type_definitions ADD COLUMN requires_peer_review BOOLEAN DEFAULT false;
    END IF;
END $$;

-- 4. Academic Curriculum & Program Hierarchy
CREATE TABLE IF NOT EXISTS public.academic_programs (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    dept_id UUID REFERENCES public.org_units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.academic_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS academic_programs_scope ON public.academic_programs;
CREATE POLICY academic_programs_scope ON public.academic_programs FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

CREATE TABLE IF NOT EXISTS public.academic_batches (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.academic_programs(id) ON DELETE CASCADE,
    year_of_study INT NOT NULL CHECK (year_of_study BETWEEN 1 AND 5),
    current_semester INT NOT NULL CHECK (current_semester BETWEEN 1 AND 10),
    section TEXT NOT NULL,
    student_count INT NOT NULL DEFAULT 60,
    academic_year TEXT NOT NULL DEFAULT '2025-2026',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.academic_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS academic_batches_scope ON public.academic_batches;
CREATE POLICY academic_batches_scope ON public.academic_batches FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

CREATE TABLE IF NOT EXISTS public.subjects (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    program_id UUID NOT NULL REFERENCES public.academic_programs(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    credits INT NOT NULL DEFAULT 3,
    subject_type TEXT NOT NULL DEFAULT 'THEORY' CHECK (subject_type IN ('THEORY', 'LAB', 'PROJECT', 'SEMINAR')),
    semester INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subjects_scope ON public.subjects;
CREATE POLICY subjects_scope ON public.subjects FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

CREATE TABLE IF NOT EXISTS public.subject_assignments (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES public.academic_batches(id) ON DELETE CASCADE,
    academic_year TEXT NOT NULL DEFAULT '2025-2026',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.subject_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS subject_assignments_scope ON public.subject_assignments;
CREATE POLICY subject_assignments_scope ON public.subject_assignments FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

CREATE TABLE IF NOT EXISTS public.timetable_slots (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    subject_assignment_id UUID NOT NULL REFERENCES public.subject_assignments(id) ON DELETE CASCADE,
    task_type_id UUID REFERENCES public.task_type_definitions(id),
    day_of_week TEXT NOT NULL CHECK (day_of_week IN ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
    period_number INT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    room TEXT,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE public.timetable_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS timetable_slots_scope ON public.timetable_slots;
CREATE POLICY timetable_slots_scope ON public.timetable_slots FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

-- 5. Classroom Attendance Verification Records
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    timetable_slot_id UUID NOT NULL REFERENCES public.timetable_slots(id) ON DELETE CASCADE,
    faculty_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    class_date DATE NOT NULL,
    students_present INT NOT NULL,
    students_absent INT NOT NULL,
    topics_covered TEXT,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'VERIFIED', 'REJECTED')),
    verified_by UUID REFERENCES public.users(id),
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_slot_attendance_date UNIQUE(timetable_slot_id, class_date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS attendance_records_scope ON public.attendance_records;
CREATE POLICY attendance_records_scope ON public.attendance_records FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

-- 6. Additive columns and deduplication index on tasks table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'source_timetable_slot_id') THEN
        ALTER TABLE public.tasks ADD COLUMN source_timetable_slot_id UUID REFERENCES public.timetable_slots(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'scheduled_date') THEN
        ALTER TABLE public.tasks ADD COLUMN scheduled_date DATE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'academic_batch_id') THEN
        ALTER TABLE public.tasks ADD COLUMN academic_batch_id UUID REFERENCES public.academic_batches(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'subject_id') THEN
        ALTER TABLE public.tasks ADD COLUMN subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurring_slot_date 
ON public.tasks(organization_id, source_timetable_slot_id, scheduled_date) 
WHERE source_timetable_slot_id IS NOT NULL AND scheduled_date IS NOT NULL;

-- 7. Target credits column on users table (the stored baseline denominator)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'target_credits') THEN
        ALTER TABLE public.users ADD COLUMN target_credits NUMERIC(10,2) DEFAULT 50.00;
    END IF;
END $$;

-- 8. Stored Procedure: Idempotent Cycle Task Generator for a Faculty Member
CREATE OR REPLACE FUNCTION public.compile_cycle_tasks_for_faculty(
    p_organization_id UUID,
    p_faculty_id UUID,
    p_year INT,
    p_month INT
) RETURNS JSONB AS $$
DECLARE
    v_start_date DATE;
    v_end_date DATE;
    v_curr_date DATE;
    v_dow_name TEXT;
    v_slot RECORD;
    v_tasks_created INT := 0;
    v_total_credits NUMERIC(10,2) := 0;
    v_unstructured_quota NUMERIC(10,2) := 10.00; -- Baseline expectation for ad-hoc initiatives
    v_org_unit_id UUID;
    v_creator_id UUID;
BEGIN
    v_start_date := MAKE_DATE(p_year, p_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

    SELECT org_unit_id INTO v_org_unit_id FROM public.users WHERE id = p_faculty_id;
    v_creator_id := p_faculty_id;

    v_curr_date := v_start_date;
    WHILE v_curr_date <= v_end_date LOOP
        v_dow_name := CASE EXTRACT(DOW FROM v_curr_date)
            WHEN 1 THEN 'MON'
            WHEN 2 THEN 'TUE'
            WHEN 3 THEN 'WED'
            WHEN 4 THEN 'THU'
            WHEN 5 THEN 'FRI'
            WHEN 6 THEN 'SAT'
            ELSE 'SUN'
        END;

        IF v_dow_name != 'SUN' THEN
            FOR v_slot IN 
                SELECT 
                    ts.id AS slot_id,
                    ts.period_number,
                    ts.start_time,
                    ts.end_time,
                    ts.room,
                    sa.batch_id,
                    sa.subject_id,
                    s.name AS subject_name,
                    s.code AS subject_code,
                    s.subject_type,
                    COALESCE(ttd.id, (
                        SELECT id FROM public.task_type_definitions 
                        WHERE organization_id = p_organization_id AND category = 'STRUCTURED' 
                        LIMIT 1
                    )) AS resolved_task_type_id,
                    COALESCE(ttd.default_credit_value, 1.0000) AS slot_credit
                FROM public.timetable_slots ts
                JOIN public.subject_assignments sa ON ts.subject_assignment_id = sa.id
                JOIN public.subjects s ON sa.subject_id = s.id
                LEFT JOIN public.task_type_definitions ttd ON ttd.organization_id = p_organization_id 
                    AND ttd.category = 'STRUCTURED'
                WHERE sa.faculty_id = p_faculty_id
                  AND sa.organization_id = p_organization_id
                  AND sa.is_active = true
                  AND ts.is_active = true
                  AND ts.day_of_week::TEXT = v_dow_name
                  AND v_curr_date >= ts.effective_from
                  AND (ts.effective_to IS NULL OR v_curr_date <= ts.effective_to)
            LOOP
                INSERT INTO public.tasks (
                    organization_id,
                    org_unit_id,
                    task_type_id,
                    category,
                    title,
                    description,
                    credit_value,
                    creator_id,
                    assigned_to_id,
                    status,
                    source_timetable_slot_id,
                    scheduled_date,
                    academic_batch_id,
                    subject_id,
                    deadline
                ) VALUES (
                    p_organization_id,
                    v_org_unit_id,
                    v_slot.resolved_task_type_id,
                    'STRUCTURED',
                    v_slot.subject_code || ' - ' || v_slot.subject_name || ' (Period ' || v_slot.period_number || ')',
                    'Scheduled ' || v_slot.subject_type || ' session on ' || v_curr_date::TEXT || ' in ' || COALESCE(v_slot.room, 'Classroom'),
                    v_slot.slot_credit,
                    v_creator_id,
                    p_faculty_id,
                    'ASSIGNED',
                    v_slot.slot_id,
                    v_curr_date,
                    v_slot.batch_id,
                    v_slot.subject_id,
                    (v_curr_date || ' ' || v_slot.end_time)::TIMESTAMPTZ
                )
                ON CONFLICT (organization_id, source_timetable_slot_id, scheduled_date) 
                WHERE source_timetable_slot_id IS NOT NULL AND scheduled_date IS NOT NULL
                DO NOTHING;

                IF FOUND THEN
                    v_tasks_created := v_tasks_created + 1;
                END IF;

                v_total_credits := v_total_credits + v_slot.slot_credit;
            END LOOP;
        END IF;

        v_curr_date := v_curr_date + 1;
    END LOOP;

    -- Update user target credits baseline (structured baseline + unstructured quota)
    IF v_total_credits > 0 THEN
        UPDATE public.users 
        SET target_credits = (v_total_credits + v_unstructured_quota),
            updated_at = NOW()
        WHERE id = p_faculty_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'faculty_id', p_faculty_id,
        'month', p_month,
        'year', p_year,
        'tasks_created', v_tasks_created,
        'structured_credits', v_total_credits,
        'target_credits', (v_total_credits + v_unstructured_quota)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Stored Procedure: Batch Compile for Entire Organization
CREATE OR REPLACE FUNCTION public.compile_cycle_tasks_for_all(
    p_organization_id UUID,
    p_year INT,
    p_month INT
) RETURNS JSONB AS $$
DECLARE
    v_fac RECORD;
    v_total_processed INT := 0;
    v_results JSONB := '[]'::JSONB;
    v_res JSONB;
BEGIN
    FOR v_fac IN 
        SELECT DISTINCT sa.faculty_id
        FROM public.subject_assignments sa
        WHERE sa.organization_id = p_organization_id AND sa.is_active = true
    LOOP
        v_res := public.compile_cycle_tasks_for_faculty(p_organization_id, v_fac.faculty_id, p_year, p_month);
        v_results := v_results || v_res;
        v_total_processed := v_total_processed + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_organization_id,
        'faculty_count', v_total_processed,
        'details', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
