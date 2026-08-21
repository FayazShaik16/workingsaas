# WorkLedger: End-to-End Testing & Runtime Acceptance Guide
**Repository:** `mithileshkumarrattu/saas`  
**Supabase Project Ref:** `bzgqvwqzbjqpfunnyfwe`  
**Architecture:** Next.js App Router + TypeScript Strict + Supabase Postgres/Auth + ethers.js v6

---

## 1. Acceptance Test Scenarios

### Scenario 1: Fresh Tenant Self-Signup
- **Action**: Navigate to `http://localhost:3000/signup`, register with a fresh email and password.
- **Verification**:
  - A new organization is created with standard seeded roles.
  - The user is assigned **ONLY** the `SYSTEM_ADMIN` role (`user_roles`).
  - `users.org_unit_id` is `null` (Operator identity).
  - No fallback promotion to `DIRECTOR`, `HOD`, or `MEMBER`.
  - User is routed directly to `/{orgId}/config`.

---

### Scenario 2: Bulk Faculty Import (XLSX / CSV)
- **Action**: Navigate to `/{orgId}/config/import`, download template or upload `faculty_import.csv` with headers:
  `faculty_id,faculty_name,faculty_email,department,designation,role`
- **Verification**:
  - Dry-run validation previews valid rows and flags invalid/malformed emails with exact reasons.
  - On confirm, server provisions GoTrue Auth accounts (`createUser`), sets `must_reset_password = true`, creates `users` profile, and provisions `PERSONAL` internal wallet.
  - No fake or silent record discards.

---

### Scenario 3: Dept Admin Schedules & Timetable Import
- **Action**: Log in as `DEPT_ADMIN` and navigate to `/{orgId}/dept-admin/schedules` or `/{orgId}/dept-admin/import`.
- **Verification**:
  - Zero requirement for courses, subjects, batches, or sections.
  - Manual creation: define session `V SE SEC-A`, weekday `MON`, time `09:15–10:15`, credits `1.0`.
  - XLSX Import: upload normalized timetable with `faculty_id,day,start_time,end_time,task_name,credits`.
  - Click **"Sync Month Instances"**: generates date-specific `scheduled_work_instances` for active cycle idempotently (`onConflict: "template_id,work_date"`).

---

### Scenario 4: Faculty Dashboard & 2-Step Self-Completion
- **Action**: Log in as Faculty Member at `/{orgId}/member`.
- **Verification**:
  - **Header**: clean greeting with today's date.
  - **Monthly Progress**: shows live `Earned / Total Target Credits` calculated from `credit_ledger_entries`.
    - Formula: `Total Target = Scheduled Target / (75% / 100)`.
    - Progress ring capped at 100% with visual 85% salary threshold marker.
    - Extra credits displayed as `+X credits above target`.
  - **Today's Scheduled Sessions**: displays sessions due today.
  - Click **"Mark Completed"**:
    - Step 1: "Have you completed {title} scheduled for {date/time}?"
    - Step 2: "This will update your monthly work progress. Confirm completion?"
    - Server action writes to `scheduled_work_completions` (append-only), adds `STRUCTURED_SELF_COMPLETION` to `credit_ledger_entries`, updates instance status to `SELF_COMPLETED`, and recomputes monthly summary atomically.
    - Subsequent clicks or page reloads cannot duplicate credits.

---

### Scenario 5: HOD Scheduled Work Review & Ad-Hoc Task Management
- **Action**: Log in as HOD at `/{orgId}/lead`.
- **Verification**:
  - HOD has dual view: Employee View (for personal schedule/progress) and Manager View (department tasks).
  - Review feed shows self-completed lectures by department faculty.
  - HOD can acknowledge or flag with an auditable review note (flagging does not silently wipe credits).
  - HOD creates ad-hoc tasks with priority (`URGENT`, `HIGH`, `MEDIUM`, `LOW`) and verification mode (`MANUAL_REPORT` | `FILE_SUBMISSION`).

---

### Scenario 6: Department Task Pool & Duplicate-Proof Nominations
- **Action**: Faculty visits `/{orgId}/member/marketplace`.
- **Verification**:
  - Filtered strictly to faculty's organization and department scope.
  - One-click nomination: writes to `nominations` table with idempotency protection.
  - HOD reviews nominees at `/{orgId}/lead/tasks` and assigns task to selected faculty.

---

### Scenario 7: Salary Request Eligibility & Approval
- **Action**: Month-end salary request workflow.
- **Verification**:
  - Blocked if `progress < 85%` or before the 26th day of the month.
  - On or after the 26th with `progress >= 85%`, status switches to `AVAILABLE` and faculty can click "Submit Salary Request".
  - HOD approves request with review note $\rightarrow$ status becomes `HOD_APPROVED`.

---

### Scenario 8: Real Sepolia ERC-20 Blockchain Integration
- **Action**: Admin visits `/{orgId}/config` or calls `/api/admin/blockchain/readiness`.
- **Verification**:
  - If `SEPOLIA_RPC_URL`, `WORK_TOKEN_ADDRESS`, or `TREASURY_PRIVATE_KEY` are unconfigured:
    - Displays clean, honest **"Not configured"** badge.
    - Zero fake hashes, zero synthetic block numbers, zero fake ECDSA badges.
  - If configured:
    - Real ERC-20 transfer executed on Ethereum Sepolia Testnet (Chain ID `11155111`).
    - Real transaction receipt stored in `blockchain_transactions` with verified Etherscan link (`https://sepolia.etherscan.io/tx/{txHash}`).

---

### Scenario 9: Multi-Tenant Data Isolation
- **Verification**:
  - Every API route and Server Action resolves `organization_id` strictly from the authenticated session user.
  - RLS policies ensure users cannot read or write records from another organization.

---

### Scenario 10: Academic Surveillance Decoupling
- **Verification**:
  - Legacy academic entities (`academic_programs`, `subjects`, `batches`, `attendance_records`) are absent from live navigation.
  - System operates entirely on the trusted work-organization model.
