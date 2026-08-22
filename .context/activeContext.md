# Active Context (Sprint Execution Layer)

## Current Micro-Task
- **Task**: Finalize Unified Shared Data Contract, Department Isolation, Responsive 2-Column Faculty Dashboard, Clean Shadcn UI, and Production Verification.
- **Target Files Mutated**:
  - `lib/workledger/current-cycle.ts` (Active cycle & tenant context)
  - `lib/workledger/progress.ts` (Unified `MonthlyProgressView` calculation & ledger sync)
  - `lib/workledger/member-dashboard.ts` (Responsive 2-column member dashboard service)
  - `lib/workledger/department-dashboard.ts` (HOD isolated department dashboard service)
  - `lib/workledger/task-pool.ts` (Department-scoped Task Pool service)
  - `lib/workledger/permissions.ts` (Department isolation assertions)
  - `components/member/minimal-faculty-dashboard.tsx` (Responsive 2-column layout: Left ~60% Today's Sessions, Right ~40% Monthly Progress with circular ring)
  - `components/member/circular-progress-ring.tsx` (SVG progress ring capped at 100%)
  - `components/lead/trusted-hod-manager-view.tsx` (HOD management console)
  - `components/lead/lead-dashboard-container.tsx` (Dual context switcher: Department View + My Work)
  - `components/lead/hod-salary-approval-console.tsx` (Department salary endorsement console)
  - `components/marketplace/marketplace-discovery-grid.tsx` (Clean task discovery without legacy marketing copy)
  - `app/(workspace)/[orgId]/member/page.tsx` & `member/marketplace/page.tsx` & `member/earnings/page.tsx`
  - `app/(workspace)/[orgId]/lead/page.tsx` & `lead/salary/page.tsx` & `lead/leaves/page.tsx`
  - `app/(workspace)/[orgId]/director/page.tsx` & `director/reports/page.tsx` & `director/org-tree/page.tsx` & `director/loans/page.tsx`
  - `app/(workspace)/[orgId]/finance/page.tsx` & `finance/salary/page.tsx`
  - `app/(workspace)/[orgId]/config/users/page.tsx`
  - `app/(workspace)/member/page.tsx`, `director/page.tsx`, `finance/page.tsx`, `lead/page.tsx`, `config/page.tsx`, `settings/page.tsx` (Redirected legacy non-`[orgId]` routes)
  - `app/api/lead/approve-proof/route.ts` & `reject-proof/route.ts` & `endorse-salary/route.ts`
  - `app/api/member/claim-salary/route.ts`
  - `docs/DEPLOYMENT_CONSISTENCY_AUDIT.md` & `docs/DEPLOYMENT_E2E_TEST_REPORT.md`

## Next Operational Action
- Execute `git add .`, commit with `fix(trusted-work): unify live dashboards, department isolation, and progress contract`, and push to `origin/main`.
