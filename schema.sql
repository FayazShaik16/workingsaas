-- ============================================================================
-- WORKLEDGER — CANONICAL SCHEMA v4 (Meta-Engine Architecture)
-- PostgreSQL 16+ / Supabase
-- ============================================================================
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS ltree;

-- ============================================================================
-- 1. ENUMS
-- ============================================================================
CREATE TYPE organization_type   AS ENUM ('COLLEGE','ENTERPRISE','GOVERNMENT','NGO','HOSPITAL','GENERIC');
CREATE TYPE task_category       AS ENUM ('STRUCTURED','UNSTRUCTURED');
CREATE TYPE task_status         AS ENUM (
    'DRAFT','OPEN','NOMINATED','ASSIGNED','IN_PROGRESS',
    'VERIFICATION_PENDING','PEER_APPROVED','LEAD_SIGNED',
    'REJECTED','CANCELLED','CLOSED'
);
CREATE TYPE nomination_status   AS ENUM ('PENDING','ACCEPTED','REJECTED');
CREATE TYPE wallet_purpose      AS ENUM ('SALARY_POOL','LOAN_POOL','PERSONAL');
CREATE TYPE transaction_type    AS ENUM ('MINT','SALARY_TRANSFER','LOAN_ISSUE','REVERSE_TRANSFER','LOAN_REPAY','TASK_REWARD','BONUS','BURN');
CREATE TYPE transaction_status  AS ENUM ('PENDING','CONFIRMED','FAILED');
CREATE TYPE loan_status         AS ENUM ('PENDING','ACTIVE','REPAID','DEFAULTED');
CREATE TYPE verification_mode   AS ENUM ('SELF_REPORT','PROOF_UPLOAD','LEAD_AUDIT','AUTO_INTEGRATION');
CREATE TYPE approval_status     AS ENUM ('PENDING','APPROVED','REJECTED');
CREATE TYPE approval_decision   AS ENUM ('APPROVE','REJECT');
CREATE TYPE employment_type     AS ENUM ('FULL_TIME','PART_TIME','CONTRACT','BENCH');
CREATE TYPE user_status         AS ENUM ('ACTIVE','SUSPENDED','OFFBOARDED');
CREATE TYPE notification_channel AS ENUM ('IN_APP','EMAIL','GMAIL','WHATSAPP','SLACK');
CREATE TYPE priority_level      AS ENUM ('LOW','MEDIUM','HIGH','URGENT');
CREATE TYPE job_status          AS ENUM ('RUNNING','COMPLETED','FAILED');
CREATE TYPE invitation_status   AS ENUM ('PENDING','ACCEPTED','EXPIRED','REVOKED');
CREATE TYPE integration_provider AS ENUM ('GOOGLE_CALENDAR','GMAIL','GOOGLE_DRIVE','SLACK','JIRA','GITHUB','GITLAB','TEAMS');
CREATE TYPE integration_status  AS ENUM ('CONNECTED','DISCONNECTED','ERROR');
CREATE TYPE activity_source     AS ENUM ('MEETING','COMMIT','DOCUMENT','TICKET','SLACK_THREAD','MANUAL');
CREATE TYPE action_item_status  AS ENUM ('PENDING','IN_PROGRESS','COMPLETED','CANCELLED');
CREATE TYPE ledger_adapter_type AS ENUM ('POSTGRES','BESU');
CREATE TYPE chain_status        AS ENUM ('SUBMITTED','CONFIRMED','REVERTED');
CREATE TYPE responsibility_status AS ENUM ('ACTIVE','ENDED');
CREATE TYPE rule_result_status  AS ENUM ('SUCCESS','FAILED');

-- ============================================================================
-- 2. UUIDv7 + LTREE HELPERS
-- ============================================================================
CREATE OR REPLACE FUNCTION generate_uuid_v7() RETURNS uuid AS $$
DECLARE
    v_time timestamptz := clock_timestamp();
    v_secs bigint; v_msec bigint; v_time_hex text; v_rand_hex text; v_uuid_text text;
BEGIN
    v_secs := floor(extract(epoch from v_time));
    v_msec := floor(extract(milliseconds from v_time)) - (v_secs * 1000);
    v_time_hex := lpad(to_hex((v_secs * 1000) + v_msec), 12, '0');
    v_rand_hex := encode(gen_random_bytes(10), 'hex');
    v_uuid_text := substr(v_time_hex,1,8) || '-' || substr(v_time_hex,9,4) || '-' ||
                   '7' || substr(v_rand_hex,1,3) || '-' ||
                   to_hex((decode(substr(v_rand_hex,4,1),'hex')::int & 3) | 8) || substr(v_rand_hex,5,3) || '-' ||
                   substr(v_rand_hex,8,12);
    RETURN v_uuid_text::uuid;
END; $$ LANGUAGE plpgsql VOLATILE;

CREATE OR REPLACE FUNCTION uuid_to_ltree_label(p_id UUID) RETURNS TEXT AS $$
    SELECT 'n' || replace(p_id::text, '-', '_');
$$ LANGUAGE sql IMMUTABLE;

-- ============================================================================
-- 3. TENANCY, TEMPLATES, ORG TREE, IDENTITY
-- ============================================================================
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    name CITEXT NOT NULL,
    type organization_type NOT NULL,
    template_key TEXT NOT NULL DEFAULT 'GENERIC',
    logo_url TEXT,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE organization_templates (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    key TEXT UNIQUE NOT NULL,
    label TEXT NOT NULL,
    default_unit_types JSONB NOT NULL DEFAULT '[]',
    default_roles JSONB NOT NULL DEFAULT '[]',
    default_task_types JSONB NOT NULL DEFAULT '[]',
    default_rate_cards JSONB NOT NULL DEFAULT '[]',
    default_workflow_defs JSONB NOT NULL DEFAULT '[]',
    default_responsibility_types JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE platform_admins (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    auth_user_id UUID NOT NULL UNIQUE,
    email CITEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE org_units (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES org_units(id) ON DELETE CASCADE,
    unit_type TEXT NOT NULL,
    name CITEXT NOT NULL,
    path LTREE,
    lead_user_id UUID,
    metadata JSONB NOT NULL DEFAULT '{}',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_org_unit_name UNIQUE (organization_id, parent_id, name)
);
CREATE INDEX idx_org_units_path ON org_units USING gist(path);
CREATE INDEX idx_org_units_org  ON org_units(organization_id);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    org_unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL,
    email CITEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_url TEXT,
    employee_id TEXT,
    designation TEXT,
    employment_type employment_type NOT NULL DEFAULT 'FULL_TIME',
    progress_percentage NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (progress_percentage BETWEEN 0 AND 100),
    quality_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    marketplace_locked BOOLEAN NOT NULL DEFAULT false,
    marketplace_lock_reason TEXT,
    skills JSONB NOT NULL DEFAULT '[]',
    capacity_hours_weekly NUMERIC(5,2) DEFAULT 40,
    status user_status NOT NULL DEFAULT 'ACTIVE',
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT unique_org_email UNIQUE(organization_id, email)
);

ALTER TABLE org_units ADD CONSTRAINT fk_org_unit_lead FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE invitations (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    org_unit_id UUID REFERENCES org_units(id) ON DELETE SET NULL,
    email CITEXT NOT NULL,
    intended_role_id UUID,
    invited_by UUID REFERENCES users(id),
    token TEXT NOT NULL UNIQUE,
    status invitation_status NOT NULL DEFAULT 'PENDING',
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (clock_timestamp() + interval '7 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_pending_invite UNIQUE (organization_id, email)
);

-- ============================================================================
-- 4. RBAC
-- ============================================================================
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    scope TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    CONSTRAINT unique_scope_action UNIQUE(scope, action)
);

CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name CITEXT NOT NULL,
    scope_level TEXT NOT NULL,  -- 'DIRECTOR'|'DEAN'|'ORG_UNIT_LEAD'|'MEMBER'|'FINANCE_ADMIN'|'SYSTEM_ADMIN'
    is_system_role BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_org_role UNIQUE(organization_id, name)
);

ALTER TABLE invitations ADD CONSTRAINT fk_invite_role FOREIGN KEY (intended_role_id) REFERENCES roles(id);

CREATE TABLE role_permissions (
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

CREATE TABLE permission_overrides (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    is_allowed BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, permission_id)
);

-- ============================================================================
-- 5. CONCURRENT RESPONSIBILITY ENGINE (the domain-specific invention)
-- Models a person holding one or more secondary "additional charge" posts
-- (Class Incharge, Exam Cell Coordinator, NSS Coordinator, Placement Officer)
-- alongside their primary designation, each scoped to an org_unit, each
-- carrying its own credit weight and optional extra permissions.
-- ============================================================================
CREATE TABLE responsibility_type_definitions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    default_credit_weight NUMERIC(5,2) NOT NULL DEFAULT 1.0,
    grants_permission_overrides JSONB NOT NULL DEFAULT '[]',
    CONSTRAINT unique_org_responsibility_type UNIQUE(organization_id, key)
);

CREATE TABLE responsibility_assignments (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_unit_id UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    responsibility_type_id UUID NOT NULL REFERENCES responsibility_type_definitions(id),
    is_primary BOOLEAN NOT NULL DEFAULT false,
    reports_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    status responsibility_status NOT NULL DEFAULT 'ACTIVE',
    CONSTRAINT check_resp_dates CHECK (end_date IS NULL OR end_date >= start_date)
);
CREATE INDEX idx_resp_assign_user ON responsibility_assignments(user_id) WHERE status = 'ACTIVE';
CREATE INDEX idx_resp_assign_unit_type ON responsibility_assignments(org_unit_id, responsibility_type_id) WHERE status = 'ACTIVE';

-- ============================================================================
-- 6. WALLETS & LEDGER (Postgres-native now, Besu-ready)
-- ============================================================================
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose wallet_purpose NOT NULL,
    balance NUMERIC(36,18) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    is_locked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_owner_purpose UNIQUE (owner_user_id, purpose)
);
CREATE INDEX idx_wallets_owner ON wallets(owner_user_id);

CREATE TABLE wallet_keys (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    wallet_id UUID NOT NULL UNIQUE REFERENCES wallets(id) ON DELETE CASCADE,
    chain_address TEXT UNIQUE,
    encrypted_dek TEXT,
    kms_key_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE ledger_adapter_config (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    adapter_type ledger_adapter_type NOT NULL DEFAULT 'POSTGRES',
    besu_rpc_url TEXT,
    besu_contract_address TEXT,
    operator_wallet_key_id UUID REFERENCES wallet_keys(id)
);

CREATE TABLE token_transactions (
    id UUID NOT NULL DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    from_wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT,
    to_wallet_id UUID REFERENCES wallets(id) ON DELETE RESTRICT,
    amount NUMERIC(36,18) NOT NULL CHECK (amount > 0),
    type transaction_type NOT NULL,
    status transaction_status NOT NULL DEFAULT 'PENDING',
    approval_instance_id UUID,
    notes TEXT,
    prev_hash TEXT,
    row_hash TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

CREATE TABLE chain_transactions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token_transaction_id UUID NOT NULL,
    tx_hash TEXT UNIQUE,
    block_number BIGINT,
    chain_status chain_status NOT NULL DEFAULT 'SUBMITTED',
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE loans (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    amount NUMERIC(36,18) NOT NULL CHECK (amount > 0),
    remaining NUMERIC(36,18) NOT NULL CHECK (remaining >= 0),
    reason TEXT,
    buffer_eligible BOOLEAN NOT NULL DEFAULT true,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status loan_status NOT NULL DEFAULT 'PENDING',
    due_by TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    cleared_at TIMESTAMPTZ,
    CONSTRAINT check_loan_bounds CHECK (remaining <= amount)
);

CREATE TABLE compensation_policies (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    scope_type TEXT NOT NULL CHECK (scope_type IN ('ORG_WIDE','ORG_UNIT','ROLE','USER')),
    scope_id UUID,
    monthly_target_credits NUMERIC(12,4) NOT NULL,
    baseline_minimum_credits NUMERIC(12,4) NOT NULL DEFAULT 0,
    threshold_percentage NUMERIC(5,2) NOT NULL DEFAULT 85.00,
    grace_period_days INT NOT NULL DEFAULT 7,
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX idx_comp_policy_scope ON compensation_policies(organization_id, scope_type, scope_id);

-- ============================================================================
-- 7. TASK ENGINE
-- ============================================================================
CREATE TABLE task_type_definitions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    category task_category NOT NULL,
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    field_schema JSONB NOT NULL DEFAULT '[]',
    verification_mode verification_mode NOT NULL,
    requires_peer_review BOOLEAN NOT NULL DEFAULT false,
    linked_responsibility_type_id UUID REFERENCES responsibility_type_definitions(id),
    default_credit_value NUMERIC(12,4) DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_org_task_type UNIQUE(organization_id, key)
);

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    org_unit_id UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    task_type_id UUID NOT NULL REFERENCES task_type_definitions(id),
    category task_category NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    credit_value NUMERIC(12,4) NOT NULL CHECK (credit_value >= 0),
    min_skill_required JSONB NOT NULL DEFAULT '[]',
    creator_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
    deadline TIMESTAMPTZ,
    priority priority_level NOT NULL DEFAULT 'MEDIUM',
    status task_status NOT NULL DEFAULT 'DRAFT',
    requires_peer_review BOOLEAN NOT NULL DEFAULT false,
    custom_fields JSONB NOT NULL DEFAULT '{}',
    debt_clearance_for_loan_id UUID REFERENCES loans(id) ON DELETE SET NULL,
    lead_signed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    lead_signed_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE nominations (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status nomination_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_task_user_nomination UNIQUE(task_id, user_id)
);

CREATE TABLE task_proofs (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_provider TEXT NOT NULL DEFAULT 'SUPABASE' CHECK (storage_provider IN ('SUPABASE','GOOGLE_DRIVE')),
    file_url TEXT,
    external_file_id TEXT,
    description TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE task_peer_reviews (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    decision approval_decision NOT NULL,
    comment TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT unique_task_reviewer UNIQUE(task_id, reviewer_id)
);

-- ============================================================================
-- 8. ENGINE 1 — GENERIC WORKFLOW / STATE MACHINE ENGINE
-- ============================================================================
CREATE TABLE workflow_definitions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,           -- 'tasks' | 'loans' | future entities
    name TEXT NOT NULL,
    states JSONB NOT NULL,
    initial_state TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT unique_org_entity_workflow UNIQUE(organization_id, entity_type)
);

CREATE TABLE workflow_transitions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    allowed_role_scopes JSONB NOT NULL DEFAULT '[]',
    condition_expr JSONB,
    requires_approval_chain_id UUID
);

CREATE TABLE workflow_transition_log (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    actor_id UUID REFERENCES users(id),
    transition_id UUID REFERENCES workflow_transitions(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 9. ENGINE 2 — GENERIC BUSINESS RULE ENGINE
-- ============================================================================
CREATE TABLE business_rules (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    trigger_event TEXT NOT NULL,          -- 'ON_TRANSITION' | 'ON_INSERT' | 'ON_FIELD_CHANGE'
    trigger_condition JSONB,
    action_type TEXT NOT NULL,            -- 'INCREMENT_FIELD' | 'CREATE_TOKEN_TX' | 'SEND_NOTIFICATION'
    action_params JSONB NOT NULL,
    execution_order INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE business_rule_execution_log (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    business_rule_id UUID NOT NULL REFERENCES business_rules(id),
    triggering_transition_log_id UUID REFERENCES workflow_transition_log(id),
    entity_id UUID NOT NULL,
    result_status rule_result_status NOT NULL,
    result_detail JSONB,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 10. ENGINE 3 — GENERIC ACCESS CONTROL ENGINE (config layer above RLS)
-- ============================================================================
CREATE TABLE access_control_rules (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    field_name TEXT,                      -- NULL = row-level; set = field-level (enforced in API layer)
    operation TEXT NOT NULL CHECK (operation IN ('READ','WRITE','DELETE')),
    role_scope TEXT NOT NULL,
    condition_expr JSONB,
    effect TEXT NOT NULL DEFAULT 'ALLOW' CHECK (effect IN ('ALLOW','DENY'))
);

-- ============================================================================
-- 11. ENGINE 4 — REFERENCE QUALIFIER ENGINE
-- ============================================================================
CREATE TABLE reference_qualifiers (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_entity TEXT NOT NULL,
    source_field TEXT NOT NULL,
    target_entity TEXT NOT NULL,
    filter_expr JSONB NOT NULL
);

-- ============================================================================
-- 12. ENGINE 5 — NOTIFICATION / EVENT ENGINE
-- ============================================================================
CREATE TABLE notification_definitions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    trigger_event TEXT NOT NULL,
    channel notification_channel NOT NULL,
    template TEXT NOT NULL,
    recipient_rule JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    channel notification_channel NOT NULL DEFAULT 'IN_APP',
    redirection_link TEXT,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- ============================================================================
-- 13. ENGINE 6 — REPORT / DASHBOARD WIDGET ENGINE
-- ============================================================================
CREATE TABLE report_definitions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    widget_type TEXT NOT NULL,            -- 'PROGRESS_RING' | 'HEATMAP' | 'LEDGER_TABLE'
    role_scope TEXT NOT NULL,
    data_source_view TEXT NOT NULL,
    params JSONB NOT NULL DEFAULT '{}'
);

-- ============================================================================
-- 14. APPROVAL CHAIN ENGINE (multi-step sign-off, referenced by workflow transitions)
-- ============================================================================
CREATE TABLE approval_chain_definitions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    steps JSONB NOT NULL,
    CONSTRAINT unique_org_action_chain UNIQUE(organization_id, action_type)
);

CREATE TABLE approval_instances (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    chain_definition_id UUID NOT NULL REFERENCES approval_chain_definitions(id),
    subject_type TEXT NOT NULL,
    subject_id UUID NOT NULL,
    current_step INT NOT NULL DEFAULT 1,
    status approval_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE approval_actions (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    approval_instance_id UUID NOT NULL REFERENCES approval_instances(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    actor_id UUID NOT NULL REFERENCES users(id),
    decision approval_decision NOT NULL,
    comment TEXT,
    decided_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE workflow_transitions ADD CONSTRAINT fk_transition_chain FOREIGN KEY (requires_approval_chain_id) REFERENCES approval_chain_definitions(id);
ALTER TABLE token_transactions ADD CONSTRAINT fk_tx_approval FOREIGN KEY (approval_instance_id) REFERENCES approval_instances(id) ON DELETE SET NULL;

-- ============================================================================
-- 15. RUNTIME CONFIG, SCHEDULED JOBS, INTEGRATIONS
-- ============================================================================
CREATE TABLE rate_cards (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    task_type_id UUID NOT NULL REFERENCES task_type_definitions(id) ON DELETE CASCADE,
    tokens_per_unit NUMERIC(24,12) NOT NULL CHECK (tokens_per_unit >= 0),
    role_multipliers JSONB NOT NULL DEFAULT '{}',
    effective_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE cycle_calendars (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    marking_periods JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT check_calendar_dates CHECK (end_date >= start_date)
);

CREATE TABLE system_jobs (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    job_type TEXT NOT NULL,
    cycle_period_start DATE NOT NULL,
    cycle_period_end DATE NOT NULL,
    status job_status NOT NULL DEFAULT 'RUNNING',
    members_processed INT DEFAULT 0,
    salary_eligible_count INT DEFAULT 0,
    loan_issued_count INT DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider integration_provider NOT NULL,
    encrypted_access_token TEXT NOT NULL,
    encrypted_refresh_token TEXT,
    status integration_status NOT NULL DEFAULT 'CONNECTED',
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE activity_events (
    id UUID NOT NULL DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source activity_source NOT NULL,
    external_id TEXT,
    title TEXT NOT NULL,
    summary TEXT,
    detected_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    confirmed BOOLEAN NOT NULL DEFAULT false,
    token_equivalent NUMERIC(36,18) DEFAULT 0,
    duration_minutes INT CHECK (duration_minutes >= 0),
    metadata JSONB NOT NULL DEFAULT '{}',
    PRIMARY KEY (id, detected_at)
) PARTITION BY RANGE (detected_at);

CREATE TABLE meeting_action_items (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    activity_event_id UUID NOT NULL,
    activity_detected_at TIMESTAMPTZ NOT NULL,
    assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    status action_item_status NOT NULL DEFAULT 'PENDING',
    converted_to_task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE capacity_snapshots (
    id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    utilisation_score NUMERIC(5,2) NOT NULL CHECK (utilisation_score BETWEEN 0 AND 100),
    meeting_hours NUMERIC(4,2) NOT NULL DEFAULT 0,
    focus_hours NUMERIC(4,2) NOT NULL DEFAULT 0,
    task_hours NUMERIC(4,2) NOT NULL DEFAULT 0,
    overload_risk BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT unique_user_date_snapshot UNIQUE (user_id, date)
);

-- ============================================================================
-- 16. OBSERVABILITY
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID NOT NULL DEFAULT generate_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID NOT NULL,
    state_before JSONB,
    state_after JSONB,
    ip_address TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (id, timestamp)
) PARTITION BY RANGE (timestamp);

-- ============================================================================
-- 17. PARTITIONS
-- ============================================================================
CREATE TABLE token_transactions_y2026m07 PARTITION OF token_transactions FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE token_transactions_y2026m08 PARTITION OF token_transactions FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE token_transactions_default  PARTITION OF token_transactions DEFAULT;

CREATE TABLE activity_events_y2026m07 PARTITION OF activity_events FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE activity_events_default PARTITION OF activity_events DEFAULT;

CREATE TABLE audit_logs_y2026q3 PARTITION OF audit_logs FOR VALUES FROM ('2026-07-01') TO ('2026-10-01');
CREATE TABLE audit_logs_default PARTITION OF audit_logs DEFAULT;

-- ============================================================================
-- 18. INDEXES
-- ============================================================================
CREATE INDEX idx_users_org_unit ON users(organization_id, org_unit_id);
CREATE INDEX idx_tasks_org_unit_status ON tasks(organization_id, org_unit_id, status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to_id) WHERE assigned_to_id IS NOT NULL;
CREATE INDEX idx_tasks_skills_gin ON tasks USING gin(min_skill_required);
CREATE INDEX idx_tasks_custom_fields_gin ON tasks USING gin(custom_fields);
CREATE INDEX idx_users_skills_gin ON users USING gin(skills);
CREATE INDEX idx_tx_org_wallets ON token_transactions(organization_id, from_wallet_id, to_wallet_id);
CREATE INDEX idx_audit_org_entity ON audit_logs(organization_id, entity_type, entity_id);
CREATE INDEX idx_business_rules_lookup ON business_rules(organization_id, entity_type, trigger_event) WHERE is_active;
CREATE INDEX idx_workflow_transitions_lookup ON workflow_transitions(workflow_definition_id, from_state);
CREATE INDEX idx_access_control_lookup ON access_control_rules(organization_id, entity_type, role_scope);
CREATE INDEX idx_reference_qualifiers_lookup ON reference_qualifiers(organization_id, source_entity, source_field);

-- ============================================================================
-- 19. TRIGGERS — timestamps, locking, ltree maintenance
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = clock_timestamp(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_org_units_ts BEFORE UPDATE ON org_units FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_users_ts BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tasks_ts BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION execute_optimistic_lock_validation() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.version IS DISTINCT FROM OLD.version THEN
        RAISE EXCEPTION 'Concurrency violation on %: reload required', TG_TABLE_NAME USING ERRCODE = 'aborted_transaction';
    END IF;
    NEW.version = OLD.version + 1;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_org_units_lock BEFORE UPDATE ON org_units FOR EACH ROW EXECUTE FUNCTION execute_optimistic_lock_validation();
CREATE TRIGGER trg_users_lock BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION execute_optimistic_lock_validation();
CREATE TRIGGER trg_tasks_lock BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION execute_optimistic_lock_validation();

CREATE OR REPLACE FUNCTION maintain_org_unit_path() RETURNS TRIGGER AS $$
DECLARE v_parent_path LTREE;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.parent_id IS NULL THEN
            NEW.path := uuid_to_ltree_label(NEW.id)::ltree;
        ELSE
            SELECT path INTO v_parent_path FROM org_units WHERE id = NEW.parent_id;
            IF v_parent_path IS NULL THEN RAISE EXCEPTION 'Parent org_unit % not found', NEW.parent_id; END IF;
            NEW.path := v_parent_path || uuid_to_ltree_label(NEW.id)::ltree;
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
        IF NEW.parent_id IS NULL THEN
            NEW.path := uuid_to_ltree_label(NEW.id)::ltree;
        ELSE
            SELECT path INTO v_parent_path FROM org_units WHERE id = NEW.parent_id;
            IF v_parent_path IS NULL THEN RAISE EXCEPTION 'Parent org_unit % not found', NEW.parent_id; END IF;
            IF v_parent_path <@ OLD.path THEN RAISE EXCEPTION 'Cannot reparent under own descendant'; END IF;
            NEW.path := v_parent_path || uuid_to_ltree_label(NEW.id)::ltree;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_org_unit_path BEFORE INSERT OR UPDATE ON org_units FOR EACH ROW EXECUTE FUNCTION maintain_org_unit_path();

CREATE OR REPLACE FUNCTION cascade_org_unit_path() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.path IS DISTINCT FROM OLD.path THEN
        UPDATE org_units SET path = NEW.path || subpath(path, nlevel(OLD.path))
        WHERE path <@ OLD.path AND id != NEW.id;
    END IF;
    RETURN NULL;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_org_unit_path_cascade AFTER UPDATE ON org_units FOR EACH ROW EXECUTE FUNCTION cascade_org_unit_path();

-- ============================================================================
-- 20. LEDGER SYNC (row-locked, hash-chained)
-- ============================================================================
CREATE OR REPLACE FUNCTION sync_wallet_balances_from_ledger() RETURNS TRIGGER AS $$
DECLARE v_prev_hash TEXT;
BEGIN
    IF (TG_OP = 'INSERT' AND NEW.status = 'CONFIRMED') OR
       (TG_OP = 'UPDATE' AND NEW.status = 'CONFIRMED' AND OLD.status IS DISTINCT FROM 'CONFIRMED') THEN
        IF NEW.from_wallet_id IS NOT NULL THEN
            PERFORM 1 FROM wallets WHERE id = NEW.from_wallet_id FOR UPDATE;
            UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.from_wallet_id;
        END IF;
        IF NEW.to_wallet_id IS NOT NULL THEN
            PERFORM 1 FROM wallets WHERE id = NEW.to_wallet_id FOR UPDATE;
            UPDATE wallets SET balance = balance + NEW.amount WHERE id = NEW.to_wallet_id;
            IF NEW.type = 'LOAN_REPAY' THEN
                UPDATE loans SET remaining = remaining - NEW.amount,
                    status = CASE WHEN (remaining - NEW.amount) <= 0 THEN 'REPAID'::loan_status ELSE 'ACTIVE'::loan_status END,
                    cleared_at = CASE WHEN (remaining - NEW.amount) <= 0 THEN clock_timestamp() ELSE NULL END
                WHERE user_id = (SELECT owner_user_id FROM wallets WHERE id = NEW.to_wallet_id) AND status = 'ACTIVE';
            END IF;
        END IF;
        SELECT row_hash INTO v_prev_hash FROM token_transactions
        WHERE organization_id = NEW.organization_id ORDER BY timestamp DESC LIMIT 1 OFFSET 1;
        NEW.prev_hash := v_prev_hash;
        NEW.row_hash := encode(digest(concat_ws('|', NEW.id::text, NEW.from_wallet_id::text, NEW.to_wallet_id::text, NEW.amount::text, NEW.type::text, coalesce(v_prev_hash,'')), 'sha256'), 'hex');
    END IF;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ledger_balance_sync BEFORE INSERT OR UPDATE OF status ON token_transactions
FOR EACH ROW EXECUTE FUNCTION sync_wallet_balances_from_ledger();

-- ============================================================================
-- 21. GENERIC WORKFLOW ENGINE EXECUTOR (Engine 1 + Engine 2 wired together)
-- SAFETY NOTE FOR AGENTS: action_params/target_table values must be validated
-- against a whitelist before use in dynamic SQL — never interpolate raw
-- user-supplied strings into format(). This function assumes action_params
-- has already been validated at insert time into business_rules.
-- ============================================================================
CREATE OR REPLACE FUNCTION apply_business_rules(
    p_organization_id UUID, p_entity_type TEXT, p_entity_id UUID, p_to_state TEXT
) RETURNS VOID AS $$
DECLARE r business_rules%ROWTYPE;
BEGIN
    FOR r IN SELECT * FROM business_rules
        WHERE organization_id = p_organization_id AND entity_type = p_entity_type
        AND is_active AND trigger_event = 'ON_TRANSITION'
        AND (trigger_condition->>'to_state') = p_to_state
        ORDER BY execution_order
    LOOP
        BEGIN
            IF r.action_type = 'INCREMENT_FIELD' THEN
                EXECUTE format(
                    'UPDATE %I SET %I = %I + $2 WHERE id = $1',
                    r.action_params->>'target_table', r.action_params->>'field', r.action_params->>'field'
                ) USING (SELECT assigned_to_id FROM tasks WHERE id = p_entity_id),
                        (SELECT credit_value FROM tasks WHERE id = p_entity_id);
            END IF;
            INSERT INTO business_rule_execution_log(business_rule_id, entity_id, result_status)
            VALUES (r.id, p_entity_id, 'SUCCESS');
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO business_rule_execution_log(business_rule_id, entity_id, result_status, result_detail)
            VALUES (r.id, p_entity_id, 'FAILED', jsonb_build_object('error', SQLERRM));
        END;
    END LOOP;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION execute_workflow_transition(
    p_organization_id UUID, p_entity_type TEXT, p_entity_id UUID,
    p_to_state TEXT, p_actor_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_wf_id UUID;
    v_current_state TEXT;
    v_transition workflow_transitions%ROWTYPE;
BEGIN
    IF p_entity_type = 'tasks' THEN
        SELECT status INTO v_current_state FROM tasks WHERE id = p_entity_id FOR UPDATE;
    ELSIF p_entity_type = 'loans' THEN
        SELECT status INTO v_current_state FROM loans WHERE id = p_entity_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Unknown entity_type %', p_entity_type;
    END IF;

    SELECT id INTO v_wf_id FROM workflow_definitions
    WHERE organization_id = p_organization_id AND entity_type = p_entity_type AND is_active;

    SELECT * INTO v_transition FROM workflow_transitions
    WHERE workflow_definition_id = v_wf_id AND from_state = v_current_state AND to_state = p_to_state;

    IF v_transition.id IS NULL THEN
        RAISE EXCEPTION 'Invalid transition % -> % for %', v_current_state, p_to_state, p_entity_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_actor_id
        AND r.scope_level IN (SELECT jsonb_array_elements_text(v_transition.allowed_role_scopes))
    ) THEN
        RAISE EXCEPTION 'Actor % not authorized for this transition', p_actor_id;
    END IF;

    IF v_transition.requires_approval_chain_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM approval_instances
            WHERE subject_type = p_entity_type AND subject_id = p_entity_id
            AND chain_definition_id = v_transition.requires_approval_chain_id AND status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'Transition requires completed approval chain';
        END IF;
    END IF;

    IF p_entity_type = 'tasks' THEN
        UPDATE tasks SET status = p_to_state::task_status, updated_at = clock_timestamp() WHERE id = p_entity_id;
    ELSIF p_entity_type = 'loans' THEN
        UPDATE loans SET status = p_to_state::loan_status WHERE id = p_entity_id;
    END IF;

    INSERT INTO workflow_transition_log(organization_id, entity_type, entity_id, from_state, to_state, actor_id, transition_id)
    VALUES (p_organization_id, p_entity_type, p_entity_id, v_current_state, p_to_state, p_actor_id, v_transition.id);

    PERFORM apply_business_rules(p_organization_id, p_entity_type, p_entity_id, p_to_state);

    RETURN true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 22. BATCH REVERSE TRANSFER — advisory-locked, org-scoped
-- ============================================================================
CREATE OR REPLACE FUNCTION batch_reverse_transfer(p_organization_id UUID) RETURNS INT AS $$
DECLARE v_count INT := 0; v_wallet RECORD;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext(p_organization_id::text));
    FOR v_wallet IN
        SELECT id, owner_user_id, balance FROM wallets
        WHERE organization_id = p_organization_id AND purpose = 'PERSONAL' AND balance > 0
        FOR UPDATE
    LOOP
        INSERT INTO token_transactions(organization_id, from_wallet_id, to_wallet_id, amount, type, status)
        VALUES (p_organization_id, v_wallet.id,
                (SELECT id FROM wallets WHERE organization_id = p_organization_id AND purpose = 'SALARY_POOL' LIMIT 1),
                v_wallet.balance, 'REVERSE_TRANSFER', 'CONFIRMED');
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 23. ONBOARDING TRIGGER (Configured in Section 20 at end of schema)
-- ============================================================================

-- ============================================================================
-- 24. AUDIT CAPTURE
-- ============================================================================
CREATE OR REPLACE FUNCTION process_audit_log_capture() RETURNS TRIGGER AS $$
DECLARE v_org_id UUID; v_actor_id UUID; v_before JSONB := NULL; v_after JSONB := NULL;
BEGIN
    BEGIN v_actor_id := current_setting('request.jwt.claims', true)::jsonb->>'sub';
    EXCEPTION WHEN OTHERS THEN v_actor_id := NULL; END;
    IF (TG_OP IN ('DELETE','UPDATE')) THEN v_before := to_jsonb(OLD); v_org_id := OLD.organization_id; END IF;
    IF (TG_OP IN ('INSERT','UPDATE')) THEN v_after := to_jsonb(NEW); v_org_id := NEW.organization_id; END IF;
    INSERT INTO audit_logs (organization_id, actor_id, action, entity_type, entity_id, state_before, state_after, timestamp)
    VALUES (v_org_id, v_actor_id, TG_OP, TG_TABLE_NAME, COALESCE(NEW.id, OLD.id), v_before, v_after, clock_timestamp());
    RETURN NULL;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_audit_tasks AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION process_audit_log_capture();
CREATE TRIGGER trg_audit_loans AFTER INSERT OR UPDATE OR DELETE ON loans FOR EACH ROW EXECUTE FUNCTION process_audit_log_capture();
CREATE TRIGGER trg_audit_org_units AFTER INSERT OR UPDATE OR DELETE ON org_units FOR EACH ROW EXECUTE FUNCTION process_audit_log_capture();
CREATE TRIGGER trg_audit_responsibility AFTER INSERT OR UPDATE OR DELETE ON responsibility_assignments FOR EACH ROW EXECUTE FUNCTION process_audit_log_capture();

-- ============================================================================
-- 25. RBAC VALIDATION
-- ============================================================================
CREATE OR REPLACE FUNCTION check_user_permission(p_user_id UUID, p_scope TEXT, p_action TEXT) RETURNS BOOLEAN AS $$
DECLARE v_override BOOLEAN; v_has_role BOOLEAN;
BEGIN
    SELECT is_allowed INTO v_override FROM permission_overrides po
    JOIN permissions p ON po.permission_id = p.id
    WHERE po.user_id = p_user_id AND p.scope = p_scope AND p.action = p_action;
    IF v_override IS NOT NULL THEN RETURN v_override; END IF;
    SELECT EXISTS (
        SELECT 1 FROM user_roles ur JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id AND p.scope = p_scope AND p.action = p_action
    ) INTO v_has_role;
    RETURN v_has_role;
END; $$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION user_has_role(p_user_id UUID, p_role_name TEXT) RETURNS BOOLEAN AS $$
    SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = p_user_id AND r.name = p_role_name);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION user_holds_responsibility(p_user_id UUID, ******** TEXT, p_org_unit_id UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM responsibility_assignments ra
        JOIN responsibility_type_definitions rtd ON ra.responsibility_type_id = rtd.id
        WHERE ra.user_id = p_user_id AND rtd.key = ********
        AND ra.org_unit_id = p_org_unit_id AND ra.status = 'ACTIVE'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================================
-- 26. RLS
-- ============================================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE responsibility_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_control_rules ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_jwt_session_org_id() RETURNS UUID AS $$
    SELECT COALESCE(current_setting('request.jwt.claims', true)::jsonb->'app_metadata'->>'organization_id',
        '00000000-0000-0000-0000-000000000000')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION current_session_user_id() RETURNS UUID AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb->>'sub','')::uuid;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION is_org_unit_scope_visible(p_org_unit_id UUID) RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM org_units target, org_units mine
        WHERE target.id = p_org_unit_id
        AND mine.id = (SELECT org_unit_id FROM users WHERE id = current_session_user_id())
        AND target.path <@ mine.path
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE POLICY org_tenant_isolation ON organizations FOR ALL USING (id = get_jwt_session_org_id());
CREATE POLICY user_tenant_isolation ON users FOR ALL USING (organization_id = get_jwt_session_org_id());
CREATE POLICY org_unit_tenant_isolation ON org_units FOR ALL USING (organization_id = get_jwt_session_org_id());

CREATE POLICY task_scope ON tasks FOR SELECT USING (
    organization_id = get_jwt_session_org_id()
    AND (is_org_unit_scope_visible(org_unit_id) OR user_has_role(current_session_user_id(), 'Director'))
);
CREATE POLICY task_write_scope ON tasks FOR INSERT WITH CHECK (
    organization_id = get_jwt_session_org_id() AND is_org_unit_scope_visible(org_unit_id)
);

CREATE POLICY wallet_scope ON wallets FOR SELECT USING (
    organization_id = get_jwt_session_org_id()
    AND (owner_user_id = current_session_user_id()
         OR user_has_role(current_session_user_id(), 'Director')
         OR check_user_permission(current_session_user_id(), 'finance', 'view'))
);

CREATE POLICY ledger_tenant_isolation ON token_transactions FOR ALL USING (organization_id = get_jwt_session_org_id());
CREATE POLICY loan_scope ON loans FOR SELECT USING (
    organization_id = get_jwt_session_org_id()
    AND (user_id = current_session_user_id() OR user_has_role(current_session_user_id(),'Director')
         OR check_user_permission(current_session_user_id(),'finance','view'))
);
CREATE POLICY audit_log_tenant_isolation ON audit_logs FOR SELECT USING (
    organization_id = get_jwt_session_org_id() AND check_user_permission(current_session_user_id(),'audit','view')
);
CREATE POLICY responsibility_scope ON responsibility_assignments FOR SELECT USING (
    organization_id = get_jwt_session_org_id() AND is_org_unit_scope_visible(org_unit_id)
);
CREATE POLICY config_tables_admin_only_wf ON workflow_definitions FOR ALL USING (
    organization_id = get_jwt_session_org_id() AND (user_has_role(current_session_user_id(),'Director') OR user_has_role(current_session_user_id(),'System Admin'))
);
CREATE POLICY config_tables_admin_only_br ON business_rules FOR ALL USING (
    organization_id = get_jwt_session_org_id() AND (user_has_role(current_session_user_id(),'Director') OR user_has_role(current_session_user_id(),'System Admin'))
);
CREATE POLICY config_tables_admin_only_acl ON access_control_rules FOR ALL USING (
    organization_id = get_jwt_session_org_id() AND (user_has_role(current_session_user_id(),'Director') OR user_has_role(current_session_user_id(),'System Admin'))
);

COMMIT;

MODIFICATIONS : 
-- ============================================================================
-- WORKLEDGER SCHEMA PATCH v4.1 — fixes the 3 flagged issues only
-- Apply after the v4 schema. Nothing else is altered.
-- ============================================================================
BEGIN;

-- FIX 1: tenant isolation was missing on two config tables
ALTER TABLE reference_qualifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ref_qual_tenant_isolation ON reference_qualifiers
    FOR ALL USING (organization_id = get_jwt_session_org_id());

CREATE POLICY notify_def_tenant_isolation ON notification_definitions
    FOR ALL USING (organization_id = get_jwt_session_org_id());

-- FIX 2: wallet_keys had organization_id but RLS was never turned on
ALTER TABLE wallet_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_keys_tenant_isolation ON wallet_keys
    FOR ALL USING (organization_id = get_jwt_session_org_id());

-- FIX 3: real recursion guard (depth counter), not a vocabulary-limiting CHECK
CREATE OR REPLACE FUNCTION apply_business_rules(
    p_organization_id UUID, p_entity_type TEXT, p_entity_id UUID, p_to_state TEXT,
    p_depth INT DEFAULT 0
) RETURNS VOID AS $$
DECLARE r business_rules%ROWTYPE;
BEGIN
    IF p_depth > 5 THEN
        RAISE EXCEPTION 'Business rule recursion depth exceeded for entity % (possible rule loop)', p_entity_id;
    END IF;

    FOR r IN SELECT * FROM business_rules
        WHERE organization_id = p_organization_id AND entity_type = p_entity_type
        AND is_active AND trigger_event = 'ON_TRANSITION'
        AND (trigger_condition->>'to_state') = p_to_state
        ORDER BY execution_order
    LOOP
        BEGIN
            IF r.action_type = 'INCREMENT_FIELD' THEN
                EXECUTE format(
                    'UPDATE %I SET %I = %I + $2 WHERE id = $1',
                    r.action_params->>'target_table', r.action_params->>'field', r.action_params->>'field'
                ) USING (SELECT assigned_to_id FROM tasks WHERE id = p_entity_id),
                        (SELECT credit_value FROM tasks WHERE id = p_entity_id);
            END IF;
            INSERT INTO business_rule_execution_log(business_rule_id, entity_id, result_status)
            VALUES (r.id, p_entity_id, 'SUCCESS');
        EXCEPTION WHEN OTHERS THEN
            INSERT INTO business_rule_execution_log(business_rule_id, entity_id, result_status, result_detail)
            VALUES (r.id, p_entity_id, 'FAILED', jsonb_build_object('error', SQLERRM));
        END;
    END LOOP;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION execute_workflow_transition(
    p_organization_id UUID, p_entity_type TEXT, p_entity_id UUID,
    p_to_state TEXT, p_actor_id UUID, p_depth INT DEFAULT 0
) RETURNS BOOLEAN AS $$
DECLARE
    v_wf_id UUID;
    v_current_state TEXT;
    v_transition workflow_transitions%ROWTYPE;
BEGIN
    IF p_entity_type = 'tasks' THEN
        SELECT status INTO v_current_state FROM tasks WHERE id = p_entity_id FOR UPDATE;
    ELSIF p_entity_type = 'loans' THEN
        SELECT status INTO v_current_state FROM loans WHERE id = p_entity_id FOR UPDATE;
    ELSE
        RAISE EXCEPTION 'Unknown entity_type %', p_entity_type;
    END IF;

    SELECT id INTO v_wf_id FROM workflow_definitions
    WHERE organization_id = p_organization_id AND entity_type = p_entity_type AND is_active;

    SELECT * INTO v_transition FROM workflow_transitions
    WHERE workflow_definition_id = v_wf_id AND from_state = v_current_state AND to_state = p_to_state;

    IF v_transition.id IS NULL THEN
        RAISE EXCEPTION 'Invalid transition % -> % for %', v_current_state, p_to_state, p_entity_type;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = p_actor_id
        AND r.scope_level IN (SELECT jsonb_array_elements_text(v_transition.allowed_role_scopes))
    ) THEN
        RAISE EXCEPTION 'Actor % not authorized for this transition', p_actor_id;
    END IF;

    IF v_transition.requires_approval_chain_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM approval_instances
            WHERE subject_type = p_entity_type AND subject_id = p_entity_id
            AND chain_definition_id = v_transition.requires_approval_chain_id AND status = 'APPROVED'
        ) THEN
            RAISE EXCEPTION 'Transition requires completed approval chain';
        END IF;
    END IF;

    IF p_entity_type = 'tasks' THEN
        UPDATE tasks SET status = p_to_state::task_status, updated_at = clock_timestamp() WHERE id = p_entity_id;
    ELSIF p_entity_type = 'loans' THEN
        UPDATE loans SET status = p_to_state::loan_status WHERE id = p_entity_id;
    END IF;

    INSERT INTO workflow_transition_log(organization_id, entity_type, entity_id, from_state, to_state, actor_id, transition_id)
    VALUES (p_organization_id, p_entity_type, p_entity_id, v_current_state, p_to_state, p_actor_id, v_transition.id);

PERFORM apply_business_rules(p_organization_id, p_entity_type, p_entity_id, p_to_state, p_depth + 1);

    RETURN true;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 20. AUTH USER TRIGGER (Handle new Supabase Auth signups & OAuth)
-- ============================================================================
-- This trigger fires when auth.users is created and automatically creates
-- the corresponding users row, organization, role, and wallets.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user() RETURNS TRIGGER AS $$
DECLARE 
    v_invite_id UUID;
    v_invite_org_id UUID;
    v_invite_unit_id UUID;
    v_invite_role_id UUID;
    v_org_id UUID;
    v_unit_id UUID;
    v_role_id UUID;
    v_has_invitations BOOLEAN;
    v_user_name TEXT;
BEGIN
    v_user_name := COALESCE(
        NEW.raw_user_meta_data->>'name',
        NEW.raw_user_meta_data->>'full_name',
        SPLIT_PART(NEW.email, '@', 1)
    );

    -- Check if invitations table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'invitations'
    ) INTO v_has_invitations;

    IF v_has_invitations THEN
        BEGIN
            EXECUTE 'SELECT id, organization_id, org_unit_id, intended_role_id FROM public.invitations WHERE email = $1 AND status = ''PENDING'' AND expires_at > clock_timestamp() ORDER BY created_at DESC LIMIT 1'
            INTO v_invite_id, v_invite_org_id, v_invite_unit_id, v_invite_role_id
            USING NEW.email;
        EXCEPTION WHEN OTHERS THEN
            v_invite_id := NULL;
        END;
    END IF;

    IF v_invite_id IS NOT NULL THEN
        -- Invited user signup flow
        INSERT INTO public.users (id, organization_id, org_unit_id, email, name, status, employment_type)
        VALUES (
            NEW.id, v_invite_org_id, v_invite_unit_id, NEW.email,
            v_user_name,
            'ACTIVE'::user_status,
            'FULL_TIME'::employment_type
        )
        ON CONFLICT (id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            org_unit_id = EXCLUDED.org_unit_id,
            name = EXCLUDED.name,
            status = 'ACTIVE';

        IF v_invite_role_id IS NOT NULL THEN
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (NEW.id, v_invite_role_id)
            ON CONFLICT DO NOTHING;
        END IF;
        
        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_invite_org_id, NEW.id, 'PERSONAL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;
        
        EXECUTE 'UPDATE public.invitations SET status = ''ACCEPTED'' WHERE id = $1' USING v_invite_id;
    ELSE
        -- Self-signup / OAuth flow (New organization creator)
        INSERT INTO public.organizations (name, type)
        VALUES (
            v_user_name || '''s Organization',
            'GENERIC'::organization_type
        )
        RETURNING id INTO v_org_id;

        -- Create root department org_unit
        INSERT INTO public.org_units (organization_id, name, unit_type)
        VALUES (
            v_org_id,
            'Main',
            'DEPARTMENT'
        )
        RETURNING id INTO v_unit_id;

        -- Create user record in public.users
        INSERT INTO public.users (id, organization_id, org_unit_id, email, name, status, employment_type)
        VALUES (
            NEW.id, v_org_id, v_unit_id, NEW.email,
            v_user_name,
            'ACTIVE'::user_status,
            'FULL_TIME'::employment_type
        )
        ON CONFLICT (id) DO UPDATE SET
            organization_id = EXCLUDED.organization_id,
            org_unit_id = EXCLUDED.org_unit_id,
            name = EXCLUDED.name,
            status = 'ACTIVE';

        -- Create standard DIRECTOR role for this organization
        INSERT INTO public.roles (organization_id, name, scope_level, is_system_role)
        VALUES (v_org_id, 'Director', 'DIRECTOR', true)
        RETURNING id INTO v_role_id;

        INSERT INTO public.user_roles (user_id, role_id)
        VALUES (NEW.id, v_role_id)
        ON CONFLICT DO NOTHING;

        -- Create wallets
        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, NEW.id, 'PERSONAL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, NEW.id, 'SALARY_POOL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;

        INSERT INTO public.wallets (organization_id, owner_user_id, purpose, balance)
        VALUES (v_org_id, NEW.id, 'LOAN_POOL'::wallet_purpose, 0)
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user error for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END; $$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists (for idempotency)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users AFTER INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMIT;
