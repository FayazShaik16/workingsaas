# WorkLedger Deployment Consistency Audit

## 1. Executive Summary
This document provides a comprehensive audit of the transition from legacy academic/attendance surveillance modules to the **Trusted Work-Organization Model**. All active navigation, UI components, API routes, and database interactions across all roles now share a single, strictly typed server data contract.

---

## 2. Retired Legacy Systems & Routes

| Legacy Module / Concept | Previous Location / Table | Status | Replacement in Trusted Work Architecture |
|---|---|---|---|
| Academic Timetable Builder | `/dept-admin/timetable`, `timetable_slots` | **RETIRED** | `/dept-admin/schedules` & `scheduled_work_templates` |
| Academic Batches & Programs | `/dept-admin/batches`, `academic_batches` | **RETIRED** | Work Cycles (`/dept-admin/work-cycles`, `work_cycles`) |
| Academic Subjects | `/dept-admin/subjects`, `subjects` | **RETIRED** | Weekly Schedule Templates (`scheduled_work_templates`) |
| Academic Programmes | `/dept-admin/programmes`, `academic_programs` | **RETIRED** | Organization Units (`org_units`) |
| Attendance Surveillance | `/lead/verify`, `attendance_records` | **RETIRED** | Structured Self-Completion on Trust (`scheduled_work_instances`) |
| Leave Surveillance | `/member/leave`, `/lead/leaves`, `leave_requests` | **RETIRED** | Monthly Target Delivery on Trust (`monthly_work_progress`) |
| Mutable `progress_percentage` column | `users.progress_percentage` | **RETIRED** | Derived/computed ledger state (`monthly_work_progress`, `credit_ledger_entries`) |
| Wallet balance as work credits | `wallets.balance` | **RETIRED** | Immutable `credit_ledger_entries` sum |
| Deficit & Fairness Filter marketing | `marketplace-discovery-grid.tsx` | **RETIRED** | Clean, neutral Task Pool discovery (`getScopedTaskPool`) |
| Duplicate Non-`[orgId]` Routes | `/member`, `/director`, `/finance`, `/lead`, `/config` | **REDIRECTED** | Canonical `/[orgId]/<role>` standard App Router paths |

---

## 3. Shared Server Data Contract (`lib/workledger/`)

All workspace roles (Faculty Member, HOD / Dept Lead, Dept Admin, Director, Finance) now query the exact same business logic engine:

1. **`lib/workledger/current-cycle.ts`**:
   - Fetches active `work_cycles` for the tenant.
   - Computes month start (`YYYY-MM-01`) and today's date in tenant timezone.
   - Resolves user's assigned department (`org_unit_id`).

2. **`lib/workledger/progress.ts` (`MonthlyProgressView`)**:
   - `scheduled_target_credits` = sum of applicable scheduled instances for current month.
   - `total_target_credits` = `scheduled_target / (scheduled_weight_percentage / 100)`.
   - `raw_earned_credits` = sum of all `credit_ledger_entries` for this cycle and month.
   - `display_progress_percentage` = `min(100.00, round((raw_earned / total_target) * 100, 2))`.
   - `above_target_credits` = `max(0, raw_earned - total_target)`.
   - `salary_eligible` = `raw_earned >= total_target * (salary_threshold_percentage / 100)`.
   - Honest zero state: if no active cycle or instances, `configured = false` with no arbitrary fallback numbers.

3. **`lib/workledger/member-dashboard.ts`**:
   - Serves the compact two-column responsive faculty dashboard.
   - Combines `progress`, `todayInstances`, `nextUpcomingInstance`, `assignedTasks` (sorted by priority), and `recentActivity`.

4. **`lib/workledger/department-dashboard.ts`**:
   - Powers HOD management views with strict department isolation.
   - Provides metrics, attention items, faculty progress, scheduled review queue, pending proof submissions, and salary requests.

5. **`lib/workledger/task-pool.ts`**:
   - Enforces department visibility scoping (`ORG_UNIT` vs `ORGANIZATION`).

6. **`lib/workledger/permissions.ts`**:
   - `assertDepartmentScope(actor, targetOrgUnitId, permittedRoles)` prevents cross-department data leakage or unauthorized approval actions.

---

## 4. UI/UX Standard Consistency
- **Theme**: Standard Shadcn UI tokens (`bg-card`, `border`, `text-foreground`, `text-muted-foreground`).
- **Progress Visualization**: Compact SVG circular progress ring (`CircularProgressRing`) displaying exact progress capped at 100%, with above-target credits clearly itemized.
- **Color Discipline**: All dark-blue panels, neon glows, and non-standard custom blues removed in favor of clean semantic tokens.
