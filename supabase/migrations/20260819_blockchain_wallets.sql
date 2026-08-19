-- ============================================================================
-- WorkLedger: Blockchain Wallets & On-Chain Transaction Audit Mirror
-- Migration: 20260819_blockchain_wallets.sql
-- ============================================================================

-- 1. Blockchain Wallets Table
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

CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_org ON public.blockchain_wallets(organization_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_user ON public.blockchain_wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_wallets_address ON public.blockchain_wallets(public_address);

-- 2. Blockchain Transactions Audit Table
CREATE TABLE IF NOT EXISTS public.blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    from_address TEXT,
    to_address TEXT,
    amount NUMERIC(18, 4) NOT NULL DEFAULT 0,
    tx_hash TEXT NOT NULL,
    block_number BIGINT,
    network TEXT NOT NULL DEFAULT 'sepolia',
    event_type TEXT NOT NULL CHECK (event_type IN ('MINT', 'TASK_REWARD', 'SALARY_CLAIM', 'LOAN_DISBURSEMENT', 'BATCH_REVERSAL')),
    token_transaction_id UUID REFERENCES public.token_transactions(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blockchain_tx_org ON public.blockchain_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_tx_hash ON public.blockchain_transactions(tx_hash);

-- Enable RLS
ALTER TABLE public.blockchain_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blockchain_transactions ENABLE ROW LEVEL SECURITY;

-- Permissive authenticated read policies for multi-tenancy
CREATE POLICY "Users can view blockchain wallets in their organization"
    ON public.blockchain_wallets FOR SELECT
    TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));

CREATE POLICY "Users can view blockchain transactions in their organization"
    ON public.blockchain_transactions FOR SELECT
    TO authenticated
    USING (organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid()));
