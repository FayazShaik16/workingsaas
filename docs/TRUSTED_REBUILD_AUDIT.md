# WorkLedger: Trusted Work-Organization Rebuild Audit
**Document Identifier:** `docs/TRUSTED_REBUILD_AUDIT.md`  
**Audit Timestamp:** `2026-08-21T22:40:00Z`  
**Repository:** `mithileshkumarrattu/saas`  
**Supabase Project Reference:** `bzgqvwqzbjqpfunnyfwe`  
**Lead Engineer:** Antigravity Principal Engineer

---

## 1. Current Source Files and Routes Inventory

### 1.1 App Router Role Scopes (`app/(workspace)/[orgId]`)
| Role Route Base | Path | Status | Rebuild Action |
|---|---|---|---|
| `config` (SYSTEM_ADMIN) | `app/(workspace)/[orgId]/config` | Active | Streamline as pure technical tenant operator: organization configuration, departments, user management, work cycles, data reset with preview, system settings. |
| `director` (DIRECTOR) | `app/(workspace)/[orgId]/director` | Active | Organization overview, departments progress summary, org-wide ad-hoc task creation, announcements. Remove micro-timetable editing. |
| `lead` (ORG_UNIT_LEAD) | `app/(workspace)/[orgId]/lead` | Active | Rebuild into lean department workspace: department snapshot, scheduled self-completion review feed, ad-hoc task creation/assignment/proof verification, salary approval queue. Remove attendance/leave queue. |
| `dept-admin` (DEPT_ADMIN) | `app/(workspace)/[orgId]/dept-admin` | Active | Convert into operational timetable/import support helper: Faculty, Schedules (templates & generated instances), Work Cycles, Import Center, Settings. Remove Programs, Subjects, Batches, Curriculum. |
| `member` (MEMBER) | `app/(workspace)/[orgId]/member` | Active | Personal work organizer: Header greeting, live monthly progress card (75% scheduled weight / 85% salary threshold), today's scheduled tasks (with 2-step self-completion modal), assigned ad-hoc tasks, compact Task Pool link. Remove leave requests, separate earnings/crypto pages. |
| `finance` (FINANCE_ADMIN) | `app/(workspace)/[orgId]/finance` | Active | Post-HOD-approved salary eligibility audit and on-chain confirmation viewer. |

### 1.2 Authentication & Role Resolution Modules
- [`lib/auth/ensure-user.ts`](file:///d:/SAAS/code/lib/auth/ensure-user.ts): Currently contains a fallback assigning role-less users to `DIRECTOR` and lacks strict separation for fresh signups. Must strictly assign **ONLY `SYSTEM_ADMIN`** (`org_unit_id: null`) on fresh self-signup and prevent any auto-promotion to `DIRECTOR` or `MEMBER`.
- [`lib/auth/session.ts`](file:///d:/SAAS/code/lib/auth/session.ts): Extracts session user, roles, and scope levels. Must strictly validate active organization and roles.
- [`lib/auth/protect.ts`](file:///d:/SAAS/code/lib/auth/protect.ts): Server component route guards. Needs clean separation between technical operator (`SYSTEM_ADMIN`, `DEPT_ADMIN`) and business roles (`DIRECTOR`, `ORG_UNIT_LEAD`, `MEMBER`).
- [`lib/auth/get-redirect.ts`](file:///d:/SAAS/code/lib/auth/get-redirect.ts): Role-to-route mapper. Must route `SYSTEM_ADMIN` $\rightarrow$ `config`, `DIRECTOR` $\rightarrow$ `director`, `ORG_UNIT_LEAD` $\rightarrow$ `lead`, `DEPT_ADMIN` $\rightarrow$ `dept-admin`, `MEMBER` $\rightarrow$ `member`.

---

## 2. Stale, Obsolete, and Surveillance Dependencies

### 2.1 Obsolete Tables to be Decoupled from Active Workflows
The following tables are legacy artifacts from the attendance surveillance model. They are retained in the database for migration safety, but **zero active UI routes, API endpoints, or new tasks may depend on them**:
1. `academic_programs`
2. `subjects`
3. `academic_batches`
4. `subject_assignments`
5. `timetable_slots`
6. `attendance_records`
7. `leave_requests`
8. `performance_snapshots`
9. `compensation_policies`

### 2.2 Obsolete Files & Functions
- `lib/engine/timetable-compiler.ts`: Replaced by `lib/engine/schedule-generator.ts` (pure template $\rightarrow$ instance generator).
- `app/api/attendance/submit/route.ts`: Replaced by `confirm_scheduled_work_instance` RPC and 2-step self-completion.
- `app/api/lead/batch-verify-attendance/route.ts`: Replaced by HOD scheduled work review / flagging feed and `approve_adhoc_task_and_award_credit` RPC.
- `app/api/dept-admin/curriculum/route.ts`: Decoupled from active Dept Admin navigation.
- `lib/blockchain/relayer.ts`: Simulated hash generation (e.g. `6_450_000 + ...`) replaced by real `ethers.js` v6 in `lib/blockchain/work-token.ts`.

---

## 3. Live Schema versus Repository Migration Drift

### 3.1 Live Table Inventory (Queried on `bzgqvwqzbjqpfunnyfwe.supabase.co`)
| Table Name | Live Row Count | Schema Status | Rebuild Strategy |
|---|---|---|---|
| `auth.users` | 50 | Live in GoTrue | Target for safe preview & cleanup via Supabase Admin API on explicit confirmation |
| `public.users` | 155 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.organizations` | 25 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.org_units` | 59 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.roles` | 86 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.user_roles` | 184 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.wallets` | 148 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.token_transactions` | 7 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.tasks` | 10 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.task_type_definitions` | 5 | Live in Postgres | Retain standard system definitions |
| `public.invitations` | 5 | Live in Postgres | Target for safe preview & cleanup on explicit confirmation |
| `public.academic_programs` | 15 | Live in Postgres | Decouple from all active UI/routes |
| `public.subjects` | 13 | Live in Postgres | Decouple from all active UI/routes |
| `public.academic_batches` | 12 | Live in Postgres | Decouple from all active UI/routes |
| `public.subject_assignments` | 12 | Live in Postgres | Decouple from all active UI/routes |
| `public.timetable_slots` | 31 | Live in Postgres | Decouple from all active UI/routes |
| `public.attendance_records` | 8 | Live in Postgres | Decouple from all active UI/routes |
| `public.work_cycles` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` |
| `public.scheduled_work_templates` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` |
| `public.scheduled_work_instances` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` |
| `public.scheduled_work_completions` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` |
| `public.credit_ledger_entries` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` (Immutable Source of Truth) |
| `public.monthly_work_progress` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` (Materialized Cache) |
| `public.salary_requests` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` |
| `public.blockchain_wallets` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` |
| `public.blockchain_transactions` | 0 | Missing live | Create via `20260822_workledger_trusted_work.sql` |

---

## 4. Missing Database Constraints & Fixes

1. **Role Uniqueness Constraint**:
   - `roles` must enforce `UNIQUE (organization_id, name)` or `UNIQUE (organization_id, scope_level, name)` to prevent role duplication on tenant creation.
2. **Work Template Composite Unique Constraint**:
   - `scheduled_work_templates` must enforce `UNIQUE (organization_id, assigned_to_id, work_cycle_id, weekly_day, start_time, end_time, title)`.
3. **Scheduled Instance Unique Constraint**:
   - `scheduled_work_instances` must enforce `UNIQUE (template_id, work_date)`.
4. **Completion Append-Only Constraint**:
   - `scheduled_work_completions` must enforce `UNIQUE (instance_id)`. Direct client write denied via RLS.
5. **Ledger Idempotency Constraint**:
   - `credit_ledger_entries` must enforce `UNIQUE (idempotency_key)`.
6. **Monthly Progress Scope Constraint**:
   - `monthly_work_progress` must enforce `UNIQUE (organization_id, user_id, work_cycle_id, month_start)`.
7. **Salary Request Month Constraint**:
   - `salary_requests` must enforce `UNIQUE (organization_id, user_id, work_cycle_id, month_start)`.

---

## 5. Mock / Simulated / Fake Blockchain Behaviors Found

1. **Simulated Block Numbers and Hashes**:
   - [`lib/blockchain/relayer.ts`](file:///d:/SAAS/code/lib/blockchain/relayer.ts#L88-L100): Calculated block numbers as `6_450_000 + (Math.floor(Date.now() / 12000) % 10_000)` and fake transaction hashes from SHA-256 strings.
   - **Resolution**: Eradicate simulated fallback. A Sepolia transaction is either broadcast to chain ID `11155111` with confirmed receipt or marked `NOT_CONFIGURED` / `FAILED`.
2. **Hardcoded Fallback Keys & Dummy Contract Addresses**:
   - [`lib/blockchain/wallet-utils.ts`](file:///d:/SAAS/code/lib/blockchain/wallet-utils.ts#L6-L8): Contained `DEFAULT_ENCRYPTION_KEY = "workledger-sepolia-aes-master-key-2026!"` and `0x9876543210123456789012345678901234567890`.
   - **Resolution**: Strict validation in `lib/blockchain/work-token.ts` that fails gracefully if env vars are missing and returns `configured: false`.

---

## 6. Page Visibility vs Legacy Deprecation Plan

| Page Route | User Visible Role | Action |
|---|---|---|
| `/[orgId]/member` | MEMBER | **Redesign**: Greeting $\rightarrow$ Monthly Progress Card (75% sched / 85% salary) $\rightarrow$ Today's Scheduled Tasks (2-step modal) $\rightarrow$ Assigned Ad-hoc Tasks $\rightarrow$ Task Pool link. |
| `/[orgId]/member/schedule` | MEMBER | **Redesign**: Clean weekly schedule matrix displaying recurring templates and today's status. |
| `/[orgId]/member/marketplace` | MEMBER | **Redesign**: Task Pool scoped to organization & department with single-click nomination. |
| `/[orgId]/member/leave` | MEMBER | **Hide / Deprecate**: Remove from sidebar. Trust-based model does not use leave surveillance. |
| `/[orgId]/member/earnings` | MEMBER | **Consolidate**: Merged into clean progress status on main dashboard. |
| `/[orgId]/lead` | ORG_UNIT_LEAD | **Redesign**: Lean department snapshot $\rightarrow$ Task Management workspace (Scheduled Review, Ad-hoc Tasks, Nominations, Salary Approvals). |
| `/[orgId]/lead/verify` & `leaves` | ORG_UNIT_LEAD | **Hide / Deprecate**: Remove from sidebar. |
| `/[orgId]/dept-admin` | DEPT_ADMIN | **Redesign**: Technical schedule/import helper: Faculty, Schedules, Work Cycles, Import Center, Settings. |
| `/[orgId]/dept-admin/programmes`, `batches`, `subjects`, `timetable` | DEPT_ADMIN | **Hide / Deprecate**: Remove academic curriculum tabs from navigation. |
| `/[orgId]/config` | SYSTEM_ADMIN | **Redesign**: Tenant setup, user management, bulk import, work cycles, data reset. |
| `/[orgId]/director` | DIRECTOR | **Redesign**: High-level organization overview, org-wide ad-hoc task creation, resource distribution. |
| `/[orgId]/finance` | FINANCE_ADMIN | **Redesign**: Post-HOD salary audit & Sepolia on-chain settlement viewer. |
