# Progress Ledger

| [BUILT] | [BROKEN] | [LEFT TO DO] |
| --- | --- | --- |
| [2026-08-02] Restructured workspace routing to dynamic `/[orgId]/[role]` | None | [ ] Push commits to origin/main |
| [2026-08-02] Dynamic validation layout at `[orgId]/layout.tsx` | | [ ] Rehearse 9:00 AM demo click-path |
| [2026-08-03] Fixed client-side role switcher and dynamic menu mapping | | |
| [2026-08-03] Created Director Invite Team Page | | |
| [2026-08-03] Decoupled signup invitation acceptor route & page flow | | |
| [2026-08-03] Org Structure Tree & HOD/Lead Builder | | |
| [2026-08-10] Re-architected interactive Org Tree Visualizer | | |
| [2026-08-10] Eliminated hardcoded mock data across all dashboards | | |
| [2026-08-11] Full architectural redesign — academic domain model | | |
| [2026-08-11] db-patch-v2.sql written (9 new tables, RLS, triggers, views) | | |
| [2026-08-11] New AppSidebar with Framer Motion hover-expand, mobile drawer | | |
| [2026-08-11] CSS glassmorphism + scrollbar utilities added | | |
| [2026-08-11] canvas-shell rewritten with DEPT_ADMIN role support | | |
| [2026-08-19] Phase 0: Eradicated token_value in favor of credit_value, killed fallback mocks (5000/10000), created getTeachingStaff query helper | | |
| [2026-08-19] Phase 1: Bulk faculty CSV/XLSX importer with auto-mapping + first-login forced password change at /auth/change-password | | |
| [2026-08-19] Phase 2: Timetable CSV/XLSX importer + 75/25 credit compiler engine + checkSalaryEligibility RPC | | |
| [2026-08-19] Phase 3: Task pool visibility scoping (ORGANIZATION vs ORG_UNIT) with department isolation | | |
| [2026-08-19] Phase 4: Attendance -> HOD Verification -> PERSONAL wallet credit -> Progress Recompute -> Salary Claim / Work Loan -> Finance Batch Reversal | | |
| [2026-08-19] Phase 5: Dashboard truthfulness pass — 100% database-driven queries with honest zero states | | |
| [2026-08-19] Phase 6: Demo seed datasets (faculty_import.csv, timetable_import.csv) + comprehensive presentation script (DEMO_SCRIPT.md) | | |
| [2026-08-19] Phase 7: Live Runtime Acceptance Suite (Tests A-M) executed & verified 100% PASS against Supabase | | |
| [2026-08-19] Phase 8: Demo Credential Recovery & Restoration — reset & verified deterministic passwords for 4 demo accounts | | |
| [2026-08-19] Master Rebuild Phase 0: Role model & actor separation — SYSTEM_ADMIN only signup, preview-mode banner, strict MEMBER teaching staff filter | | |
| [2026-08-19] Master Rebuild Phase 1: Real bulk faculty CSV/XLSX import with initial honest 0 targets & forced password rotation | | |
| [2026-08-19] Master Rebuild Phase 2: Dept Admin CRUD modules + 75/25 timetable schedule compiler | | |
| [2026-08-19] Master Rebuild Phase 3: Total eradication of token_value bug + organization vs org_unit task pool scoping | | |
| [2026-08-19] Master Rebuild Phase 4: Attendance submission -> HOD verification -> Personal wallet credit -> Live progress recompute | | |
| [2026-08-19] Master Rebuild Phase 5: Sepolia ERC-20 blockchain integration with ethers.js v6, AES-256 in-memory keys, WalletCard UI, and Etherscan links | | |
| [2026-08-19] Master Rebuild Phase 6: Live Rehearsal Guide (demo/REHEARSAL_NOTES.md) & 0-error TypeScript validation | | |
| [2026-08-19] Runtime Hotfix: Fixed role constraint 42P10 bug in ensure-user.ts (safe query-first role & wallet seeding, assigning SYSTEM_ADMIN on fresh signup), fixed [earnings] fetch error on missing wallet, and built /api/dept-admin/curriculum for bulletproof Program/Subject/Batch/Timetable CRUD | | |
| [2026-08-19] Timetable & Batch Schema Fix: Removed nonexistent student_count column queries across batches/schedule/API routes, and updated dept-admin/timetable page to fetch programs, subjects, batches, and faculty organization-wide with createAdminClient | | |
| [2026-08-19] Timetable Compiler & Faculty UX Fix: Fixed timetable-compiler query-first deduplication (preventing partial-index 42P10 failure), enabled faculty tasks page to query both direct assignments and nominations, removed hardcoded 50 fallback in compiler, and simplified member earnings UI into an institutional academic credit ledger (removing blockchain jargon for faculty) | | |
| [2026-08-19] Faculty Teaching Schedule & Attendance Pipeline Fix: Removed nonexistent task_type_code and timetable_slots.faculty_id queries from member/schedule/page.tsx, allowing allocated classes (e.g. Wednesday period 2) to render immediately for teacher@demo.com, and reinforced attendance logging & HOD approval routes with createAdminClient | | |
| [2026-08-22] Step 0 Audit: Generated docs/TRUSTED_REBUILD_AUDIT.md and JSON pre-reset export across all 17 public tables | | |
| [2026-08-22] Trusted Work Model: Wrote 20260822_workledger_trusted_work.sql with work_cycles, scheduled_work_templates, scheduled_work_instances, scheduled_work_completions, credit_ledger_entries, monthly_work_progress, salary_requests, and blockchain_wallets | | |
| [2026-08-22] Role Strictness: SYSTEM_ADMIN self-signup only, org_unit_id = null, eradicated DIRECTOR fallback in ensure-user.ts | | |
| [2026-08-22] Data Reset: Live table preview + typed phrase "RESET WORKLEDGER DEMO DATA" + 2nd confirm button at config/reset and /api/admin/reset-data | | |
| [2026-08-22] Timetable Engine: Built XLSX timetable import (/dept-admin/import) with canonical headers, dry-run validation preview, schedule matrix (/dept-admin/schedules), and idempotent instance generator (schedule-generator.ts) | | |
| [2026-08-22] Faculty Dashboard: Minimal Faculty Dashboard with live Monthly Progress card (85% threshold, extra credits above target), today's scheduled sessions with 2-step confirmation modal (ScheduledCompletionModal), assigned ad-hoc work, and compact Task Pool link | | |
| [2026-08-22] HOD Workspace: Dual View (Employee + Manager) with scheduled review feed, ad-hoc task management, nominations review, and salary endorsement | | |
| [2026-08-22] Real Sepolia ERC-20: Built lib/blockchain/work-token.ts with ethers v6, AES-256-GCM encryption, readiness check route (/api/admin/blockchain/readiness), and honest "Not configured" UI states | | |
| [2026-08-22] Build Validation: 0 TypeScript errors (npx tsc --noEmit) and 100% successful Next.js production build (npm run build) | | |
| [2026-08-22] Unified Data Contract: Built lib/workledger/ (current-cycle, progress, member-dashboard, department-dashboard, task-pool, permissions) with strict department isolation and zero legacy mock defaults | | |
| [2026-08-22] UI Refactor: Built responsive 2-column faculty dashboard (Left ~60% Today's Sessions, Right ~40% Monthly Progress with circular ring capped at 100%), full-width prioritized initiatives, and clean standard Shadcn tokens | | |
| [2026-08-22] Legacy Retirement & Redirection: Redirected all non-[orgId] routes to canonical [orgId] paths, retired legacy academic modules & surveillance routes | | |
| [2026-08-22] Verification Reports: Generated docs/DEPLOYMENT_CONSISTENCY_AUDIT.md and docs/DEPLOYMENT_E2E_TEST_REPORT.md with full pass matrix | | |
