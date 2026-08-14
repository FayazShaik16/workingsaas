# WorkLedger - Complete Project Documentation

## 1. PROJECT OVERVIEW

**WorkLedger** is a **multi-tenant SaaS platform** for enterprise performance and work-accountability management. It distinguishes between **structured work** (defined tasks with validation workflows) and **unstructured work** (self-nominated task opportunities allocated by authorities).

### Core Problem Solved
Organizations (especially educational institutions) struggle with:
- Tracking diverse types of work (structured vs. ad-hoc)
- Validating work completion before salary/compensation release
- Managing hierarchical approval workflows
- Maintaining work-to-compensation audit trails

### Solution
A token-backed ledger system where:
- Users earn tokens/credits by completing work
- Work is validated and approved through multi-step workflows
- Salary release eligibility is determined by token accumulation
- Directors and team leads manage verification and approval cycles
- Finance admins manage budgets and wage payouts

---

## 2. WHAT WE'RE BUILDING

### 2.1 Multi-Tenant Architecture
Each organization has complete data isolation:
- Unique `organization_id` as primary isolation key
- Hierarchical `org_units` (departments, divisions, teams)
- Role-based access control (RBAC) per organization
- Row-level security (RLS) enforcing org boundaries

### 2.2 User Roles & Capabilities

| Role | Scope Level | Responsibilities | Dashboard |
|------|-------------|------------------|-----------|
| **SYSTEM_ADMIN** | SYSTEM_ADMIN | Platform-level config, multiple orgs | `/workspace/admin` |
| **DIRECTOR** | DIRECTOR | Org leader, team mgmt, verification cycles | `/workspace/director` |
| **FINANCE_ADMIN** | FINANCE_ADMIN | Budget mgmt, wallet allocation, payouts | `/workspace/finance` |
| **ORG_UNIT_LEAD** | ORG_UNIT_LEAD | Dept head, task verification, approvals | `/workspace/lead` |
| **MEMBER** | MEMBER | Task execution, work submission | `/workspace/member` |

### 2.3 Work Types

**Structured Work:**
- Predefined tasks: class splits, exam invigilation, tech assignments
- Fixed validation step after completion
- Director approval on weekly cycles
- Salary release conditional on completion

**Unstructured Work:**
- Ad-hoc opportunities posted via marketplace
- Members self-nominate
- Authority allocates winners
- Same validation/approval flow

### 2.4 Wallet System
Each user has three wallets (Director has all three, Members have only PERSONAL):

| Wallet | Owner | Purpose | Balance Updates |
|--------|-------|---------|-----------------|
| **SALARY_POOL** | Director | Salary budget allocation | Cycle-start mint, weekly payouts |
| **LOAN_POOL** | Director | Emergency advance loans | Deductions, interest tracking |
| **PERSONAL** | All users | Individual earnings ledger | Task completion credits |

### 2.5 Work Cycles
Directors initiate salary cycles:
1. **Cycle Start** → Mint budget to SALARY_POOL
2. **Work Period** → Members complete tasks
3. **Verification** → Lead verifies completion (with proof/screenshot)
4. **Approval** → Director approves valid work
5. **Payout** → Finance admin processes salary transfer

---

## 3. CURRENT CODEBASE STATE

### 3.1 Architecture

```
app/
├── (workspace)                          # Route group - no URL segment
│   ├── layout.tsx                       # Auth + navigation wrapper
│   ├── page.tsx                         # Redirect based on role
│   ├── member/                          # MEMBER dashboard
│   │   ├── page.tsx                     # Member home
│   │   ├── tasks/page.tsx               # Browse & submit work
│   │   ├── earnings/page.tsx            # Personal wallet view
│   │   ├── marketplace/page.tsx         # Unstructured work opportunities
│   │   └── marketplace/[taskId]/...     # Task detail
│   ├── lead/                            # ORG_UNIT_LEAD dashboard
│   │   ├── page.tsx                     # Lead home
│   │   ├── verification/[taskId]/...    # Task verification form
│   │   └── (more pages)
│   ├── director/page.tsx                # DIRECTOR dashboard (placeholder)
│   ├── finance/page.tsx                 # FINANCE_ADMIN dashboard (placeholder)
│   ├── admin/page.tsx                   # SYSTEM_ADMIN dashboard (placeholder)
│   ├── settings/page.tsx                # User settings (all roles)
│   └── config/page.tsx                  # Org configuration (admin only)
├── (auth)
│   ├── login/page.tsx                   # Email/Google login
│   ├── signup/page.tsx                  # Email/Google signup → org setup
│   ├── accept-invite/page.tsx           # Invitation acceptance
│   └── auth/callback/route.ts           # OAuth callback handler
├── onboarding/
│   ├── setup/page.tsx                   # New org provisioning form
│   ├── director-wizard/                 # Post-provisioning org structure setup
│   └── api/provision-org/route.ts       # Creates org + assigns DIRECTOR role + 3 wallets
└── api/
    ├── auth/
    │   └── get-session/route.ts         # Returns session with org + roles
    ├── onboarding/
    │   ├── provision-org/               # Org provisioning
    │   └── director-setup/              # Org structure updates
    └── (more endpoints)

lib/
├── auth/
│   ├── session.ts                       # getSessionUser() - fetches user + org + roles
│   ├── get-redirect.ts                  # getRedirectPath() - route based on scope_level
│   ├── protect.ts                       # requireAuth(), requireScope() middleware
│   └── ...
└── supabase/
    ├── client.ts                        # Browser-safe Supabase client
    └── server.ts                        # Server-only Supabase client

schema.sql                               # Database schema (50+ tables)
```

### 3.2 Database Schema (Key Tables)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `organizations` | Tenant data | id, name, type, created_by |
| `users` | User profiles | id, organization_id, org_unit_id, email, name |
| `roles` | Role definitions | id, name, scope_level (DIRECTOR, MEMBER, etc.) |
| `user_roles` | User-role assignment | user_id, role_id |
| `org_units` | Org hierarchy | id, organization_id, parent_unit_id, name, type |
| `wallets` | User earnings ledgers | id, organization_id, owner_user_id, purpose (SALARY_POOL, PERSONAL, etc.), balance |
| `wallet_transactions` | Ledger entries | wallet_id, amount, transaction_type, related_task_id |
| `tasks` | Work items | id, organization_id, title, type (STRUCTURED/UNSTRUCTURED), assigned_user_id |
| `task_submissions` | Work completion | task_id, user_id, status (SUBMITTED/VERIFIED/APPROVED), proof_url |
| `verification_proofs` | Validation evidence | id, submission_id, user_id, proof_type, proof_data |
| `salary_cycles` | Payout periods | id, organization_id, director_id, status, start_date, end_date |
| `invitations` | User invites | id, organization_id, email, token, status (PENDING/ACCEPTED), intended_role_id |

### 3.3 Authentication Flow

**New Organization (First-time Director):**
```
Home → Sign Up (/signup)
  ↓
Create email/password OR Google OAuth
  ↓
Supabase creates auth.users row
  ↓
PostgreSQL trigger handle_new_auth_user() fires
  ↓
Trigger creates users row (no org_id yet, no roles)
  ↓
Redirect to /onboarding/setup
  ↓
Director fills org name + type
  ↓
API /api/onboarding/provision-org/:
   - Creates organizations row
   - Creates root org_unit
   - Links user to organization_id
   - Assigns DIRECTOR role
   - Creates 3 wallets (SALARY_POOL, LOAN_POOL, PERSONAL)
  ↓
Redirect to /workspace/director ✅
```

**Existing Organization (Team Member):**
```
Email invitation received: /accept-invite?token=xyz
  ↓
Click link → /accept-invite?token=xyz page
  ↓
Enter password + name
  ↓
Supabase auth.signUp() creates auth.users row
  ↓
PostgreSQL trigger handle_new_auth_user() fires
  ↓
Trigger finds PENDING invitation by email
  ↓
Trigger creates users row + assigns role from invitation + creates PERSONAL wallet
  ↓
API marks invitation as ACCEPTED
  ↓
Redirect to /workspace/{roleBase} ✅
```

**Returning User (Any Role):**
```
/login → email/password OR Google OAuth
  ↓
Auth succeeds
  ↓
OAuth callback fetches getSessionUser()
  ↓
getSessionUser() queries users + user_roles + roles tables
  ↓
Returns: { id, email, organizationId, orgUnitId, scopeLevels: ["DIRECTOR"] }
  ↓
getRedirectPath() computed: "DIRECTOR" → "director" → /workspace/director
  ↓
Redirect to /workspace/director ✅
```

### 3.4 URL Structure

All authenticated routes follow this pattern:
```
/workspace/{roleBase}
/workspace/{roleBase}/tasks
/workspace/{roleBase}/earnings
/workspace/{roleBase}/settings
/workspace/{roleBase}/team
/workspace/{roleBase}/verification
```

Where `{roleBase}` is determined by user's highest scope_level:
- `SYSTEM_ADMIN` → `admin`
- `DIRECTOR` → `director`
- `FINANCE_ADMIN` → `finance`
- `ORG_UNIT_LEAD` → `lead`
- `MEMBER` → `member`

**Navigation is dynamically generated** in `app/(workspace)/layout.tsx`:
- Fetches user's scope_level
- Maps to roleBase
- Generates nav links: `/workspace/{roleBase}/tasks`, etc.
- Never hardcoded (prevents 404 drift)

---

## 4. FEATURES IMPLEMENTED

### 4.1 Authentication & Authorization
- ✅ Multi-provider auth: email/password + Google OAuth
- ✅ Multi-tenant isolation: organization_id on every table
- ✅ Role-based access: 5 scope levels with different capabilities
- ✅ Session management: getSessionUser() with org + roles context
- ✅ Dynamic routing: Path computed from role, not hardcoded

### 4.2 Onboarding
- ✅ Signup: Email/Google → org creation flow
- ✅ Org Provisioning: Atomic transaction (org + unit + role + wallets)
- ✅ Invitations: Director invites team members via email
- ✅ Acceptance: Members click link → create account → auto-assigned role

### 4.3 User Management
- ✅ Role assignment: Via invitations or director panel
- ✅ Org hierarchy: Department/unit structure
- ✅ User profiles: Name, email, employment type, status

### 4.4 Wallets & Ledger
- ✅ Three wallet types: SALARY_POOL, LOAN_POOL, PERSONAL
- ✅ Transaction ledger: Track all movements
- ✅ Balance queries: RLS-protected wallet views

### 4.5 Tasks & Work Management
- ✅ Task creation: Structured + unstructured types
- ✅ Task submission: Members submit proof/screenshots
- ✅ Marketplace: Browse unstructured opportunities
- ✅ Self-nomination: Members apply for tasks

### 4.6 Verification & Approval
- ✅ Lead verification: Review submissions with proof
- ✅ Director approval: Approve verified work
- ✅ Proof upload: Attachment storage for submissions

### 4.7 Dashboards (UI Layouts Exist, Logic Partial)
- ✅ Member dashboard: View tasks, earnings, marketplace
- ✅ Lead dashboard: Verify submissions, approve work
- ❌ Director dashboard: Manage team, initiate cycles (UI exists, logic needs work)
- ❌ Finance dashboard: Payout management (UI exists, logic needs work)
- ❌ Admin dashboard: Platform config (placeholder)

---

## 5. CURRENT ISSUES FIXED

### 5.1 Navigation 404 Errors
**Problem:** All sidebar links pointed to `/workspace/tasks` (hardcoded), but URLs should be `/workspace/{roleBase}/tasks`.

**Fixed:**
- Rewrote `app/(workspace)/layout.tsx` to dynamically generate nav links
- Created `lib/auth/get-redirect.ts` as single source of truth for role → path mapping
- All navigation now uses computed paths: `/workspace/${roleBase}/${subpath}`

### 5.2 Role Assignment on Signup
**Problem:** New users signed up had no roles, defaulted to MEMBER.

**Fixed:**
- Created `/onboarding/setup/page.tsx` for org provisioning
- Created `/api/onboarding/provision-org/route.ts` for atomic org creation
- Assigns DIRECTOR role to first-time org creator automatically
- PostgreSQL trigger assigns role to invited members via `handle_new_auth_user()`

### 5.3 Redirect Logic
**Problem:** Redirect sent users to `/{orgId}/member` which doesn't exist; actual routes are `/workspace/member`.

**Fixed:**
- Updated `lib/auth/get-redirect.ts` to return `/workspace/{roleBase}` (not `/{orgId}/{roleBase}`)
- Updated OAuth callback to use dynamic redirect
- Updated login page to use `getRedirectPath(user)`

### 5.4 Missing Signup Page
**Problem:** Home page had "Sign up" link but no signup page existed.

**Fixed:**
- Created `/app/signup/page.tsx` with email/Google signup options
- Signup creates account → redirects to `/onboarding/setup`
- Setup form creates org → assigns DIRECTOR → redirects to `/workspace/director`

---

## 6. HOW TO USE (End-to-End)

### 6.1 First-Time Director Setup
1. Visit `http://localhost:3000`
2. Click "Sign In" or "Sign Up"
3. If signing up:
   - Enter email/password or use Google
   - Form sends to Supabase
   - Trigger creates users row
   - Redirects to `/onboarding/setup`
4. Fill organization form:
   - Name: "My University"
   - Type: "Educational Institution"
   - Click "Create Organization"
5. API provisions:
   - Creates organization
   - Creates root department
   - Links user to org_id
   - Assigns DIRECTOR role
   - Creates 3 wallets
6. Redirects to `/workspace/director` ✅
7. Dashboard shows:
   - Left nav: Dashboard, Tasks, Earnings, Team, Settings
   - Main content: Org overview, team, cycles

### 6.2 Inviting a Team Member
1. Director goes to `/workspace/director/team` (or similar)
2. Fills invite form:
   - Email: member@org.com
   - Role: ORG_UNIT_LEAD or MEMBER
   - Org Unit: Select department
3. System creates `invitations` row + generates token
4. Sends email with link: `/accept-invite?token=abc123`

### 6.3 Member Accepts Invitation
1. Member receives email with `/accept-invite?token=abc123` link
2. Clicks link → `/accept-invite?token=abc123` page
3. Enters password + name
4. Clicks "Create Account"
5. Supabase auth creates auth.users
6. PostgreSQL trigger:
   - Finds invitation by email + status=PENDING
   - Creates users row with org_id from invitation
   - Assigns role from invitation.intended_role_id
   - Creates PERSONAL wallet
   - Marks invitation ACCEPTED
7. Redirects to `/workspace/member` or `/workspace/lead` (based on role) ✅

### 6.4 Member Completes Task
1. Member goes to `/workspace/member/tasks`
2. Browses available structured/unstructured tasks
3. Selects task → fills submission form:
   - Proof/screenshot upload
   - Comment/notes
4. System creates `task_submissions` row with status=SUBMITTED
5. Assigns to lead for verification

### 6.5 Lead Verifies Work
1. Lead goes to `/workspace/lead/verification` (or dashboard notification)
2. Reviews submission:
   - Proof screenshot/attachment
   - Member's notes
3. Clicks "Approve" or "Reject"
4. If approved:
   - `task_submissions.status` = VERIFIED
   - Notifies director
5. If rejected:
   - Requires reason/feedback
   - Resets submission for re-do

### 6.6 Director Approves & Cycle
1. Director goes to `/workspace/director` (dashboard)
2. Sees week's verified submissions
3. Clicks "Start Salary Cycle" (if none active):
   - `salary_cycles.status` = ACTIVE
   - Calls `mint_cycle_budget()` PL/pgSQL function
   - Mints credits to SALARY_POOL wallet
4. Reviews verified work + clicks "Approve All This Week"
5. System updates `task_submissions.status` = APPROVED
6. Creates `wallet_transactions`:
   - Debit: SALARY_POOL
   - Credit: Member's PERSONAL wallet
   - Amount: Task reward (e.g., 100 credits)

### 6.7 Finance Processes Payout
1. Finance admin goes to `/workspace/finance` (dashboard)
2. Reviews pending payouts:
   - Members' PERSONAL wallet balances
   - Salary release eligibility (min. accumulated credits)
3. Selects members for payout
4. Clicks "Process Payouts"
5. System creates `wallet_transactions`:
   - Debit: Member's PERSONAL wallet
   - Credit: Bank/actual salary account
6. Generates salary slip/report

---

## 7. DATABASE SCHEMA HIGHLIGHTS

### 7.1 Multi-Tenancy Enforcement
Every table has `organization_id` foreign key:
```sql
CREATE TABLE tasks (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT,
  ...
);

-- RLS Policy: Users can only see their org's tasks
CREATE POLICY "users_see_own_org_tasks"
  ON tasks FOR SELECT
  USING (organization_id = current_user_org_id());
```

### 7.2 Role-Based Access
```sql
CREATE TABLE user_roles (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE roles (
  id UUID PRIMARY KEY,
  name TEXT,  -- "DIRECTOR", "MEMBER", etc.
  scope_level TEXT UNIQUE,  -- Determines dashboard route
  permissions JSONB  -- Fine-grained capabilities
);
```

### 7.3 Wallet Ledger Pattern
```sql
CREATE TABLE wallets (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  owner_user_id UUID NOT NULL,  -- Director's user_id or Member's user_id
  purpose wallet_purpose (SALARY_POOL, LOAN_POOL, PERSONAL),
  balance DECIMAL(12,2),
  FOREIGN KEY (organization_id) REFERENCES organizations(id),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY,
  from_wallet_id UUID REFERENCES wallets(id),
  to_wallet_id UUID REFERENCES wallets(id),
  amount DECIMAL(12,2),
  transaction_type TEXT (TRANSFER, MINT, DEBIT),
  related_task_id UUID REFERENCES tasks(id),
  created_at TIMESTAMP
);
```

---

## 8. COMPONENT ATTRIBUTION

### Pages (UI Scaffolds Exist)
- `app/(workspace)/member/page.tsx` - Member home
- `app/(workspace)/member/tasks/page.tsx` - Browse tasks
- `app/(workspace)/member/earnings/page.tsx` - View earnings
- `app/(workspace)/member/marketplace/page.tsx` - Unstructured opportunities
- `app/(workspace)/lead/page.tsx` - Lead home (partial)
- `app/(workspace)/lead/verification/[taskId]/page.tsx` - Verify task
- `app/(workspace)/director/page.tsx` - Director home (placeholder)
- `app/(workspace)/finance/page.tsx` - Finance admin (placeholder)
- `app/(workspace)/settings/page.tsx` - Settings (all roles)
- `app/(workspace)/config/page.tsx` - Org config (admin)

### API Routes (Logic Exists)
- `POST /api/onboarding/provision-org` - Create org + assign role + wallets
- `POST /api/auth/get-session` - Fetch session with context
- `GET /auth/callback` - OAuth callback with smart routing
- `POST /api/lead/approve-proof` - Lead verifies task
- `POST /api/lead/reject-proof` - Lead rejects task

### Utilities
- `lib/auth/session.ts:getSessionUser()` - Fetch user + org + roles (Server Component safe)
- `lib/auth/get-redirect.ts:getRedirectPath()` - Compute dashboard route from scope_level
- `lib/auth/protect.ts` - Middleware for route protection + role checking

---

## 9. WHAT'S WORKING

✅ **Authentication:** Signup, login, OAuth, session management
✅ **Multi-tenancy:** Organization isolation, org units, hierarchy
✅ **Authorization:** Role assignment, scope-level access control
✅ **Wallets:** Three wallet types per director, personal for all
✅ **Task Management:** Create, submit, browse tasks
✅ **Verification:** Lead can review + approve/reject
✅ **Navigation:** Dynamic routing, no hardcoded 404s
✅ **Onboarding:** Signup → org setup → dashboard

---

## 10. WHAT NEEDS WORK

### Director Dashboard
- [ ] Display org structure + units
- [ ] Initiate salary cycles
- [ ] View week's verified/approved work
- [ ] Bulk approve verified submissions
- [ ] See team performance metrics
- [ ] Configure cycle budget

### Finance Dashboard
- [ ] View all members' PERSONAL wallet balances
- [ ] Filter by salary eligibility
- [ ] Batch payout selection
- [ ] Process payouts (wallet transactions)
- [ ] Generate salary slips
- [ ] Audit trail reports

### Task Management
- [ ] Assign structured tasks to members
- [ ] Create recurring tasks (weekly classes, etc.)
- [ ] Task templates library
- [ ] Bulk task creation

### Reporting
- [ ] Member earnings report
- [ ] Department productivity
- [ ] Salary cycle summary
- [ ] Compliance audit logs

### Fine-tuning
- [ ] Error handling edge cases
- [ ] Validation rules enforcement
- [ ] Performance optimization for large orgs
- [ ] Notification system
- [ ] Email templates

---

## 11. DEVELOPMENT GUIDELINES

### Adding a New Feature
1. **Define Data:** What tables/columns needed?
   - Add to `schema.sql`
   - Create migration (Supabase SQL editor)
   - Test RLS policies
2. **API Endpoint:** Handle the business logic
   - Create `app/api/feature/route.ts`
   - Use `createClient()` for server operations
   - Return `NextResponse.json()` or error
3. **UI Component:** Display to user
   - Create component in `components/`
   - Use `fetch()` to call API
   - Handle loading/error states
4. **Page Integration:** Add to dashboard
   - Import component into page
   - Wire API calls
   - Style with Tailwind
5. **Test:** Try end-to-end
   - Sign up new org
   - Invite team member
   - Complete feature workflow

### Debugging
```typescript
// Use console.log with [v0] prefix for debugging
console.log("[v0] user:", user)
console.log("[v0] org:", org)
console.log("[v0] roles:", roles)

// Check session
const user = await getSessionUser()
if (!user) console.error("[v0] No session")
```

### RLS Policies
Every SELECT/INSERT/UPDATE needs RLS check:
```sql
CREATE POLICY "users_see_own_org_tasks"
  ON tasks FOR SELECT
  USING (organization_id = (SELECT organization_id FROM users WHERE id = auth.uid()));
```

---

## 12. DEPLOYMENT CHECKLIST

- [ ] Database schema deployed (schema.sql in Supabase)
- [ ] Roles seeded (SYSTEM_ADMIN, DIRECTOR, etc.)
- [ ] Environment variables set (SUPABASE_URL, SUPABASE_KEY)
- [ ] OAuth providers configured (Google)
- [ ] Email templates configured (invitations)
- [ ] Wallets logic tested (mint, debit, credit)
- [ ] Verification workflows tested end-to-end
- [ ] Performance tested with 100+ users
- [ ] Security audit (RLS, SQL injection, CSRF)
- [ ] Monitoring/logging set up

---

**Status:** Core platform functional. Director/Finance dashboards and advanced features in progress.
