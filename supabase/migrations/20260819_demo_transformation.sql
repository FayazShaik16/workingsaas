-- ============================================================================
-- WORKLEDGER MIGRATION: 20260819_demo_transformation.sql
-- Master Demo Transformation Patch (Idempotent, Safe to run multiple times)
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. ROLE DEDUPLICATION & UNIQUE CONSTRAINT
-- ============================================================================

-- Repoint any user_roles pointing to duplicate roles to the oldest role per (organization_id, scope_level, name)
DO $$
BEGIN
    UPDATE public.user_roles ur
    SET role_id = kept.id
    FROM (
        SELECT r_dup.id AS dup_id, r_orig.id AS id
        FROM public.roles r_dup
        JOIN (
            SELECT organization_id, scope_level, name, MIN(created_at) AS min_created_at
            FROM public.roles
            GROUP BY organization_id, scope_level, name
        ) oldest_group ON r_dup.organization_id = oldest_group.organization_id 
                      AND r_dup.scope_level = oldest_group.scope_level 
                      AND r_dup.name = oldest_group.name
        JOIN public.roles r_orig ON r_orig.organization_id = oldest_group.organization_id
                                AND r_orig.scope_level = oldest_group.scope_level
                                AND r_orig.name = oldest_group.name
                                AND r_orig.created_at = oldest_group.min_created_at
        WHERE r_dup.id != r_orig.id
    ) kept
    WHERE ur.role_id = kept.dup_id;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Role repointing notice: %', SQLERRM;
END $$;

-- Delete orphaned duplicates
DELETE FROM public.roles r USING public.roles r2
WHERE r.organization_id = r2.organization_id
  AND r.scope_level = r2.scope_level 
  AND r.name = r2.name
  AND r.created_at > r2.created_at;

-- Add or replace unique constraint on roles
DO $$
BEGIN
    ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS unique_org_role;
    ALTER TABLE public.roles DROP CONSTRAINT IF EXISTS uq_roles_org_scope_name;
    ALTER TABLE public.roles ADD CONSTRAINT uq_roles_org_scope_name UNIQUE (organization_id, scope_level, name);
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- Seed canonical roles per existing organization
DO $$
DECLARE
    org RECORD;
BEGIN
    FOR org IN SELECT id FROM public.organizations LOOP
        INSERT INTO public.roles (id, organization_id, name, scope_level, is_system_role)
        VALUES 
            (gen_random_uuid(), org.id, 'Director', 'DIRECTOR', true),
            (gen_random_uuid(), org.id, 'System Administrator', 'SYSTEM_ADMIN', true),
            (gen_random_uuid(), org.id, 'Department Admin', 'DEPT_ADMIN', true),
            (gen_random_uuid(), org.id, 'HOD / Unit Lead', 'ORG_UNIT_LEAD', true),
            (gen_random_uuid(), org.id, 'Finance Admin', 'FINANCE_ADMIN', true),
            (gen_random_uuid(), org.id, 'Faculty Member', 'MEMBER', true)
        ON CONFLICT (organization_id, scope_level, name) DO NOTHING;
    END LOOP;
END $$;

-- ============================================================================
-- 2. SINGLETON WALLETS & DEDUPLICATION
-- ============================================================================

-- Clean duplicate pool wallets keeping the oldest per org
DELETE FROM public.wallets w USING public.wallets w2
WHERE w.organization_id = w2.organization_id
  AND w.purpose = w2.purpose
  AND w.purpose IN ('SALARY_POOL', 'LOAN_POOL')
  AND w.created_at > w2.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wallet_org_pool 
ON public.wallets(organization_id, purpose) 
WHERE purpose IN ('SALARY_POOL', 'LOAN_POOL');

-- ============================================================================
-- 3. REWRITE handle_new_auth_user() TRIGGER (STOP SPURIOUS ORG CREATION)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS TRIGGER AS $$
DECLARE
    v_user_name TEXT;
    v_org_id UUID;
    v_org_unit_id UUID;
    v_director_role_id UUID;
    v_member_role_id UUID;
    v_purpose wallet_purpose;
    v_existing_user RECORD;
    v_invitation RECORD;
BEGIN
    v_user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- 1. Check if user was pre-provisioned in public.users by email
    SELECT * INTO v_existing_user
    FROM public.users
    WHERE email = NEW.email
    ORDER BY created_at ASC
    LIMIT 1;

    IF v_existing_user IS NOT NULL THEN
        -- LINK: Update auth id if different
        IF v_existing_user.id != NEW.id THEN
            UPDATE public.users 
            SET id = NEW.id,
                updated_at = NOW()
            WHERE email = NEW.email;
        END IF;

        -- Ensure PERSONAL wallet exists
        INSERT INTO public.wallets (
            organization_id,
            owner_user_id,
            purpose,
            balance,
            created_at
        ) VALUES (
            v_existing_user.organization_id,
            NEW.id,
            'PERSONAL'::wallet_purpose,
            0,
            NOW()
        ) ON CONFLICT (owner_user_id, purpose) DO NOTHING;

        RETURN NEW;
    END IF;

    -- 2. Check for pending invitation
    SELECT * INTO v_invitation
    FROM public.invitations
    WHERE email = NEW.email AND status = 'PENDING' AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_invitation IS NOT NULL THEN
        -- Link into invited org
        INSERT INTO public.users (
            id,
            organization_id,
            org_unit_id,
            email,
            name,
            employment_type,
            status,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            v_invitation.organization_id,
            v_invitation.org_unit_id,
            NEW.email,
            v_user_name,
            'FULL_TIME'::employment_type,
            'ACTIVE'::user_status,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

        IF v_invitation.intended_role_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (NEW.id, v_invitation.intended_role_id)
            ON CONFLICT DO NOTHING;
        END IF;

        INSERT INTO public.wallets (
            organization_id,
            owner_user_id,
            purpose,
            balance,
            created_at
        ) VALUES (
            v_invitation.organization_id,
            NEW.id,
            'PERSONAL'::wallet_purpose,
            0,
            NOW()
        ) ON CONFLICT (owner_user_id, purpose) DO NOTHING;

        UPDATE public.invitations
        SET status = 'ACCEPTED'
        WHERE id = v_invitation.id;

        RETURN NEW;
    END IF;

    -- 3. Check for metadata provisioned_org_id
    IF NEW.raw_user_meta_data->>'provisioned_org_id' IS NOT NULL THEN
        v_org_id := (NEW.raw_user_meta_data->>'provisioned_org_id')::UUID;
        
        INSERT INTO public.users (
            id,
            organization_id,
            org_unit_id,
            email,
            name,
            employment_type,
            status,
            created_at,
            updated_at
        ) VALUES (
            NEW.id,
            v_org_id,
            NULL,
            NEW.email,
            v_user_name,
            'FULL_TIME'::employment_type,
            'ACTIVE'::user_status,
            NOW(),
            NOW()
        ) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

        INSERT INTO public.wallets (
            organization_id,
            owner_user_id,
            purpose,
            balance,
            created_at
        ) VALUES (
            v_org_id,
            NEW.id,
            'PERSONAL'::wallet_purpose,
            0,
            NOW()
        ) ON CONFLICT (owner_user_id, purpose) DO NOTHING;

        RETURN NEW;
    END IF;

    -- 4. True self-serve founder signup
    v_org_id := gen_random_uuid();
    INSERT INTO public.organizations (
        id,
        name,
        type,
        template_key
    ) VALUES (
        v_org_id,
        v_user_name || '''s Organization',
        'COLLEGE'::organization_type,
        'COLLEGE'
    );

    v_org_unit_id := gen_random_uuid();
    INSERT INTO public.org_units (
        id,
        organization_id,
        name,
        unit_type,
        path
    ) VALUES (
        v_org_unit_id,
        v_org_id,
        'Root Unit',
        'DEPARTMENT',
        uuid_to_ltree_label(v_org_unit_id)::ltree
    );

    INSERT INTO public.users (
        id,
        organization_id,
        org_unit_id,
        email,
        name,
        employment_type,
        status,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        v_org_id,
        v_org_unit_id,
        NEW.email,
        v_user_name,
        'FULL_TIME'::employment_type,
        'ACTIVE'::user_status,
        NOW(),
        NOW()
    ) ON CONFLICT (id) DO NOTHING;

    -- Seed canonical roles for this new org
    v_director_role_id := gen_random_uuid();
    INSERT INTO public.roles (id, organization_id, name, scope_level, is_system_role)
    VALUES 
        (v_director_role_id, v_org_id, 'Director', 'DIRECTOR', true),
        (gen_random_uuid(), v_org_id, 'System Administrator', 'SYSTEM_ADMIN', true),
        (gen_random_uuid(), v_org_id, 'Department Admin', 'DEPT_ADMIN', true),
        (gen_random_uuid(), v_org_id, 'HOD / Unit Lead', 'ORG_UNIT_LEAD', true),
        (gen_random_uuid(), v_org_id, 'Finance Admin', 'FINANCE_ADMIN', true),
        (gen_random_uuid(), v_org_id, 'Faculty Member', 'MEMBER', true)
    ON CONFLICT (organization_id, scope_level, name) DO NOTHING;

    -- Assign Director role
    SELECT id INTO v_director_role_id FROM public.roles WHERE organization_id = v_org_id AND scope_level = 'DIRECTOR' LIMIT 1;
    INSERT INTO public.user_roles (user_id, role_id)
    VALUES (NEW.id, v_director_role_id)
    ON CONFLICT DO NOTHING;

    -- Create singletons SALARY_POOL, LOAN_POOL, and PERSONAL wallet
    FOREACH v_purpose IN ARRAY ARRAY['PERSONAL', 'SALARY_POOL', 'LOAN_POOL']::wallet_purpose[] LOOP
        INSERT INTO public.wallets (
            organization_id,
            owner_user_id,
            purpose,
            balance,
            created_at
        ) VALUES (
            v_org_id,
            NEW.id,
            v_purpose,
            0,
            NOW()
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. TASK POOL VISIBILITY SCOPING & SCHEMA ENHANCEMENTS
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'visibility_scope') THEN
        ALTER TABLE public.tasks ADD COLUMN visibility_scope TEXT NOT NULL DEFAULT 'ORG_UNIT' CHECK (visibility_scope IN ('ORGANIZATION', 'ORG_UNIT'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'timetable_slots' AND column_name = 'task_type_code') THEN
        ALTER TABLE public.timetable_slots ADD COLUMN task_type_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'timetable_slots' AND column_name = 'faculty_id') THEN
        ALTER TABLE public.timetable_slots ADD COLUMN faculty_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    -- Relax subject_assignment_id requirement for non-teaching slots
    ALTER TABLE public.timetable_slots ALTER COLUMN subject_assignment_id DROP NOT NULL;
END $$;

-- ============================================================================
-- 5. RATE CARD & TASK TYPE SEEDING
-- ============================================================================

DO $$
DECLARE
    org RECORD;
    v_rc_id UUID;
BEGIN
    FOR org IN SELECT id FROM public.organizations LOOP
        -- Seed rate card version
        INSERT INTO public.rate_card_versions (
            id, organization_id, version_label, academic_year, effective_from, is_locked
        ) VALUES (
            gen_random_uuid(), org.id, 'AY-2025-2026-V1', '2025-2026', CURRENT_DATE, false
        )
        ON CONFLICT (organization_id, version_label) DO UPDATE SET is_locked = EXCLUDED.is_locked
        RETURNING id INTO v_rc_id;

        IF v_rc_id IS NULL THEN
            SELECT id INTO v_rc_id FROM public.rate_card_versions WHERE organization_id = org.id LIMIT 1;
        END IF;

        -- Seed standard task types
        INSERT INTO public.task_type_definitions (
            id, organization_id, rate_card_version_id, category, code, key, label, default_credit_value, verification_mode, requires_peer_review, is_active
        ) VALUES
            (gen_random_uuid(), org.id, v_rc_id, 'STRUCTURED', 'TEACHING_LECTURE', 'teaching_lecture', 'Theory Lecture', 1.0000, 'ATTENDANCE_COUNT'::verification_mode, false, true),
            (gen_random_uuid(), org.id, v_rc_id, 'STRUCTURED', 'TEACHING_LAB', 'teaching_lab', 'Practical Lab Session', 1.5000, 'ATTENDANCE_COUNT'::verification_mode, false, true),
            (gen_random_uuid(), org.id, v_rc_id, 'STRUCTURED', 'TUTORIAL', 'tutorial', 'Tutorial Period', 0.5000, 'METRIC_INPUT'::verification_mode, false, true),
            (gen_random_uuid(), org.id, v_rc_id, 'STRUCTURED', 'CLASS_PREP', 'class_prep', 'Class Preparation', 0.5000, 'METRIC_INPUT'::verification_mode, false, true),
            (gen_random_uuid(), org.id, v_rc_id, 'STRUCTURED', 'CO_CURRICULAR', 'co_curricular', 'Co-Curricular / Mentoring', 0.5000, 'METRIC_INPUT'::verification_mode, false, true),
            (gen_random_uuid(), org.id, v_rc_id, 'STRUCTURED', 'TEST_INVIGILATION', 'test_invigilation', 'Examination Invigilation', 0.7500, 'METRIC_INPUT'::verification_mode, false, true),
            (gen_random_uuid(), org.id, v_rc_id, 'STRUCTURED', 'ADMIN_ASSIST', 'admin_assist', 'Administrative Assistance', 0.5000, 'METRIC_INPUT'::verification_mode, false, true),
            (gen_random_uuid(), org.id, v_rc_id, 'UNSTRUCTURED', 'UNSTRUCTURED_GENERIC', 'unstructured_generic', 'Ad-Hoc Initiative', 2.0000, 'PROOF_UPLOAD'::verification_mode, false, true)
        ON CONFLICT (organization_id, key) DO UPDATE SET 
            default_credit_value = EXCLUDED.default_credit_value,
            code = EXCLUDED.code;
    END LOOP;
END $$;

-- ============================================================================
-- 6. SALARY ELIGIBILITY & PROGRESS COMPUTATION (SINGLE SOURCE OF TRUTH)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.recompute_user_progress(p_user_id UUID) 
RETURNS NUMERIC AS $$
DECLARE
    v_earned NUMERIC(10,2) := 0;
    v_target NUMERIC(10,2) := 50.00;
    v_pct NUMERIC(5,2) := 0.00;
BEGIN
    -- Sum all earned credits from terminal verified states
    -- 1. Tasks in terminal credited state (CLOSED, LEAD_SIGNED)
    SELECT COALESCE(SUM(credit_value), 0) INTO v_earned
    FROM public.tasks
    WHERE assigned_to_id = p_user_id
      AND status IN ('CLOSED', 'LEAD_SIGNED');

    -- Get user target credits baseline
    SELECT COALESCE(target_credits, 50.00) INTO v_target
    FROM public.users
    WHERE id = p_user_id;

    IF v_target > 0 THEN
        v_pct := LEAST(100.00, ROUND((v_earned / v_target) * 100.0, 2));
    ELSE
        v_pct := 0.00;
    END IF;

    UPDATE public.users
    SET progress_percentage = v_pct,
        updated_at = NOW()
    WHERE id = p_user_id;

    RETURN v_pct;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.check_salary_eligibility(
    p_user_id UUID,
    p_year INT DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INT,
    p_month INT DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INT
) RETURNS JSONB AS $$
DECLARE
    v_earned NUMERIC(10,2) := 0;
    v_target NUMERIC(10,2) := 50.00;
    v_structured_earned NUMERIC(10,2) := 0;
    v_unstructured_earned NUMERIC(10,2) := 0;
    v_has_verified_unstructured BOOLEAN := false;
    v_progress_pct NUMERIC(5,2) := 0.00;
    v_eligible BOOLEAN := false;
BEGIN
    -- 1. Get user target baseline
    SELECT COALESCE(target_credits, 50.00) INTO v_target
    FROM public.users
    WHERE id = p_user_id;

    -- 2. Sum structured earned credits
    SELECT COALESCE(SUM(credit_value), 0) INTO v_structured_earned
    FROM public.tasks
    WHERE assigned_to_id = p_user_id
      AND category = 'STRUCTURED'
      AND status IN ('CLOSED', 'LEAD_SIGNED');

    -- 3. Sum unstructured earned credits & check count
    SELECT COALESCE(SUM(credit_value), 0), COUNT(*) > 0 
    INTO v_unstructured_earned, v_has_verified_unstructured
    FROM public.tasks
    WHERE assigned_to_id = p_user_id
      AND category = 'UNSTRUCTURED'
      AND status IN ('CLOSED', 'LEAD_SIGNED');

    v_earned := v_structured_earned + v_unstructured_earned;

    IF v_target > 0 THEN
        v_progress_pct := LEAST(100.00, ROUND((v_earned / v_target) * 100.0, 2));
    ELSE
        v_progress_pct := 0.00;
    END IF;

    -- Rule: earned >= 85% of target AND at least 1 verified unstructured task
    IF (v_earned >= 0.85 * v_target) AND (v_has_verified_unstructured = true) THEN
        v_eligible := true;
    ELSE
        v_eligible := false;
    END IF;

    RETURN jsonb_build_object(
        'eligible', v_eligible,
        'progress_pct', v_progress_pct,
        'earned', v_earned,
        'target', v_target,
        'structured_earned', v_structured_earned,
        'unstructured_earned', v_unstructured_earned,
        'has_verified_unstructured', v_has_verified_unstructured
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. TIMETABLE COMPILER RPC WITH 75/25 MODEL
-- ============================================================================

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
    v_structured_credits NUMERIC(10,2) := 0;
    v_computed_target NUMERIC(10,2) := 50.00;
    v_org_unit_id UUID;
BEGIN
    v_start_date := MAKE_DATE(p_year, p_month, 1);
    v_end_date := (v_start_date + INTERVAL '1 month - 1 day')::DATE;

    SELECT org_unit_id INTO v_org_unit_id FROM public.users WHERE id = p_faculty_id;

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
                    ts.task_type_code,
                    sa.batch_id,
                    sa.subject_id,
                    COALESCE(s.name, ts.task_type_code, 'Scheduled Activity') AS activity_title,
                    COALESCE(s.code, 'ACT') AS activity_code,
                    COALESCE(s.subject_type, 'THEORY') AS activity_type,
                    COALESCE(ttd.id, (
                        SELECT id FROM public.task_type_definitions 
                        WHERE organization_id = p_organization_id AND category = 'STRUCTURED' 
                        LIMIT 1
                    )) AS resolved_task_type_id,
                    COALESCE(ttd.default_credit_value, 1.0000) AS slot_credit
                FROM public.timetable_slots ts
                LEFT JOIN public.subject_assignments sa ON ts.subject_assignment_id = sa.id
                LEFT JOIN public.subjects s ON sa.subject_id = s.id
                LEFT JOIN public.task_type_definitions ttd ON ttd.organization_id = p_organization_id 
                    AND (ttd.code = ts.task_type_code OR (ts.task_type_code IS NULL AND ttd.code = 'TEACHING_LECTURE'))
                WHERE (sa.faculty_id = p_faculty_id OR ts.faculty_id = p_faculty_id)
                  AND ts.organization_id = p_organization_id
                  AND (sa.is_active IS NULL OR sa.is_active = true)
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
                    visibility_scope,
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
                    'ORG_UNIT',
                    v_slot.activity_code || ' - ' || v_slot.activity_title || ' (Period ' || v_slot.period_number || ')',
                    'Scheduled ' || v_slot.activity_type || ' session on ' || v_curr_date::TEXT || ' in ' || COALESCE(v_slot.room, 'Room'),
                    v_slot.slot_credit,
                    p_faculty_id,
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

                v_structured_credits := v_structured_credits + v_slot.slot_credit;
            END LOOP;
        END IF;

        v_curr_date := v_curr_date + 1;
    END LOOP;

    -- 75/25 Model: Target = S / 0.75 (Structured work is 75%, dynamic work is 25%)
    IF v_structured_credits > 0 THEN
        v_computed_target := ROUND((v_structured_credits / 0.75), 2);
    ELSE
        SELECT COALESCE(monthly_target_credits, 50.00) INTO v_computed_target
        FROM public.compensation_policies
        WHERE organization_id = p_organization_id AND scope_type = 'ORG_WIDE'
        LIMIT 1;
        IF v_computed_target IS NULL THEN v_computed_target := 50.00; END IF;
    END IF;

    UPDATE public.users 
    SET target_credits = v_computed_target,
        updated_at = NOW()
    WHERE id = p_faculty_id;

    -- Trigger progress recomputation
    PERFORM public.recompute_user_progress(p_faculty_id);

    RETURN jsonb_build_object(
        'success', true,
        'faculty_id', p_faculty_id,
        'month', p_month,
        'year', p_year,
        'tasks_created', v_tasks_created,
        'structured_credits', v_structured_credits,
        'target_credits', v_computed_target
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
