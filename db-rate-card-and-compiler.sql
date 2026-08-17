-- ============================================================================
-- WORKLEDGER PATCH v4.3: Rate Card Engine, Denominator Baseline & Timetable Compiler
-- Safe, additive-only migration. Preserves all existing columns, tables, and views.
-- ============================================================================
BEGIN;

-- 1. Rate Card Versions (First-Class Governed & Versioned Pricing Object)
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

-- Enable RLS
ALTER TABLE public.rate_card_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS rate_card_versions_scope ON public.rate_card_versions;
CREATE POLICY rate_card_versions_scope ON public.rate_card_versions FOR ALL USING (
    organization_id = get_jwt_session_org_id()
);

-- 2. Additive columns on task_type_definitions without dropping anything
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_type_definitions' AND column_name = 'rate_card_version_id') THEN
        ALTER TABLE public.task_type_definitions ADD COLUMN rate_card_version_id UUID REFERENCES public.rate_card_versions(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'task_type_definitions' AND column_name = 'code') THEN
        ALTER TABLE public.task_type_definitions ADD COLUMN code TEXT;
    END IF;
END $$;

-- 3. Additive columns & Deduplication Constraint on tasks for recurring timetable compilation
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

-- Deduplication index to enforce strict idempotency on compiler runs
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_recurring_slot_date 
ON public.tasks(organization_id, source_timetable_slot_id, scheduled_date) 
WHERE source_timetable_slot_id IS NOT NULL AND scheduled_date IS NOT NULL;

-- 4. Additive target_credits on users table (the stored baseline denominator)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'target_credits') THEN
        ALTER TABLE public.users ADD COLUMN target_credits NUMERIC(10,2) DEFAULT 50.00;
    END IF;
END $$;

-- 5. Compile Cycle Tasks Function (Idempotent Generator)
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
    -- Derive month boundaries
    v_start_date := MAKE_DATE(p_year, p_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

    -- Get faculty org unit
    SELECT org_unit_id INTO v_org_unit_id FROM public.users WHERE id = p_faculty_id;
    v_creator_id := p_faculty_id;

    -- Iterate over each day of the month
    v_curr_date := v_start_date;
    WHILE v_curr_date <= v_end_date LOOP
        -- Map day of week to 3-char string
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
            -- Find all active slots for this faculty on this day of the week
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
                -- Insert recurring task idempotently
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

    -- Update user target credits baseline (structured + unstructured quota)
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

-- 6. Batch compile for all faculty in an organization
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
