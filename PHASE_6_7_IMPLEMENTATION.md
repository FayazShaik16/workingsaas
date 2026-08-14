# WorkLedger: Phase 6 & 7 Implementation Guide

## Overview

This document outlines the complete implementation of **Phase 6 (Auth & Onboarding)** and **Phase 7 (Member Workspace)** for the WorkLedger multi-tenant SaaS platform.

---

## Phase 6: Authentication & Onboarding

### Architecture

The auth system follows **Supabase SSR App Router** pattern with role-based scoping and automatic wallet creation.

#### Key Files

```
lib/
  ├── supabase/
  │   ├── client.ts      # Browser client (auto-refreshes with middleware)
  │   ├── server.ts      # Server-side client (reads cookies)
  │   └── middleware.ts  # Session refresh on every request
  ├── auth/
  │   ├── session.ts     # getSessionUser(), hasScope(), getScopeVisibleOrgUnits()
  │   └── protect.ts     # Route guards: requireAuth(), requireScope(), requireDirector(), requireLead()
  └── rpc/
      └── auth.ts        # RPC helpers: createNewAuthUser(), acceptInvitation()

app/
  ├── login/page.tsx                    # Email/password + Google OAuth signin
  ├── signup/page.tsx                   # 2-step: account creation + Tier 1 org classification
  ├── accept-invite/page.tsx            # Invitation-based user creation
  ├── onboarding/director-wizard/page.tsx # Multi-step wizard for org structure + roles
  ├── api/
  │   ├── auth/
  │   │   ├── callback/route.ts         # Supabase OAuth callback handler
  │   │   ├── accept-invite/route.ts    # API to accept invitations
  │   │   └── logout/route.ts           # Sign out handler
  │   └── onboarding/
  │       └── director-setup/route.ts   # Save org units + roles from wizard
  └── (workspace)/
      └── layout.tsx                    # Protected layout with real session data
```

### User Flows

#### 1. **Signup Flow (Self-Service)**
```
Signup Step 1: Email + Password
  ↓
  → Supabase auth.signUp() creates auth.users row
  ↓
Signup Step 2: Tier 1 Organization Classification
  ├─ Q1: Organization legal name
  ├─ Q2: Organization type (COLLEGE|ENTERPRISE|GOVERNMENT|NGO|HOSPITAL|GENERIC)
  ├─ Q3: Your full name
  ↓
  → POST /api/onboarding/director-setup
    ├─ CREATE organizations row
    ├─ CREATE users row (linked to auth user + org)
    ├─ CREATE wallets: PERSONAL, SALARY_POOL, LOAN_POOL
    ├─ CREATE default SYSTEM_ADMIN role
    └─ Assign SYSTEM_ADMIN to creator
  ↓
Director First-Login Wizard
  ├─ Step 1: Add organization units (departments, teams, divisions)
  ├─ Step 2: Define roles (Member, Unit Lead, Director)
  ├─ Step 3: Review & submit
  ↓
Redirect to /workspace (dashboard)
```

#### 2. **Invite Flow (Admin-Driven)**
```
Admin sends invitation email with token
  ↓
User clicks /accept-invite?token=XXX
  ↓
User Signs Up (email pre-filled)
  ↓
Supabase auth.signUp() → Auth user created
  ↓
POST /api/auth/accept-invite
  ├─ Verify invitation is PENDING and token is valid
  ├─ CREATE users row (linked to org_unit + intended_role)
  ├─ CREATE PERSONAL wallet
  ├─ Assign intended_role to user (if specified)
  └─ Mark invitation ACCEPTED
  ↓
Redirect to /workspace
```

#### 3. **Google OAuth Flow**
```
User clicks "Sign in with Google" on /login
  ↓
Supabase auth.signInWithOAuth({provider: "google", redirectTo: "/auth/callback"})
  ↓
Google auth → Redirect to /auth/callback?code=XXX
  ↓
GET /auth/callback
  → exchangeCodeForSession(code)
  → Supabase creates auth.users + session
  ↓
Redirect to /workspace
```

### Route Protection

All workspace routes automatically redirect unauthenticated users to `/login`:

```typescript
// In Server Components:
import { requireAuth, requireScope } from "@/lib/auth/protect"

export default async function ProtectedPage() {
  const user = await requireAuth()  // ← Redirects to /login if not authed
  return <h1>Welcome, {user.name}</h1>
}

// Scope-gated routes:
export default async function DirectorPage() {
  const user = await requireDirector()  // ← DIRECTOR or SYSTEM_ADMIN only
  // ...
}
```

### Wallet Initialization

On signup/invite acceptance:

```
PERSONAL wallet      → User's credit balance (for monthly threshold checking)
SALARY_POOL wallet  → Org-level pool (seeds salary transfers)
LOAN_POOL wallet    → Org-level pool (loan disbursements)
```

---

## Phase 7: Member Workspace (First Vertical Slice)

### Architecture

The member workspace implements the complete task lifecycle from nomination through verification to credit reward.

#### Key Files

```
lib/rpc/workflow.ts                        # execute_workflow_transition() - core state machine
                                           # getValidTransitions() - permission-aware queries

components/shared/                         # SC-* primitives (already built Phase 5)
  ├── data-table-primitive.tsx
  ├── sheet-drawer-primitive.tsx
  ├── status-pill.tsx
  ├── confirm-action-dialog.tsx
  └── empty-state-placeholder.tsx

app/(workspace)/member/
  ├── page.tsx                             # MB-01: Dashboard (progress bar, active nominations)
  ├── marketplace/
  │   ├── page.tsx                         # MB-03: Task listing + filters + search
  │   └── [taskId]/page.tsx                # MB-04: Task detail + apply button
  ├── tasks/page.tsx                       # MB-05: Accepted tasks list (DataTable)
  └── earnings/page.tsx                    # MB-18: Credit ledger + transaction history
```

### User Flows

#### **Complete Task Lifecycle**

```
1. MEMBER sees OPEN tasks in /workspace/member/marketplace
   ├─ Filters: category, search
   ├─ Shows: title, credit_value, deadline, priority
   └─ Status: OPEN

2. MEMBER clicks task → /workspace/member/marketplace/[taskId]
   ├─ Full description, verification mode, peer review required
   ├─ Shows task_type_definitions + creator
   └─ Button: "Submit Application"

3. MEMBER submits nomination (optional message)
   → POST nomination row
   → Status: PENDING (awaiting lead acceptance)

4. LEAD reviews nominations in /workspace/lead/verification
   ├─ See all PENDING nominations for their unit
   ├─ Accept/Reject each one
   └─ On accept:
       → workflow_transition NOMINATED → ASSIGNED
       → workflow_transition_log created
       → Notification sent to MEMBER

5. MEMBER sees task in /workspace/member/tasks
   ├─ Status: ASSIGNED
   ├─ Button: "Start Work" or "Mark In Progress"
   └─ → workflow_transition ASSIGNED → IN_PROGRESS

6. MEMBER completes work + uploads proof
   ├─ File upload to Supabase Storage
   ├─ task_proofs row created
   └─ → workflow_transition IN_PROGRESS → VERIFICATION_PENDING

7. LEAD/PEER reviews proof
   ├─ Approves or requests changes
   ├─ If approve:
   │   ├─ task_peer_reviews row created
   │   ├─ workflow_transition VERIFICATION_PENDING → PEER_APPROVED
   │   └─ business_rules trigger:
   │       └─ token_transactions INSERT (TASK_REWARD)
   │       └─ member.wallets.balance += credit_value
   │
   └─ If reject:
       ├─ task_peer_reviews row created (REJECTED)
       └─ workflow_transition VERIFICATION_PENDING → REJECTED

8. LEAD signs off on approved task
   ├─ workflow_transition PEER_APPROVED → LEAD_SIGNED
   ├─ tasks.lead_signed_by = lead_user_id
   ├─ tasks.lead_signed_at = NOW()
   └─ → workflow_transition LEAD_SIGNED → CLOSED

9. MEMBER sees credit in /workspace/member/earnings
   ├─ token_transactions shows TASK_REWARD entry
   ├─ Wallet balance updated
   ├─ Progress bar reflects new balance
   └─ If balance >= monthly_target:
       └─ "✓ Target met - salary release eligible"
```

### Data Model Walkthrough

#### Organizations
```typescript
{
  id: UUID,
  name: "Engineering Corp",           // From signup step 2
  type: "ENTERPRISE",                  // COLLEGE|ENTERPRISE|GOVERNMENT|NGO|HOSPITAL|GENERIC
  template_key: "enterprise",
  created_at: TIMESTAMPTZ
}
```

#### Users
```typescript
{
  id: UUID,                            // Supabase auth.users.id
  organization_id: UUID,               // FK → organizations
  org_unit_id: UUID,                   // FK → org_units (team/department assignment)
  email: CITEXT,
  name: TEXT,
  employment_type: ENUM,               // FULL_TIME|PART_TIME|CONTRACT|BENCH
  progress_percentage: NUMERIC,        // Monthly target progress
  status: ENUM                         // ACTIVE|SUSPENDED|OFFBOARDED
}
```

#### Wallets
```typescript
{
  id: UUID,
  organization_id: UUID,
  owner_user_id: UUID,
  purpose: ENUM,                       // PERSONAL|SALARY_POOL|LOAN_POOL
  balance: NUMERIC(36,18)              // Token balance
}
```

#### Tasks
```typescript
{
  id: UUID,
  organization_id: UUID,
  org_unit_id: UUID,
  task_type_id: UUID,
  title: TEXT,
  description: TEXT,
  credit_value: NUMERIC(12,4),
  status: ENUM,                        // DRAFT → OPEN → NOMINATED → ASSIGNED → IN_PROGRESS
                                       // → VERIFICATION_PENDING → PEER_APPROVED → LEAD_SIGNED → CLOSED
  category: ENUM,                      // STRUCTURED|UNSTRUCTURED
  requires_peer_review: BOOL,
  deadline: TIMESTAMPTZ
}
```

#### Nominations
```typescript
{
  id: UUID,
  task_id: UUID,
  user_id: UUID,
  message: TEXT,
  status: ENUM                         // PENDING|ACCEPTED|REJECTED
}
```

#### Token Transactions (Ledger)
```typescript
{
  id: UUID,
  organization_id: UUID,
  from_wallet_id: UUID,
  to_wallet_id: UUID,
  amount: NUMERIC(36,18),
  type: ENUM,                          // MINT|SALARY_TRANSFER|LOAN_ISSUE|TASK_REWARD|...
  status: ENUM,                        // PENDING|CONFIRMED|FAILED
  timestamp: TIMESTAMPTZ,
  notes: TEXT
}
```

#### Workflow Transition Log
```typescript
{
  id: UUID,
  organization_id: UUID,
  entity_type: TEXT,                   // "tasks" | "loans"
  entity_id: UUID,
  from_state: TEXT,
  to_state: TEXT,
  actor_id: UUID,
  transition_id: UUID,
  occurred_at: TIMESTAMPTZ
}
```

### Role Scopes

| Scope | Can Do |
|-------|--------|
| **MEMBER** | Browse tasks, nominate, upload proofs, view earnings |
| **ORG_UNIT_LEAD** | Accept nominations, verify proofs, sign off tasks |
| **DIRECTOR** | Manage team, approve leads, override decisions |
| **FINANCE_ADMIN** | View transaction ledger, process loans, manage compensation |
| **SYSTEM_ADMIN** | Everything + organization configuration |

### Query Patterns

#### 1. **Get Current User's Session**
```typescript
const user = await getSessionUser()
// Returns: { id, email, name, organizationId, roles, scopeLevels, ... }
```

#### 2. **List Open Tasks (Member View)**
```typescript
const { data: tasks } = await supabase
  .from("tasks")
  .select(...)
  .eq("status", "OPEN")
  .eq("organization_id", orgId)
  .order("deadline")

// RLS automatically filters to user's visible org_units
```

#### 3. **Execute Workflow Transition**
```typescript
const result = await executeWorkflowTransition(
  "tasks",              // entity type
  taskId,               // entity id
  "ASSIGNED",           // to_state
  currentUserId         // actor
)

// Validates:
// ✓ Valid transition (from current state to new state)
// ✓ Actor has required role scope
// ✓ Business rules triggered
// ✓ workflow_transition_log created
```

#### 4. **Get Transaction History**
```typescript
const { data: transactions } = await supabase
  .from("token_transactions")
  .select(...)
  .eq("to_wallet_id", walletId)
  .order("timestamp", { ascending: false })

// Shows: TASK_REWARD, SALARY_TRANSFER, LOAN_ISSUE, REVERSE_TRANSFER
```

---

## Environment Variables Required

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: OAuth providers
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## Testing Checklist

### Auth
- [ ] Signup with email/password
- [ ] Signup with Google OAuth
- [ ] Director wizard creates org units + roles
- [ ] Accept invitation flow
- [ ] Login with email/password
- [ ] Login with Google
- [ ] Logout redirects to /login

### Member Workflow
- [ ] View marketplace tasks
- [ ] Filter by category + search
- [ ] Apply for task (create nomination)
- [ ] See accepted tasks in /workspace/member/tasks
- [ ] View earnings + transaction history
- [ ] Progress bar shows monthly target progress

### Data Integrity
- [ ] Wallets created automatically on signup
- [ ] Organizations have correct type enum
- [ ] Users assigned to correct org_units
- [ ] Roles have correct scope_level
- [ ] workflow_transition_log entries match actual transitions

---

## Next Steps (Phase 8)

**Lead Workspace (LD-*)**: Verification queue, nomination review, proof approval
**Director Workspace (DR-*)**: Team management, role assignment, policy settings
**Finance Workspace (FN-*)**: Transaction ledger, loan management, compensation reports
**Config Workspace (CF-*)**: Workflow definitions, business rules, notification templates

---

## Architecture Principles

1. **No Hardcoded Logic**: All business logic stored in config engines (workflow_definitions, business_rules, etc.)
2. **State Machine Only**: Task/loan status changes ONLY through execute_workflow_transition()
3. **Immutable Ledger**: token_transactions table is append-only (cryptographic integrity future-ready)
4. **Scope-Based Access**: RLS policies + scope_level enum enforce multi-tenancy
5. **Generic Platform**: Code never mentions "College", "Employee", "Faculty" — all tenant-specific
6. **Workflow-Driven**: Transitions trigger business rules, notifications, and ledger entries automatically
