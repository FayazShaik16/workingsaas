# WorkLedger: 9:00 AM Live Demonstration Script & Rehearsal Guide

---

## 🏛️ Executive Narrative: The Non-Monetary Proof-of-Work Layer
> **Core Pitch**: *"WorkLedger is not a payroll processor or a simple to-do tracker. It is a non-monetary verification and capability accounting layer that sits between structured/unstructured faculty contributions and institutional salary release. It solves the 'Fixed Pay for Unequal Work' dilemma by transforming physical timetable compliance and institutional citizenship into cryptographically auditable proof-of-work tokens."*

---

## 🔑 Demo Personas & Credentials

| Role | Name | Email | Default Password | Workspace Route |
| :--- | :--- | :--- | :--- | :--- |
| **Director / Executive** | Director MVGR | `director@mvgr.edu.in` | `Admin@123!` | `/[orgId]/director` |
| **HOD (CSE Dept)** | Dr. R. Ravikanth | `hod.cse@mvgr.edu.in` | `Mvgr@2026!` | `/[orgId]/lead` |
| **Faculty (CSE)** | Dr. P. Satyanarayana | `faculty.cse1@mvgr.edu.in` | `Mvgr@2026!` | `/[orgId]/member` |
| **Finance Administrator**| Accounts Officer | `finance@mvgr.edu.in` | `Admin@123!` | `/[orgId]/finance/salary` |

---

## 🎬 Step-by-Step Live Click-Path (10-Minute Walkthrough)

### ACT 1: The Clean Baseline (Director Dashboard)
1. **Login as Director** (`director@mvgr.edu.in`).
2. Navigate to **Executive Dashboard** (`/[orgId]/director`).
3. **Point out**:
   - Denominators strictly count **Teaching Staff** (`MEMBER` scope), not administrative accounts.
   - Progress and credit distributions reflect 100% database truth.
   - The **Zero-Sum Round Trip** pool balances (`SALARY_POOL`, `LOAN_POOL`).

---

### ACT 2: Roster & Timetable Ingestion (Dept Admin / Director)
1. Navigate to **Bulk Import Roster** (`/[orgId]/director/import` or `/[orgId]/dept-admin/import`).
2. Drag and drop `demo/faculty_import.csv`.
3. Highlight **Auto-Column Mapping** and the **Validation Preview**:
   - System recognizes HODs vs Faculty and auto-assigns `ORG_UNIT_LEAD` + `MEMBER` roles.
   - Creates `PERSONAL` wallets and department units automatically.
4. Click **Import All Users**.
5. Navigate to **Timetable Matrix** (`/[orgId]/dept-admin/timetable`).
6. Click **Import Spreadsheet** tab and upload `demo/timetable_import.csv`.
7. Click **Ingest & Compile Current Month**:
   - Demonstrates the **75/25 Model**: The system computes weekly teaching load $S$, expands the 30-day calendar into structured tasks, and sets the monthly target denominator $C_{\text{target}} = \text{ROUND}(S / 0.75, 2)$.

---

### ACT 3: Daily Teaching Execution & Attendance Logging (Faculty Persona)
1. Open an incognito window and login as **Dr. P. Satyanarayana** (`faculty.cse1@mvgr.edu.in`).
   - *(First-login forced password change prompt demonstrates security governance).*
2. Navigate to **My Schedule & Attendance** (`/[orgId]/member/schedule`).
3. Point out the weekly timetable matrix populated from the CSV import.
4. Click **Log Attendance** on Monday Period 1 (CS301 - Database Management Systems):
   - Enter `Students Present: 58`, `Students Absent: 2`, `Topics Covered: B-Tree Indexing and Query Optimization`.
   - Click **Submit to HOD Queue**.
5. Return to **Member Dashboard** (`/[orgId]/member`):
   - Notice the status updates to `VERIFICATION_PENDING`.

---

### ACT 4: Department Verification & Milestone Release (HOD Persona)
1. Switch to the HOD window (`hod.cse@mvgr.edu.in`).
2. Navigate to **Verification Desk** (`/[orgId]/lead/verify`).
3. Select the pending attendance submission for Dr. P. Satyanarayana.
4. Click **Batch Approve & Release Credits**:
   - Marks attendance `CONDUCTED`.
   - Releases rate card credits (`1.0 WORK`) into faculty's `PERSONAL` wallet.
   - Triggers `recompute_user_progress` and anchors cryptographic transaction on the ledger.

---

### ACT 5: Marketplace Citizenship & Salary Claim (Faculty Persona)
1. Switch back to Faculty window (`faculty.cse1@mvgr.edu.in`).
2. Navigate to **Unstructured Marketplace** (`/[orgId]/member/marketplace`).
3. Point out:
   - Institution-wide tasks (pinned with top badges) created by Director.
   - Department tasks scoped strictly to CSE.
4. Pick up an institutional assignment (e.g. *NBA Criterion 4 Audit Support*).
5. Explain the **85% Gate Rule**:
   - Faculty achieving $\ge 85\%$ target + 1 unstructured verified task unlocks **"Initiate My Salary Claim"**.
   - Faculty below threshold can request an automated **"Work Loan"** from the Director Loan Desk to bridge the gap.

---

### ACT 6: Executive Reconciliation & Batch Reversal (Finance Persona)
1. Switch to Finance window (`finance@mvgr.edu.in`).
2. Navigate to **Finance Payroll Console** (`/[orgId]/finance/salary`).
3. Point out the live matrix showing eligible faculty members with verified milestone proof.
4. Click **Execute Atomic Batch Reversal**:
   - Sweeps faculty earned credits from `PERSONAL` wallets back to the Director `SALARY_POOL`.
   - Emits an immutable double-entry journal transaction.
5. Navigate to **Executive Ledger** (`/[orgId]/director/ledger`) to show the complete, unalterable proof-of-work audit trail.

---

## 🎯 Key Takeaway for Evaluators
> *"With WorkLedger, leadership never releases payroll on blind faith. Every rupee released is backed by a verified audit trail of classroom lectures delivered and institutional initiatives completed."*
