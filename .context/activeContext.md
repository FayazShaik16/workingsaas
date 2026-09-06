# Active Context (Sprint Execution Layer)

## Current Micro-Task
- **Task**: Core Demo Flow Repair, Simple Sepolia ERC-20 (`WorkLedgerToken.sol`) Integration, Org Provisioning & Nominations Flow.
- **Status**: Completed (0 TypeScript errors, live database tests verified, demo runbook & diagnostics created).
- **Target Files Checked & Fixed**:
  - `contracts/WorkLedgerToken.sol` (Minimal standard ERC-20 with Ownable + mint)
  - `lib/blockchain/WorkTokenABI.json` & `lib/blockchain/work-token.ts` (Minimal ABI surface, executeSalaryMint, Sepolia diagnostics)
  - `app/(workspace)/[orgId]/config/departments/page.tsx` & `app/api/admin/departments/route.ts` (Fixed disappearing departments, removed missing `code` column, added revalidatePath)
  - `app/(workspace)/[orgId]/config/people/page.tsx` & `components/admin/people-manager-client.tsx` (Fixed cross-org role pollution, scoped roles strictly to organization_id)
  - `app/(workspace)/[orgId]/config/import/page.tsx` & `components/admin/bulk-import-client.tsx` & `app/api/admin/bulk-import-users/route.ts` (Complete bulk people import with templates, preview, password reset flag)
  - `app/api/dept-admin/import-schedule/route.ts` (Enforced department isolation for Dept Admin schedule imports)
  - `app/(workspace)/[orgId]/lead/nominations/page.tsx` & `components/lead/hod-nominations-client.tsx` & `app/api/tasks/reject-nomination/route.ts` (Built HOD nomination review and assignment)
  - `app/api/finance/settle-salary/route.ts` & `components/finance/finance-salary-console.tsx` (Built real Sepolia WORK minting settlement)
  - `scripts/demo-readiness-check.ts`, `docs/TOMORROW_DEMO_RUNBOOK.md`, `docs/CORE_FLOW_VERIFICATION.md`

## Next Operational Action
- Execute `scripts/demo-readiness-check.ts` and conduct live walkthrough with demo accounts.

