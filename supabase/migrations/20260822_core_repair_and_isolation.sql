-- ============================================================================
-- WorkLedger: Final Core Repair, Department Isolation & Default Task Types
-- Migration: 20260822_core_repair_and_isolation.sql
-- ============================================================================

-- 1. Task Target Org Units Table (for Director-targeted organization tasks)
CREATE TABLE IF NOT EXISTS public.task_target_org_units (
    task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
    org_unit_id UUID NOT NULL REFERENCES public.org_units(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (task_id, org_unit_id)
);
CREATE INDEX IF NOT EXISTS idx_task_target_org_units_unit ON public.task_target_org_units(org_unit_id);

-- 2. Ensure verification_mode column exists on tasks and task_type_definitions
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS verification_mode TEXT NOT NULL DEFAULT 'MANUAL_REPORT' CHECK (verification_mode IN ('MANUAL_REPORT', 'FILE_SUBMISSION'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL DEFAULT 'ORGANIZATION' CHECK (visibility_scope IN ('ORGANIZATION', 'ORG_UNIT'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allow_nomination BOOLEAN NOT NULL DEFAULT true;

-- 3. Unique constraint on nominations to prevent duplicate self-nominations
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_nominations_task_user'
    ) THEN
        ALTER TABLE public.nominations ADD CONSTRAINT uq_nominations_task_user UNIQUE (task_id, user_id);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 4. Unique constraint on task_type_definitions
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_task_type_org_category_name'
    ) THEN
        ALTER TABLE public.task_type_definitions ADD CONSTRAINT uq_task_type_org_category_name UNIQUE (organization_id, category, name);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 5. Stored Procedure: Get or Create Default UNSTRUCTURED Task Type
CREATE OR REPLACE FUNCTION public.get_or_create_default_task_type(
    p_org_id UUID
) RETURNS UUID AS $$
DECLARE
    v_type_id UUID;
BEGIN
    -- 1. Try to find existing unstructured task type
    SELECT id INTO v_type_id
    FROM public.task_type_definitions
    WHERE organization_id = p_org_id AND category = 'UNSTRUCTURED'
    LIMIT 1;

    IF v_type_id IS NOT NULL THEN
        RETURN v_type_id;
    END IF;

    -- 2. Insert default unstructured task type
    INSERT INTO public.task_type_definitions (
        organization_id,
        name,
        category,
        default_credit_value,
        requires_proof,
        active
    ) VALUES (
        p_org_id,
        'Unstructured Initiative',
        'UNSTRUCTURED',
        1.0,
        true,
        true
    )
    ON CONFLICT (organization_id, category, name) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_type_id;

    RETURN v_type_id;
EXCEPTION WHEN OTHERS THEN
    -- Fallback in case of race condition
    SELECT id INTO v_type_id
    FROM public.task_type_definitions
    WHERE organization_id = p_org_id AND category = 'UNSTRUCTURED'
    LIMIT 1;
    RETURN v_type_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Helper Function: Preview Legacy Setup Cleanup (Main/Root/General departments)
CREATE OR REPLACE FUNCTION public.preview_legacy_setup_cleanup(
    p_org_id UUID
) RETURNS TABLE (
    unit_id UUID,
    unit_name TEXT,
    unit_type TEXT,
    linked_users_count BIGINT,
    linked_tasks_count BIGINT,
    can_auto_delete BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id AS unit_id,
        u.name AS unit_name,
        u.unit_type,
        COUNT(DISTINCT usr.id) AS linked_users_count,
        COUNT(DISTINCT t.id) AS linked_tasks_count,
        (COUNT(DISTINCT usr.id) = 0 AND COUNT(DISTINCT t.id) = 0) AS can_auto_delete
    FROM public.org_units u
    LEFT JOIN public.users usr ON usr.org_unit_id = u.id
    LEFT JOIN public.tasks t ON t.org_unit_id = u.id
    WHERE u.organization_id = p_org_id
      AND lower(trim(u.name)) IN ('main', 'root', 'general', 'main department', 'root department')
    GROUP BY u.id, u.name, u.unit_type;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
