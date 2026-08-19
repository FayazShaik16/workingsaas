# WorkLedger: Live Demo Rehearsal Guide & Operational Protocol

---

## 1. System Philosophy & Non-Monetary Boundary
WorkLedger is **NOT** a task tracker and **NOT** a payroll engine. It is an **objective, non-monetary verification layer** between faculty work completion and monthly salary authorization.
- In trusted institutions, salary release is often done on faith without auditable proof of structured teaching or unstructured institutional contributions.
- WorkLedger operates a **dual-layer proof-of-work mechanism**:
  1. **Off-Chain PostgreSQL Engine (Fast & Free)**: Real-time schedule compilation, attendance verification, dynamic target evaluation, and instant micro-credit awards.
  2. **On-Chain Sepolia Mirror (Inspectable & Immutable)**: Macro-milestones (salary claim approval, emergency work loan disbursement, and cycle batch reversal) write verifiable ERC-20 receipts directly to the Ethereum Sepolia Testnet with public Etherscan links.

---

## 2. Actor Model & Role Access Matrix

| Role Scope | Intended User | Navigation Route | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| `SYSTEM_ADMIN` | Platform Operator / IT Lead | `/[orgId]/config` | Organization setup, user invitations, bulk CSV import, rate card configuration. |
| `DIRECTOR` | Principal / Vice-Chancellor | `/[orgId]/director` | High-level faculty progress heatmap, institutional treasury wallet, loan approvals. |
| `DEPT_ADMIN` | Department Coordinator | `/[orgId]/dept-admin` | Academic programs, subjects, batches, timetable slots, monthly task compilation. |
| `ORG_UNIT_LEAD` | Head of Department (HOD) | `/[orgId]/lead/verify` | Attendance approval, unstructured proof verification, salary claim endorsement. |
| `MEMBER` | Teaching Faculty | `/[orgId]/member` | Weekly schedule, attendance submission, task marketplace, salary claim, Sepolia wallet. |
| `FINANCE_ADMIN` | Bursar / Payroll Officer | `/[orgId]/finance/salary` | Salary release audit, batch reversal sweep back to Director salary pool. |

---

## 3. End-to-End Live Walkthrough (8 Steps)

### Step 1: Self-Signup & Institutional Initialization
1. Navigate to `/auth/signup` and create a new account.
2. The user is assigned **only** `SYSTEM_ADMIN` (`org_unit_id: null`).
3. Root organization and singleton org wallets (`SALARY_POOL`, `LOAN_POOL`, and `GENESIS`) are automatically provisioned.
4. User is redirected to `/[orgId]/config`.

### Step 2: User Onboarding & Department Provisioning
1. Under `/[orgId]/config`, create or review academic departments (e.g. `Computer Science & Engineering`).
2. Invite or import users with their explicit System Role (`DIRECTOR`, `DEPT_ADMIN`, `ORG_UNIT_LEAD`, `MEMBER`, `FINANCE_ADMIN`) and academic Designation (`Professor`, `Associate Professor`, `Assistant Professor`).
3. Teaching staff metrics count **strictly** users holding the `MEMBER` role.

### Step 3: Timetable Builder & Task Compiler (DEPT_ADMIN)
1. Navigate to `/[orgId]/dept-admin`.
2. Configure:
   - **Academic Program**: `B.Tech Computer Science & Engineering` (4 Years, Undergraduate)
   - **Subject**: `CS301 - Data Structures & Algorithms` (3 Credits, Lecture/Theory)
   - **Batch**: `2026-A` (60 Students)
3. Under **Master Timetable Matrix**, assign Mon/Wed/Fri 09:00–10:00 slots to Faculty.
4. Click **Compile Schedule** for the current month (e.g. August 2026).
5. The compiler generates structured task rows in `tasks` with `credit_value = 1.0` and computes the dynamic target:
   $$\text{target\_credits} = \text{ROUND}(\text{structured\_sum} / 0.75, 2)$$

### Step 4: Faculty Attendance Submission (MEMBER)
1. Log in as Faculty $\rightarrow$ navigate to `/[orgId]/member/schedule`.
2. View the compiled weekly lecture periods.
3. Click **Log Attendance** on a scheduled class:
   - Students Present: `58`
   - Students Absent: `2`
   - Topic: `Balanced Binary Search Trees & AVL Rotations`
4. Submit attendance $\rightarrow$ creates `attendance_records` row with status `SUBMITTED`.

### Step 5: HOD Approval & Instant Credit Award (ORG_UNIT_LEAD)
1. Log in as HOD $\rightarrow$ navigate to `/[orgId]/lead/verify`.
2. View pending attendance submissions for the CSE department.
3. Click **Approve & Credit**.
4. The system:
   - Marks attendance `VERIFIED`.
   - Closes the task.
   - Credits WORK tokens into Faculty's `PERSONAL` wallet.
   - Automatically recalculates `progress_percentage`.

### Step 6: Unstructured Contribution & Salary Claim (MEMBER)
1. Faculty navigates to `/[orgId]/member/marketplace`.
2. Self-nominates for an open unstructured task (e.g. `NAAC Criterion 4 Documentation`, 5 Credits).
3. HOD verifies the task proof under `/[orgId]/lead/verify`.
4. With earned credits $\ge 85\%$ of target and at least 1 verified unstructured task, the **"Initiate My Salary"** button unlocks.
5. Faculty clicks **Initiate My Salary** $\rightarrow$ status advances to `CLAIMED`.

### Step 7: HOD Salary Endorsement (ORG_UNIT_LEAD)
1. HOD navigates to `/[orgId]/lead/salary`.
2. Reviews the faculty's verified proof dossier and clicks **Endorse Salary Release**.
3. Status advances to `APPROVED`.

### Step 8: Finance Audit & Batch Reversal (FINANCE_ADMIN)
1. Finance Admin navigates to `/[orgId]/finance/salary`.
2. Only approved, verified teaching staff appear in the salary clearance table.
3. Click **Batch Reverse & Close Cycle**.
4. Balances sweep from `PERSONAL` wallets back to `SALARY_POOL`.
5. On-chain transaction hash is recorded in `blockchain_transactions` and linked to Sepolia Etherscan.

---

## 4. Sepolia Testnet Blockchain Mirror Details

- **Token Contract**: WORK Token (ERC-20 standard)
- **Contract Address**: Configured in `.env.local` via `WORK_TOKEN_CONTRACT_ADDRESS`
- **Network**: Ethereum Sepolia Testnet (Chain ID `11155111`)
- **Block Explorer**: `https://sepolia.etherscan.io/tx/{txHash}`
- **Security Protocol**:
  - Private keys encrypted with AES-256 in database via `WALLET_ENCRYPTION_KEY`.
  - Keys decrypted in server memory only during signed relay execution; never logged or returned to client.
  - Gas auto-replenishment relayed from Genesis Admin account.
