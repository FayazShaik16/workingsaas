# WorkLedger: Data Reset Preview & Backup Manifest
**Generated:** 2026-08-21T17:10:32.160Z  
**Supabase Project Ref:** `bzgqvwqzbjqpfunnyfwe`  
**Backup Directory:** `docs/backup_pre_reset/`  

---

## 1. Table Counts Breakdown (Pre-Reset)

| Entity / Table | Existing Count | Target Action Upon Reset Confirmation |
|---|---|---|
| **Auth Users** (`auth.users`) | 50 | Delete demo/mock accounts via Supabase Admin API (retaining active System Admin) |
| **Organizations** (`organizations`) | 25 | Remove legacy test organizations |
| **Organization Units** (`org_units`) | 59 | Remove legacy departments |
| **Users** (`public.users`) | 155 | Clean mock faculty/student profiles |
| **Roles** (`roles`) | 86 | Clean duplicates; seed standard system roles |
| **User Roles** (`user_roles`) | 184 | Clear mock role assignments |
| **Wallets** (`wallets`) | 148 | Clear demo wallets |
| **Token Transactions** (`token_transactions`) | 7 | Clear mock ledger entries |
| **Tasks** (`tasks`) | 10 | Clear legacy test tasks |
| **Task Type Definitions** (`task_type_definitions`) | 5 | Retain/refresh system standard types |
| **Invitations** (`invitations`) | 5 | Clear stale demo invitations |
| **Notifications** (`notifications`) | 0 | Clear demo notifications |
| **Academic Programs** (`academic_programs`) | 15 | Clear legacy academic entities |
| **Subjects** (`subjects`) | 13 | Clear legacy subjects |
| **Academic Batches** (`academic_batches`) | 12 | Clear legacy batches |
| **Subject Assignments** (`subject_assignments`) | 12 | Clear legacy assignments |
| **Timetable Slots** (`timetable_slots`) | 31 | Clear legacy attendance slots |
| **Attendance Records** (`attendance_records`) | 8 | Clear legacy attendance records |

---

## 2. Safety & Verification Controls
- Full JSON backup created in `docs/backup_pre_reset/`.
- Destructive reset is gated behind:
  1. Authenticated **`SYSTEM_ADMIN`** session.
  2. Typed confirmation phrase: **`RESET WORKLEDGER DEMO DATA`**.
  3. Second explicit modal confirmation button.
- The currently authenticated **`SYSTEM_ADMIN`** account is retained so administrative session is preserved.
