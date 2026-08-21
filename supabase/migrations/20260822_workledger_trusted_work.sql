-- ============================================================================
-- WorkLedger: Trusted Work-Organization, Progress, Evidence & Settlement Engine
-- Migration: 20260822_workledger_trusted_work.sql
-- ============================================================================

-- 1. Ensure required extensions & helper functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Unique constraint on roles table to prevent duplicate tenant roles
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_roles_org_scope_name'
    ) THEN
        ALTER TABLE public.roles ADD CONSTRAINT uq_roles_org_scope_name UNIQUE (organization_id, scope_level, name);
    END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Work Cycles Table
CREATE TABLE IF NOT EXISTS public.work_cycles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    starts_on DATE NOT NULL,
    ends_on DATE NOT NULL,
    scheduled_weight_percentage NUMERIC NOT NULL DEFAULT 75 CHECK (scheduled_weight_percentage > 0 AND scheduled_weight_percentage < 100),
    salary_threshold_percentage NUMERIC NOT NULL DEFAULT 85 CHECK (salary_threshold_percentage >= 0 AND salary_threshold_percentage <= 100),
    salary_request_opens_day INTEGER NOT NULL DEFAULT 26 CHECK (salary_request_opens_day BETWEEN 1 AND 31),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'CLOSED')),
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_work_cycles_dates CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS idx_work_cycles_org_status ON public.work_cycles(organization_id, status);

-- 3. Scheduled Work Templates (Weekly Recurring Definitions)
CREATE TABLE IF NOT EXISTS public.scheduled_work_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    org_unit_id UUID REFERENCES public.org_units(id) ON DELETE SET NULL,
    assigned_to_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    work_cycle_id UUID NOT NULL REFERENCES public.work_cycles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    weekly_day TEXT NOT NULL CHECK (weekly_day IN ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT')),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    credit_value NUMERIC NOT NULL CHECK (credit_value > 0),
    active BOOLEAN NOT NULL DEFAULT true,
    source TEXT NOT NULL DEFAULT 'MANUAL' CHECK (source IN ('MANUAL', 'XLSX_IMPORT')),
    source_reference TEXT,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_scheduled_work_template UNIQUE (organization_id, assigned_to_id, work_cycle_id, weekly_day, start_time, end_time, title)
);
CREATE INDEX IF NOT EXISTS idx_sched_templates_faculty ON public.scheduled_work_templates(organization_id, assigned_to_id, work_cycle_id);

-- 4. Scheduled Work Instances (Dated Sessions)
CREATE TABLE IF NOT EXISTS public.scheduled_work_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    template_id UUID NOT NULL REFERENCES public.scheduled_work_templates(id) ON DELETE CASCADE,
    assigned_to_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    work_cycle_id UUID NOT NULL REFERENCES public.work_cycles(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    scheduled_start TIMESTAMPTZ NOT NULL,
    scheduled_end TIMESTAMPTZ NOT NULL,
    credit_value NUMERIC NOT NULL CHECK (credit_value > 0),
    status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'AVAILABLE', 'SELF_COMPLETED', 'FLAGGED', 'CANCELLED')),
    self_completed_at TIMESTAMPTZ,
    self_completed_by UUID REFERENCES public.users(id),
    hod_review_status TEXT NOT NULL DEFAULT 'NOT_REVIEWED' CHECK (hod_review_status IN ('NOT_REVIEWED', 'ACKNOWLEDGED', 'FLAGGED')),
    hod_reviewed_by UUID REFERENCES public.users(id),
    hod_reviewed_at TIMESTAMPTZ,
    hod_review_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_scheduled_work_instance UNIQUE (template_id, work_date)
);
CREATE INDEX IF NOT EXISTS idx_sched_instances_faculty_date ON public.scheduled_work_instances(organization_id, assigned_to_id, work_date);

-- 5. Scheduled Work Completions (Append-Only Audit)
CREATE TABLE IF NOT EXISTS public.scheduled_work_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    instance_id UUID NOT NULL REFERENCES public.scheduled_work_instances(id) ON DELETE CASCADE UNIQUE,
    faculty_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    confirmation_1_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmation_2_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    credit_value NUMERIC NOT NULL CHECK (credit_value > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sched_completions_faculty ON public.scheduled_work_completions(organization_id, faculty_id);

-- 6. Credit Ledger Entries (IMMUTABLE SINGLE SOURCE OF TRUTH)
CREATE TABLE IF NOT EXISTS public.credit_ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    work_cycle_id UUID NOT NULL REFERENCES public.work_cycles(id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    credit_type TEXT NOT NULL CHECK (credit_type IN ('STRUCTURED_SELF_COMPLETION', 'UNSTRUCTURED_APPROVAL', 'MANUAL_ADJUSTMENT', 'REVERSAL')),
    amount NUMERIC NOT NULL,
    source_entity_type TEXT NOT NULL,
    source_entity_id UUID NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_by UUID REFERENCES public.users(id),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_month ON public.credit_ledger_entries(organization_id, user_id, work_cycle_id, month_start);

-- 7. Monthly Work Progress (Materialized Atomic Summary)
CREATE TABLE IF NOT EXISTS public.monthly_work_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    work_cycle_id UUID NOT NULL REFERENCES public.work_cycles(id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    scheduled_target_credits NUMERIC NOT NULL DEFAULT 0,
    total_target_credits NUMERIC NOT NULL DEFAULT 0,
    scheduled_earned_credits NUMERIC NOT NULL DEFAULT 0,
    unscheduled_earned_credits NUMERIC NOT NULL DEFAULT 0,
    raw_earned_credits NUMERIC NOT NULL DEFAULT 0,
    display_progress_percentage NUMERIC NOT NULL DEFAULT 0,
    salary_eligible BOOLEAN NOT NULL DEFAULT false,
    salary_request_status TEXT NOT NULL DEFAULT 'NOT_OPEN' CHECK (salary_request_status IN ('NOT_OPEN', 'AVAILABLE', 'REQUESTED', 'HOD_APPROVED', 'REJECTED', 'ON_CHAIN_CONFIRMED')),
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_monthly_work_progress UNIQUE (organization_id, user_id, work_cycle_id, month_start)
);
CREATE INDEX IF NOT EXISTS idx_monthly_progress_user ON public.monthly_work_progress(organization_id, user_id, work_cycle_id, month_start);

-- 8. Salary Requests
CREATE TABLE IF NOT EXISTS public.salary_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    work_cycle_id UUID NOT NULL REFERENCES public.work_cycles(id) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    requested_raw_credits NUMERIC NOT NULL DEFAULT 0,
    requested_target_credits NUMERIC NOT NULL DEFAULT 0,
    threshold_percentage NUMERIC NOT NULL DEFAULT 85,
    status TEXT NOT NULL DEFAULT 'PENDING_HOD' CHECK (status IN ('PENDING_HOD', 'HOD_APPROVED', 'HOD_REJECTED', 'ON_CHAIN_SUBMITTED', 'ON_CHAIN_CONFIRMED', 'ON_CHAIN_FAILED')),
    reviewed_by UUID REFERENCES public.users(id),
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    blockchain_transaction_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_salary_request UNIQUE (organization_id, user_id, work_cycle_id, month_start)
);
CREATE INDEX IF NOT EXISTS idx_salary_requests_org ON public.salary_requests(organization_id, status);

-- 9. Blockchain Wallets & Transactions
CREATE TABLE IF NOT EXISTS public.blockchain_wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    public_address TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    purpose TEXT NOT NULL CHECK (purpose IN ('PERSONAL', 'SALARY_POOL', 'LOAN_POOL', 'GENESIS')),
    network TEXT NOT NULL DEFAULT 'sepolia',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_blockchain_wallet_user_purpose UNIQUE (organization_id, user_id, purpose)
);

CREATE TABLE IF NOT EXISTS public.blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    from_address TEXT NOT NULL,
    to_address TEXT NOT NULL,
    amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tx_hash TEXT NOT NULL,
    block_number BIGINT,
    network TEXT NOT NULL DEFAULT 'sepolia',
    event_type TEXT NOT NULL CHECK (event_type IN ('MINT', 'TASK_REWARD', 'SALARY_SETTLEMENT', 'LOAN_DISBURSEMENT', 'BATCH_REVERSAL')),
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Task enhancements
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS visibility_scope TEXT NOT NULL DEFAULT 'ORGANIZATION' CHECK (visibility_scope IN ('ORGANIZATION', 'ORG_UNIT'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS verification_mode TEXT NOT NULL DEFAULT 'MANUAL_REPORT' CHECK (verification_mode IN ('MANUAL_REPORT', 'FILE_SUBMISSION'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS allow_nomination BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_by_id UUID REFERENCES public.users(id);

-- ============================================================================
-- 11. RPC FUNCTIONS (ROW LOCKING, IDEMPOTENCY & TRANSACTIONAL PROGRESS)
-- ============================================================================

-- A. Recompute Monthly Work Progress
CREATE OR REPLACE FUNCTION public.recompute_monthly_work_progress(
    p_user_id UUID,
    p_work_cycle_id UUID,
    p_month_start DATE
) RETURNS JSONB AS $$
DECLARE
    v_org_id UUID;
    v_sched_weight NUMERIC := 75;
    v_salary_thresh NUMERIC := 85;
    v_opens_day INTEGER := 26;
    v_month_end DATE;
    v_sched_target NUMERIC := 0;
    v_total_target NUMERIC := 0;
    v_sched_earned NUMERIC := 0;
    v_unsched_earned NUMERIC := 0;
    v_raw_earned NUMERIC := 0;
    v_display_pct NUMERIC := 0;
    v_salary_eligible BOOLEAN := false;
    v_req_status TEXT := 'NOT_OPEN';
    v_existing_req TEXT;
    v_today DATE := CURRENT_DATE;
    v_result JSONB;
BEGIN
    -- Fetch organization & cycle settings
    SELECT organization_id INTO v_org_id FROM public.users WHERE id = p_user_id;
    SELECT scheduled_weight_percentage, salary_threshold_percentage, salary_request_opens_day
    INTO v_sched_weight, v_salary_thresh, v_opens_day
    FROM public.work_cycles WHERE id = p_work_cycle_id;

    v_month_end := (p_month_start + INTERVAL '1 month - 1 day')::DATE;

    -- 1. Calculate scheduled target credits from active scheduled instances for this month
    SELECT COALESCE(SUM(credit_value), 0)
    INTO v_sched_target
    FROM public.scheduled_work_instances
    WHERE assigned_to_id = p_user_id
      AND work_cycle_id = p_work_cycle_id
      AND work_date >= p_month_start
      AND work_date <= v_month_end
      AND status != 'CANCELLED';

    -- 2. Calculate total target: total_target = sched_target / (sched_weight / 100)
    IF v_sched_target > 0 AND v_sched_weight > 0 THEN
        v_total_target := ROUND(v_sched_target / (v_sched_weight / 100.0), 2);
    ELSE
        v_total_target := 0;
    END IF;

    -- 3. Calculate earned credits from credit_ledger_entries
    SELECT 
        COALESCE(SUM(CASE WHEN credit_type = 'STRUCTURED_SELF_COMPLETION' THEN amount ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN credit_type IN ('UNSTRUCTURED_APPROVAL', 'MANUAL_ADJUSTMENT', 'REVERSAL') THEN amount ELSE 0 END), 0),
        COALESCE(SUM(amount), 0)
    INTO v_sched_earned, v_unsched_earned, v_raw_earned
    FROM public.credit_ledger_entries
    WHERE user_id = p_user_id
      AND work_cycle_id = p_work_cycle_id
      AND month_start = p_month_start;

    -- 4. Calculate capped display progress: min(100, round((raw_earned / total_target) * 100, 2))
    IF v_total_target > 0 THEN
        v_display_pct := LEAST(100.00, ROUND((v_raw_earned / v_total_target) * 100.0, 2));
    ELSE
        v_display_pct := 0;
    END IF;

    -- 5. Calculate salary eligibility: raw_earned >= total_target * threshold / 100
    IF v_total_target > 0 AND v_raw_earned >= ROUND(v_total_target * (v_salary_thresh / 100.0), 2) THEN
        v_salary_eligible := true;
    ELSE
        v_salary_eligible := false;
    END IF;

    -- 6. Check current salary request status
    SELECT status INTO v_existing_req
    FROM public.salary_requests
    WHERE user_id = p_user_id AND work_cycle_id = p_work_cycle_id AND month_start = p_month_start;

    IF v_existing_req IS NOT NULL THEN
        v_req_status := v_existing_req;
    ELSIF v_salary_eligible AND EXTRACT(DAY FROM v_today) >= v_opens_day THEN
        v_req_status := 'AVAILABLE';
    ELSE
        v_req_status := 'NOT_OPEN';
    END IF;

    -- 7. Upsert into monthly_work_progress
    INSERT INTO public.monthly_work_progress (
        organization_id, user_id, work_cycle_id, month_start,
        scheduled_target_credits, total_target_credits,
        scheduled_earned_credits, unscheduled_earned_credits, raw_earned_credits,
        display_progress_percentage, salary_eligible, salary_request_status,
        computed_at
    ) VALUES (
        v_org_id, p_user_id, p_work_cycle_id, p_month_start,
        v_sched_target, v_total_target,
        v_sched_earned, v_unsched_earned, v_raw_earned,
        v_display_pct, v_salary_eligible, v_req_status,
        now()
    )
    ON CONFLICT (organization_id, user_id, work_cycle_id, month_start)
    DO UPDATE SET
        scheduled_target_credits = EXCLUDED.scheduled_target_credits,
        total_target_credits = EXCLUDED.total_target_credits,
        scheduled_earned_credits = EXCLUDED.scheduled_earned_credits,
        unscheduled_earned_credits = EXCLUDED.unscheduled_earned_credits,
        raw_earned_credits = EXCLUDED.raw_earned_credits,
        display_progress_percentage = EXCLUDED.display_progress_percentage,
        salary_eligible = EXCLUDED.salary_eligible,
        salary_request_status = EXCLUDED.salary_request_status,
        computed_at = now();

    SELECT jsonb_build_object(
        'scheduled_target_credits', v_sched_target,
        'total_target_credits', v_total_target,
        'scheduled_earned_credits', v_sched_earned,
        'unscheduled_earned_credits', v_unsched_earned,
        'raw_earned_credits', v_raw_earned,
        'display_progress_percentage', v_display_pct,
        'salary_eligible', v_salary_eligible,
        'salary_request_status', v_req_status
    ) INTO v_result;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Confirm Scheduled Work Instance (2-Step Completion Action)
CREATE OR REPLACE FUNCTION public.confirm_scheduled_work_instance(
    p_instance_id UUID,
    p_faculty_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_inst RECORD;
    v_month_start DATE;
    v_idempotency_key TEXT;
    v_progress JSONB;
BEGIN
    -- 1. Row lock the scheduled instance
    SELECT * INTO v_inst
    FROM public.scheduled_work_instances
    WHERE id = p_instance_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Scheduled work instance not found: %', p_instance_id;
    END IF;

    IF v_inst.assigned_to_id != p_faculty_id THEN
        RAISE EXCEPTION 'Unauthorized: instance is not assigned to calling faculty.';
    END IF;

    IF v_inst.status = 'SELF_COMPLETED' THEN
        -- Idempotent return if already completed
        SELECT public.recompute_monthly_work_progress(p_faculty_id, v_inst.work_cycle_id, DATE_TRUNC('month', v_inst.work_date)::DATE) INTO v_progress;
        RETURN jsonb_build_object('success', true, 'already_completed', true, 'progress', v_progress);
    END IF;

    IF v_inst.status IN ('CANCELLED', 'FLAGGED') THEN
        RAISE EXCEPTION 'Cannot complete instance with status %', v_inst.status;
    END IF;

    v_month_start := DATE_TRUNC('month', v_inst.work_date)::DATE;
    v_idempotency_key := 'sched_inst_' || v_inst.id::TEXT;

    -- 2. Insert into scheduled_work_completions
    INSERT INTO public.scheduled_work_completions (
        organization_id, instance_id, faculty_id,
        confirmation_1_at, confirmation_2_at, credit_value
    ) VALUES (
        v_inst.organization_id, v_inst.id, p_faculty_id,
        now(), now(), v_inst.credit_value
    )
    ON CONFLICT (instance_id) DO NOTHING;

    -- 3. Insert into credit_ledger_entries
    INSERT INTO public.credit_ledger_entries (
        organization_id, user_id, work_cycle_id, month_start,
        credit_type, amount, source_entity_type, source_entity_id,
        idempotency_key, created_by, metadata
    ) VALUES (
        v_inst.organization_id, p_faculty_id, v_inst.work_cycle_id, v_month_start,
        'STRUCTURED_SELF_COMPLETION', v_inst.credit_value, 'scheduled_work_instance', v_inst.id,
        v_idempotency_key, p_faculty_id, jsonb_build_object('work_date', v_inst.work_date, 'template_id', v_inst.template_id)
    )
    ON CONFLICT (idempotency_key) DO NOTHING;

    -- 4. Update scheduled instance status
    UPDATE public.scheduled_work_instances
    SET status = 'SELF_COMPLETED',
        self_completed_at = now(),
        self_completed_by = p_faculty_id,
        updated_at = now()
    WHERE id = v_inst.id;

    -- 5. Recompute monthly progress
    SELECT public.recompute_monthly_work_progress(p_faculty_id, v_inst.work_cycle_id, v_month_start) INTO v_progress;

    RETURN jsonb_build_object(
        'success', true,
        'instance_id', v_inst.id,
        'credit_awarded', v_inst.credit_value,
        'progress', v_progress
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Approve Ad-Hoc Task and Award Credit
CREATE OR REPLACE FUNCTION public.approve_adhoc_task_and_award_credit(
    p_task_id UUID,
    p_reviewer_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_task RECORD;
    v_cycle_id UUID;
    v_month_start DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
    v_idempotency_key TEXT;
    v_progress JSONB;
BEGIN
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found: %', p_task_id;
    END IF;

    IF v_task.assigned_to_id IS NULL THEN
        RAISE EXCEPTION 'Cannot approve unassigned task.';
    END IF;

    IF v_task.status = 'CLOSED' THEN
        RETURN jsonb_build_object('success', true, 'already_approved', true);
    END IF;

    -- Get active cycle
    SELECT id INTO v_cycle_id
    FROM public.work_cycles
    WHERE organization_id = v_task.organization_id AND status = 'ACTIVE'
    LIMIT 1;

    IF v_cycle_id IS NULL THEN
        SELECT id INTO v_cycle_id
        FROM public.work_cycles
        WHERE organization_id = v_task.organization_id
        ORDER BY created_at DESC LIMIT 1;
    END IF;

    v_idempotency_key := 'adhoc_task_' || v_task.id::TEXT;

    -- Insert into credit_ledger_entries if cycle exists
    IF v_cycle_id IS NOT NULL THEN
        INSERT INTO public.credit_ledger_entries (
            organization_id, user_id, work_cycle_id, month_start,
            credit_type, amount, source_entity_type, source_entity_id,
            idempotency_key, created_by, metadata
        ) VALUES (
            v_task.organization_id, v_task.assigned_to_id, v_cycle_id, v_month_start,
            'UNSTRUCTURED_APPROVAL', v_task.credit_value, 'task', v_task.id,
            v_idempotency_key, p_reviewer_id, jsonb_build_object('title', v_task.title)
        )
        ON CONFLICT (idempotency_key) DO NOTHING;

        SELECT public.recompute_monthly_work_progress(v_task.assigned_to_id, v_cycle_id, v_month_start) INTO v_progress;
    END IF;

    -- Update task status
    UPDATE public.tasks
    SET status = 'CLOSED',
        lead_signed_by = p_reviewer_id,
        lead_signed_at = now(),
        updated_at = now()
    WHERE id = v_task.id;

    RETURN jsonb_build_object(
        'success', true,
        'task_id', v_task.id,
        'credit_awarded', v_task.credit_value,
        'progress', v_progress
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 12. Enable Row Level Security & Policies
ALTER TABLE public.work_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_work_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_work_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_work_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_work_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_transactions ENABLE ROW LEVEL SECURITY;

-- Permissive authenticated read policies scoped by tenant
CREATE POLICY "Users can view work cycles in their organization"
    ON public.work_cycles FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view scheduled work templates in their organization"
    ON public.scheduled_work_templates FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view scheduled work instances in their organization"
    ON public.scheduled_work_instances FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view monthly work progress in their organization"
    ON public.monthly_work_progress FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view salary requests in their organization"
    ON public.salary_requests FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view blockchain transactions in their organization"
    ON public.blockchain_transactions FOR SELECT TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
