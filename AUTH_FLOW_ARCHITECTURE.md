# WorkLedger Auth & User Flow Architecture

## Core Principle: No Public Signup

**This system is NOT a consumer SaaS.** It is an enterprise multi-tenant platform. There is NO public signup route. Only authorized admins and invited users can create accounts.

---

## The Three Entry Points

### 1. **SYSTEM_ADMIN Initial Login** (First Organization Setup)

**Entry Point:** `/login`  
**Actor:** First admin with system credentials  
**Database State:** User exists in `auth.users` but `users.organization_id` is NULL

**Flow:**

```
Admin visits /login
    ↓
Enters email + password (or Google OAuth)
    ↓
supabase.auth.signInWithPassword() succeeds
    ↓
Auth redirects to /workspace
    ↓
App checks: SELECT organization_id FROM users WHERE id = auth.user.id
    ↓
Result: NULL (first time)
    ↓
Redirect to /admin-setup
    ↓
Admin fills: Organization Name + Type
    ↓
App creates:
  - organizations row
  - Updates users.organization_id
  - Creates SYSTEM_ADMIN role assignment
  - Creates SALARY_POOL + LOAN_POOL wallets
    ↓
Redirect to /workspace
    ↓
✅ Dashboard loads with empty org
```

**POST /login Flow (in code):**
```typescript
// After successful auth
const { data: user } = await supabase.from("users")
  .select("organization_id").eq("id", auth.user.id).single()

if (!user?.organization_id) {
  router.push("/admin-setup")  // First time: admin setup
} else {
  router.push("/workspace")    // Returning: go to dashboard
}
```

**Database Changes:**
- `users` table: `organization_id` is populated
- `user_roles` table: SYSTEM_ADMIN role assigned
- `roles` table: Pre-seeded (see seed script below)

---

### 2. **Invited Users Accept Invitation** (Team Member Onboarding)

**Entry Point:** `/accept-invite?token=xyz`  
**Actor:** Team member with email invitation  
**Database State:** Invitation exists, user doesn't exist

**Flow:**

```
Team member receives email with link:
  https://app.com/accept-invite?token=abc123
    ↓
Visits /accept-invite
    ↓
App fetches invitation:
  SELECT * FROM invitations 
  WHERE token = 'abc123' AND status = 'PENDING'
    ↓
Step 1: User creates password
  - Email is pre-filled (from invitation)
  - Enters password + name
  - Clicks "Create Account"
    ↓
App calls:
  supabase.auth.signUp({
    email: invitation.email,
    password,
    options: {
      data: {
        organization_id: invitation.organization_id,
        name
      }
    }
  })
    ↓
PostgreSQL trigger fires: handle_new_auth_user()
  - Creates users row
  - Creates PERSONAL wallet
    ↓
Step 2: Role assignment (auto-detected from invitation)
  - Update invitations.status = 'ACCEPTED'
  - Assign role from invitation.role_id
  - Redirect to /workspace
    ↓
✅ Team member dashboard loads
```

**Database Changes:**
- `auth.users` row created (by Supabase)
- PostgreSQL trigger creates `users` row
- PostgreSQL trigger creates `wallets` row (PERSONAL)
- `invitations` row: status = 'ACCEPTED'
- `user_roles` row created (from invitation)

---

### 3. **Existing User Repeated Login**

**Entry Point:** `/login`  
**Actor:** Any existing user  
**Database State:** User exists with organization_id

**Flow:**

```
User visits /login
    ↓
Enters credentials
    ↓
Auth succeeds
    ↓
Check: SELECT organization_id FROM users WHERE id = auth.user.id
    ↓
Result: NOT NULL (has org)
    ↓
Direct to /workspace
    ↓
✅ Dashboard loads
```

---

## Role-Based Access Control (RBAC)

### Roles Hierarchy

```
SYSTEM_ADMIN (1 per system, usually just 1 per org)
  ├─ Full system access
  ├─ Create organizations
  ├─ Configure all engines
  └─ Manage finance

DIRECTOR (1+ per org)
  ├─ Organization-wide visibility
  ├─ Team management
  ├─ Release salary decisions
  └─ Approve leads

ORG_UNIT_LEAD (optional, per unit)
  ├─ Unit-level visibility
  ├─ Task verification
  └─ Proof approval

FINANCE_ADMIN (optional)
  ├─ Wallet management
  ├─ Salary release
  └─ Financial reports

MEMBER (default, many per org)
  ├─ Browse marketplace
  ├─ Complete tasks
  ├─ Submit proofs
  └─ View own earnings
```

### Assignment

**SYSTEM_ADMIN:** During initial /login → /admin-setup  
**Other Roles:** Via invitation OR director assignment in /director/team

---

## Database Schema - Key Tables for Auth

### `organizations`
```sql
id UUID PRIMARY KEY
name TEXT
type organization_type ENUM (COLLEGE, ENTERPRISE, GOVERNMENT, NGO, HOSPITAL, GENERIC)
template_key TEXT
created_at TIMESTAMP
```

### `users`
```sql
id UUID PRIMARY KEY (linked to auth.users.id)
organization_id UUID (FOREIGN KEY)
email TEXT
name TEXT
employment_type employment_type ENUM
status user_status ENUM (ACTIVE, INACTIVE, ONBOARDING)
created_at TIMESTAMP
```

### `user_roles`
```sql
user_id UUID (FOREIGN KEY users)
role_id UUID (FOREIGN KEY roles)
created_at TIMESTAMP
PRIMARY KEY (user_id, role_id)
```

### `roles`
```sql
id UUID PRIMARY KEY
organization_id UUID (FOREIGN KEY)
name TEXT
scope_level scope_level ENUM (SYSTEM_ADMIN, DIRECTOR, ORG_UNIT_LEAD, FINANCE_ADMIN, MEMBER)
created_at TIMESTAMP
```

### `invitations`
```sql
id UUID PRIMARY KEY
organization_id UUID (FOREIGN KEY)
email TEXT
role_id UUID (FOREIGN KEY roles)
token TEXT UNIQUE
status invitation_status ENUM (PENDING, ACCEPTED, EXPIRED)
created_at TIMESTAMP
expires_at TIMESTAMP
```

### `wallets`
```sql
id UUID PRIMARY KEY
organization_id UUID (FOREIGN KEY)
owner_user_id UUID (FOREIGN KEY users)
purpose wallet_purpose ENUM (PERSONAL, SALARY_POOL, LOAN_POOL)
balance NUMERIC
created_at TIMESTAMP
```

---

## PostgreSQL Trigger: handle_new_auth_user

Fires AFTER INSERT on auth.users table.

**Logic:**
```sql
1. Read NEW.raw_user_meta_data->>'organization_id'
2. If NULL: RAISE EXCEPTION (must be provided during signup)
3. INSERT INTO public.users (id, organization_id, email, name, ...)
4. INSERT INTO wallets (PERSONAL wallet for user)
5. ON CONFLICT: Do nothing (idempotent)
```

**Why This Matters:**
- Without this trigger, users created at /accept-invite would fail
- Trigger auto-creates public.users + PERSONAL wallet
- Eliminates race conditions between auth + database

---

## Invitation Flow - Admin Creates Invitation

**Actor:** DIRECTOR or SYSTEM_ADMIN  
**Entry Point:** /director/team/invite (UI form)

**Flow:**

```
Admin visits /director/team/invite
    ↓
Fills: Email + Role (dropdown)
    ↓
Clicks "Send Invitation"
    ↓
App:
  1. Creates invitations row (token = UUID)
  2. Sends email with link:
     https://app.com/accept-invite?token=xyz
  3. Shows "Invitation sent"
    ↓
Team member receives email
    ↓
Clicks link → /accept-invite?token=xyz
    ↓
Creates account (flow #2 above)
```

**Email Template:**
```
Subject: You've been invited to WorkLedger

Hi [email],

You've been invited to join [Organization] on WorkLedger.

Click here to accept and create your account:
https://app.com/accept-invite?token=abc123xyz

This link expires in 7 days.

---
WorkLedger Admin Team
```

---

## Initial System Setup (Post-Deployment)

### Step 1: Seed Roles (One Time)

```sql
INSERT INTO roles (organization_id, name, scope_level) VALUES
  (NULL, 'SYSTEM_ADMIN', 'SYSTEM_ADMIN'),
  (NULL, 'DIRECTOR', 'DIRECTOR'),
  (NULL, 'ORG_UNIT_LEAD', 'ORG_UNIT_LEAD'),
  (NULL, 'FINANCE_ADMIN', 'FINANCE_ADMIN'),
  (NULL, 'MEMBER', 'MEMBER');
```

### Step 2: Create Initial Admin User (One Time)

```sql
-- In Supabase Auth:
-- Create user: admin@workledger.local / password

-- In public schema:
INSERT INTO users (id, email, name, employment_type, status)
VALUES ('{auth_user_id}', 'admin@workledger.local', 'System Admin', 'FULL_TIME', 'ACTIVE');
```

### Step 3: First Login

Admin visits /login → Enters credentials → Redirected to /admin-setup → Creates first organization

---

## Critical Constraints

### No Public Signup
- ✗ NO `/signup` route
- ✗ NO "Sign up" buttons on login page
- ✗ NO public registration forms
- Only invitation-based or SYSTEM_ADMIN creation

### Authentication Always Required
- All /workspace/* routes require auth
- All API routes check session
- All database queries scoped by organization_id

### Invitation Token Expiry
- Tokens expire after 7 days
- Expired tokens redirect to home page
- Admin can re-send invitations

### Organization Boundary
- Users can only see data within their organization
- RLS policies enforce organization_id filtering
- No cross-org data access

---

## Testing the Auth Flow

### Test 1: Admin Initial Setup

```bash
1. Visit http://localhost:3000
2. Click "Admin Sign In"
3. Enter any email (won't exist yet in auth.users)
4. Get error: "Invalid login credentials"
5. (Need to seed initial admin first)
```

**To test properly:**
```sql
-- In Supabase, create auth user manually:
-- Email: admin@test.local
-- Password: TestPassword123

-- Then in public schema:
INSERT INTO users (id, email, name, organization_id, employment_type)
VALUES ('{auth_user_id}', 'admin@test.local', 'Test Admin', NULL, 'FULL_TIME');
```

Then:
```bash
1. Visit /login
2. Enter admin@test.local / TestPassword123
3. Should redirect to /admin-setup
4. Fill: Organization Name = "Test Org", Type = "ENTERPRISE"
5. Click "Create Organization"
6. Should redirect to /workspace
7. ✅ Dashboard renders
```

### Test 2: Invitation Accept

```bash
1. As admin in /director/team/invite
2. Send invitation to: user@test.local
3. Simulate email: Visit /accept-invite?token={token_from_db}
4. Step 1: Create password + name
5. Step 2: Account created, redirects to /workspace
6. ✅ Team member dashboard
```

---

## Environment Variables

These must be set for auth to work:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...
```

---

## Common Issues & Solutions

### Issue: "Database error saving new user"
**Cause:** PostgreSQL trigger `handle_new_auth_user` not created  
**Fix:** Execute schema.sql in Supabase SQL Editor

### Issue: Login successful but redirects to /login again
**Cause:** Session not being read by middleware  
**Fix:** Check middleware.ts is running; clear browser cookies

### Issue: /admin-setup shows blank form but submit fails
**Cause:** User doesn't have SYSTEM_ADMIN role in roles table  
**Fix:** Ensure roles are seeded (see Step 1 above)

### Issue: Invited user can't create account
**Cause:** Invitation token expired or already accepted  
**Fix:** Check invitations.status and expires_at in database

---

## Summary: The Three Paths

| Path | Entry | Actor | Destination |
|------|-------|-------|-------------|
| **Admin Setup** | /login (no org) | SYSTEM_ADMIN | /admin-setup → /workspace |
| **Team Member** | /accept-invite | Invited user | Creates account → /workspace |
| **Returning User** | /login (has org) | Any user | /workspace |

**Key Rule:** There is NO public /signup. All accounts are created either by:
1. SYSTEM_ADMIN initial setup, or
2. Invitation acceptance

This ensures enterprise-grade access control and prevents unauthorized account creation.
