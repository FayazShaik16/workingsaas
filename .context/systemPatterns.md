# System Patterns & Contracts

## Technology Choices
- Next.js 15 (App Router)
- Supabase (PostgreSQL & GoTrue Auth)
- Tailwind CSS & Shadcn UI

## Trusted Work & Ledger Architectural Contracts
- **Immutable Ledger Entry**: All credit events are stored as discrete rows in `credit_ledger_entries` with unique idempotency keys (`idempotency_key`).
- **Progress Calculation**: `monthly_work_progress` is computed from `credit_ledger_entries` using `min(100, round((raw_earned / total_target) * 100))`. Progress is never arbitrarily incremented or mutated.
- **Two-Step Self-Completion**: Faculty declare session completion on trust via `ScheduledCompletionModal` + `confirm_scheduled_work_instance` RPC. Second click cannot duplicate credits.
- **HOD Verification Scope**: HOD reviews unstructured/ad-hoc tasks and salary endorsement; scheduled work is self-declared on trust with review/flag audit logs.
- **Tenant Operator Separation**: Fresh signup assigns strictly `SYSTEM_ADMIN` (`org_unit_id = null`). Operator never receives academic director or member roles by default.
- **Real Sepolia Integration**: On-chain ERC-20 transfer executed on Ethereum Sepolia Testnet only upon HOD-approved salary settlement. If environment keys are absent, UI renders safe "Not configured" state (0 fake hashes/blocks).

