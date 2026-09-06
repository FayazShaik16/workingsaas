# WorkLedger — Live Demo Execution Runbook (Tomorrow)

This document is the exact step-by-step operator guide for tomorrow's live demonstration of **WorkLedger** on Ethereum Sepolia.

---

## 0. Demo Overview & Architecture Philosophy

WorkLedger is a **trusted work-organization and work-credit platform**.

It is **NOT**:
- Biometric surveillance or facial recognition
- Student attendance tracking
- Forced token confiscation
- A mock blockchain dashboard

---

## 1. System Credentials & Demo Test Accounts

| Role | Name | Email | Default Temp Password | Initial Route |
|---|---|---|---|---|
| **SYSTEM_ADMIN** | System Administrator | `admin@mvgr.demo` | *(Configured Admin PW)* | `/[orgId]/config` |
| **DIRECTOR** | Director One | `director@mvgr.demo` | `WorkLedger@2026!` | `/[orgId]/director` |
| **ORG_UNIT_LEAD (HOD)** | Dr. R. HOD | `hod.cse@mvgr.demo` | `WorkLedger@2026!` | `/[orgId]/lead` |
| **DEPT_ADMIN** | Dept Schedule Admin | `deptadmin.cse@mvgr.demo` | `WorkLedger@2026!` | `/[orgId]/dept-admin` |
| **MEMBER (Faculty A)** | Faculty One | `faculty.one@mvgr.demo` | `WorkLedger@2026!` | `/[orgId]/member` |
| **MEMBER (Faculty B)** | Faculty Two | `faculty.two@mvgr.demo` | `WorkLedger@2026!` | `/[orgId]/member` |
| **FINANCE_ADMIN** | Finance One | `finance@mvgr.demo` | `WorkLedger@2026!` | `/[orgId]/finance` |

---

## 2. Step-by-Step Live Demo Execution

### Act A: System Admin Organization Provisioning & Bulk Import
1. **Sign in** as System Administrator.
2. Navigate to `/[orgId]/config/departments`.
3. Create department: **`Computer Science & Engineering (CSE)`**.
   - *Verification*: Refresh the page; verify the department persists immediately without disappearance.
4. Navigate to `/[orgId]/config/import`.
5. Click **"Download People Import Template (.csv)"** to demonstrate standard import template support.
6. Upload `people_import_template.csv`:
   ```csv
   full_name,email,designation,role,department,faculty_id
   Dr. R. HOD,hod.cse@mvgr.demo,Professor & HOD,ORG_UNIT_LEAD,CSE,CSE-HOD-001
   Dept Schedule Admin,deptadmin.cse@mvgr.demo,Schedule Coordinator,DEPT_ADMIN,CSE,
   Faculty One,faculty.one@mvgr.demo,Assistant Professor,MEMBER,CSE,CSE-FAC-001
   Faculty Two,faculty.two@mvgr.demo,Assistant Professor,MEMBER,CSE,CSE-FAC-002
   Director One,director@mvgr.demo,Director,DIRECTOR,,
   Finance One,finance@mvgr.demo,Finance Administrator,FINANCE_ADMIN,,
   ```
7. Review validation preview table showing 6 valid rows.
8. Click **"Execute Bulk Ingestion"**.
   - *Result*: Accounts provisioned server-side with `must_reset_password = true`, canonical roles mapped, and zero phantom default departments created.

---

### Act B: Department Admin Schedule Ingestion
1. **Sign in** as `deptadmin.cse@mvgr.demo`.
2. Navigate to `/[orgId]/dept-admin/import`.
3. Click **"Download Timetable Import Template (.csv)"**.
4. Upload `timetable_import_template.csv`:
   ```csv
   faculty_id,faculty_name,faculty_email,day,start_time,end_time,task_name,credits,description
   CSE-FAC-001,Faculty One,faculty.one@mvgr.demo,MON,09:15,10:15,V SE SEC-A,1.0,Weekly scheduled academic session
   CSE-FAC-001,Faculty One,faculty.one@mvgr.demo,WED,10:15,11:15,V SE SEC-B,1.0,Weekly scheduled academic session
   CSE-FAC-001,Faculty One,faculty.one@mvgr.demo,FRI,11:15,12:15,VII SE CSD,1.0,Weekly scheduled academic session
   ```
5. Click **"Confirm & Import All"**.
   - *Result*: Creates recurring weekly templates and generates active monthly instances idempotently.

---

### Act C: Faculty Schedule Self-Completion & Task Nomination
1. **Sign in** as `faculty.one@mvgr.demo` with temporary password.
2. System forces immediate redirect to `/auth/change-password`. Set permanent password.
3. On Faculty Dashboard (`/[orgId]/member`), view today's scheduled work session.
4. Click **"Mark Complete"**:
   - **Step 1 Modal**: *"Have you completed [V SE SEC-A] scheduled for today?"*
   - **Step 2 Modal**: *"This will record 1.0 WORK credits in your monthly work progress. Confirm?"*
   - Click Confirm.
5. Observe live progress ring update based on the shared mathematical formula:
   $$\text{Progress} = \frac{\text{Raw Earned Credits}}{\text{Total Target Credits}} \times 100$$
6. Navigate to **Task Marketplace** (`/[orgId]/member/marketplace`).
7. Select an open CSE department task and click **"Nominate Myself"** (with optional volunteer pitch).

---

### Act D: HOD Nomination Review, Assignment & Task Approval
1. **Sign in** as `hod.cse@mvgr.demo`.
2. Navigate to **Nominations Review** (`/[orgId]/lead/nominations`).
3. View Faculty One's nomination, volunteer pitch, and timestamp.
4. Click **"Assign Task"**.
   - *Result*: Nomination status moves to `ACCEPTED`, task moves to `ASSIGNED`.
5. Sign in back as `faculty.one@mvgr.demo`.
   - View task in **"Assigned Work & Initiatives"**.
   - Submit deliverable report / evidence upload. Task transitions to `VERIFICATION_PENDING`.
6. Sign in back as `hod.cse@mvgr.demo` and navigate to `/[orgId]/lead/tasks` (Approvals Queue).
7. Review deliverable and click **"Approve"**.
   - *Result*: Awards exactly one `UNSTRUCTURED_APPROVAL` credit ledger entry and recomputes monthly progress.
8. Navigate to `/[orgId]/lead/salary` and approve Faculty One's salary review request.

---

### Act E: Finance Sepolia ERC-20 WORK Mint Settlement
1. **Sign in** as `finance@mvgr.demo`.
2. Navigate to `/[orgId]/finance/salary`.
3. View Faculty One (status: **"Ready for Release"**, $\ge 85\%$ threshold met).
4. Click **"Mint Sepolia"** $\rightarrow$ confirm mint amount (e.g. 10 WORK).
5. Treasury server wallet signs and broadcasts `mint(facultyAuditAddress, 10000000000000000000)` to Ethereum Sepolia.
6. View confirmed transaction receipt and click the live **Sepolia Etherscan Link**.
7. Sign in as `faculty.one@mvgr.demo` $\rightarrow$ navigate to `/[orgId]/member/wallet`.
8. Verify live on-chain ERC-20 WORK balance from contract `balanceOf()`.

---

## 3. Pre-Demo Diagnostics Command

Run the automated readiness diagnostic before starting:
```bash
npx tsx scripts/demo-readiness-check.ts
```
Expected output: **8/8 checks passed**, zero blockers.
