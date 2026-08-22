# Active Context (Sprint Execution Layer)

## Current Micro-Task
- **Task**: Final Core Repair — Org Provisioning, Strict Role Separation, Task Lifecycle, Department Isolation, Live Wallets, and Zero-Mock-Data Verification.
- **Status**: Completed & Verified 100% against live Supabase (`bzgqvwqzbjqpfunnyfwe`) and production Next.js build (51 routes).
- **Target Files Mutated**:
  - `supabase/migrations/20260822_core_repair_and_isolation.sql`
  - `lib/auth/ensure-user.ts`, `lib/auth/protect.ts`, `lib/auth/get-redirect.ts`
  - `lib/workledger/default-task-type.ts`, `lib/workledger/task-pool.ts`, `lib/workledger/permissions.ts`, `lib/workledger/member-dashboard.ts`
  - `lib/blockchain/work-token.ts`
  - `app/api/tasks/create-unstructured/route.ts`, `app/api/tasks/create/route.ts`, `app/api/tasks/nominate/route.ts`, `app/api/tasks/assign/route.ts`
  - `app/api/admin/departments/route.ts`, `app/api/admin/provision-user/route.ts`, `app/api/admin/cleanup-legacy-units/route.ts`
  - `app/api/wallets/me/route.ts`, `app/api/wallets/treasury/route.ts`
  - `app/(workspace)/[orgId]/config/departments/page.tsx`, `components/admin/department-manager-client.tsx`
  - `app/(workspace)/[orgId]/config/people/page.tsx`, `components/admin/people-manager-client.tsx`
  - `app/(workspace)/[orgId]/config/invitations/page.tsx`
  - `app/(workspace)/[orgId]/config/cleanup/page.tsx`, `components/admin/legacy-cleanup-client.tsx`
  - `app/(workspace)/[orgId]/config/blockchain/page.tsx`, `components/admin/blockchain-readiness-client.tsx`
  - `app/(workspace)/[orgId]/member/wallet/page.tsx`, `app/(workspace)/[orgId]/lead/wallet/page.tsx`, `app/(workspace)/[orgId]/director/wallet/page.tsx`
  - `components/wallet/member-wallet-view.tsx`, `components/wallet/director-treasury-view.tsx`
  - `components/shell/app-sidebar.tsx`, `components/shell/canvas-shell.tsx`
  - `.env.example`, `docs/FINAL_CORE_FLOW_TEST_REPORT.md`

## Next Operational Action
- Execute `git add .`, commit with `fix(core): separate org roles, repair tasks, enforce department scope, and add live wallets`, and push to `origin/main`.
