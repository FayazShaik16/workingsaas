# Legacy Academic Module Retirement & Classification Report

**Generated:** 2026-08-21  
**Project:** WorkLedger SaaS  
**Migration:** `20260822_workledger_trusted_work.sql`

This document classifies all references to legacy academic entities across the codebase into **ACTIVE** (replaced / removed from user paths), **LEGACY** (isolated / retired UI notice), and **MIGRATION/BACKUP** (historical database scripts and backup exports).

---

## 1. Classification Summary

| Search Query | Active Status | Classified Files | Actions Taken / Current State |
| :--- | :--- | :--- | :--- |
| `academic_programs` | **RETIRED** | `app/(workspace)/[orgId]/dept-admin/programmes/page.tsx`<br/>`components/dept-admin/batches-client.tsx`<br/>`app/api/dept-admin/curriculum/route.ts` | Replaced with "Legacy Academic Module Retired" card redirecting to `/[orgId]/dept-admin/schedules`. Removed from sidebar. |
| `subjects` | **RETIRED** | `app/(workspace)/[orgId]/dept-admin/subjects/page.tsx`<br/>`components/dept-admin/subjects-client.tsx` | Replaced with "Legacy Academic Module Retired" notice redirecting to `/[orgId]/dept-admin/schedules`. Removed from sidebar. |
| `academic_batches` | **RETIRED** | `app/(workspace)/[orgId]/dept-admin/batches/page.tsx`<br/>`components/dept-admin/batches-client.tsx` | Replaced with "Legacy Academic Module Retired" notice redirecting to `/[orgId]/dept-admin/schedules`. Removed from sidebar. |
| `subject_assignments`| **RETIRED** | `app/(workspace)/[orgId]/dept-admin/page.tsx`<br/>`app/(workspace)/[orgId]/member/schedule/page.tsx` | Removed from Dept Admin metrics and Faculty Schedule queries. Replaced with `scheduled_work_templates` and `scheduled_work_instances`. |
| `timetable_slots` | **RETIRED** | `app/(workspace)/[orgId]/dept-admin/timetable/page.tsx`<br/>`components/dept-admin/timetable-builder-client.tsx` | Replaced with `/[orgId]/dept-admin/schedules` (Schedule Matrix) and `/[orgId]/dept-admin/import` (Timetable Importer). |
| `attendance_records` | **RETIRED** | `app/(workspace)/[orgId]/lead/verify/page.tsx`<br/>`app/api/attendance/submit/route.ts`<br/>`app/api/lead/batch-verify-attendance/route.ts` | Replaced with 2-step faculty self-completion modal (`ScheduledCompletionModal`) and `confirm_scheduled_work_instance` RPC. Lead verify page retired. |
| `timetable-compiler` | **RETIRED** | `lib/engine/timetable-compiler.ts` | Replaced with `lib/engine/schedule-generator.ts` (idempotent date-specific instance generator for `scheduled_work_instances`). |
| `curriculum` | **RETIRED** | `app/api/dept-admin/curriculum/route.ts` | Deprecated; Dept Admin navigation now routes to `faculty`, `schedules`, `work-cycles`, and `import`. |

---

## 2. File-by-File Classification Table

| File Path | Classification | Role / Purpose | Retirement Action / Status |
| :--- | :--- | :--- | :--- |
| `app/(workspace)/[orgId]/dept-admin/page.tsx` | **ACTIVE (UPDATED)** | Dept Admin Landing Page | Rebuilt to query ONLY `users`, `work_cycles`, `scheduled_work_templates`, `scheduled_work_instances`. Clean Shadcn UI. |
| `app/(workspace)/[orgId]/dept-admin/faculty/page.tsx` | **ACTIVE (NEW)** | Faculty Directory & Workload | Lists teaching faculty, weekly scheduled slots, and live monthly work progress. |
| `app/(workspace)/[orgId]/dept-admin/schedules/page.tsx` | **ACTIVE (NEW)** | Schedule Matrix | Live matrix of weekly recurring templates, manual add dialog, and sync month instances button. |
| `app/(workspace)/[orgId]/dept-admin/work-cycles/page.tsx` | **ACTIVE (NEW)** | Monthly Work Cycles | Displays active cycle, 75% scheduled weight, 25% ad-hoc weight, 85% salary threshold. |
| `app/(workspace)/[orgId]/dept-admin/import/page.tsx` | **ACTIVE (NEW)** | Timetable Import Center | Canonical XLSX/CSV importer with dry-run preview and conflict validation. |
| `app/(workspace)/[orgId]/member/schedule/page.tsx` | **ACTIVE (UPDATED)** | Faculty Member Schedule | Rebuilt to query `scheduled_work_templates` and `scheduled_work_instances` with 2-step self-completion modal. |
| `components/shell/app-sidebar.tsx` | **ACTIVE (UPDATED)** | Navigation Sidebar | `DEPT_ADMIN` links set to Faculty, Schedules, Work Cycles, Import Center, Settings. |
| `components/shell/canvas-shell.tsx` | **ACTIVE (UPDATED)** | Dynamic Workspace Shell | `DEPT_ADMIN` links updated identically to Faculty, Schedules, Work Cycles, Import Center, Settings. |
| `app/(workspace)/[orgId]/dept-admin/timetable/page.tsx` | **LEGACY (RETIRED)** | Old Timetable Builder URL | Displays "Academic Timetable Module Upgraded" with direct button to `schedules`. |
| `app/(workspace)/[orgId]/dept-admin/programmes/page.tsx` | **LEGACY (RETIRED)** | Old Programmes URL | Displays "Academic Programs Module Retired" with direct button to `schedules`. |
| `app/(workspace)/[orgId]/dept-admin/subjects/page.tsx` | **LEGACY (RETIRED)** | Old Subjects URL | Displays "Academic Subjects Module Retired" with direct button to `schedules`. |
| `app/(workspace)/[orgId]/dept-admin/batches/page.tsx` | **LEGACY (RETIRED)** | Old Batches URL | Displays "Academic Batches Module Retired" with direct button to `schedules`. |
| `app/(workspace)/[orgId]/lead/verify/page.tsx` | **LEGACY (RETIRED)** | Old Attendance Queue URL | Displays "Attendance Verification Queue Retired" with direct button to `lead`. |
| `components/dept-admin/timetable-builder-client.tsx` | **LEGACY** | Old Timetable Builder Component | Retained as inert legacy file; unlinked from all active routes. |
| `components/dept-admin/subjects-client.tsx` | **LEGACY** | Old Subjects CRUD Component | Retained as inert legacy file; unlinked from all active routes. |
| `components/dept-admin/batches-client.tsx` | **LEGACY** | Old Batches CRUD Component | Retained as inert legacy file; unlinked from all active routes. |
| `lib/engine/timetable-compiler.ts` | **LEGACY** | Old 75/25 Compiler Engine | Replaced by `lib/engine/schedule-generator.ts`. |
| `supabase/migrations/20260822_workledger_trusted_work.sql` | **MIGRATION/CURRENT** | Active Database Migration | Contains trusted work schema definitions, RPCs, and RLS policies. |
| `docs/backup_pre_reset/*.json` | **BACKUP/HISTORICAL** | JSON Table Backups | Historical snapshots exported prior to database migration. |
| `docs/TRUSTED_REBUILD_AUDIT.md` | **DOCUMENTATION** | Step 0 Live Database Audit | Pre-reset audit record. |
| `docs/DATA_RESET_PREVIEW.md` | **DOCUMENTATION** | Pre-reset Table Count Manifest | Backup manifest and deletion preview. |
