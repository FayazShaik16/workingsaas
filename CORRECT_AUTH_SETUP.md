# WorkLedger: Correct Authentication Flow Setup

## Critical Understanding

**NO PUBLIC SIGNUP. NO /admin-setup. INVITATION ONLY.**

The system uses an **invitation-based model** matching enterprise requirements:
- Platform Admin (vendor) provisions organizations
- Platform Admin creates the first Director invitation
- Director accepts invitation and starts managing their organization
- Director invites all team members (Deans, Leads, Members, Finance Admins, System Admins)
- All team members accept invitations and join

## Three Entry Points (Correct)

### 1. **Sign In** (/login)
For **returning users** who already have auth.users + users rows
- Email + password
- Redirects directly to /workspace

### 2. **Accept Invitation** (/accept-invite?token=xyz)
For **new users** accepting an invitation
- Step 1: Enter password + name
- PostgreSQL trigger automatically:
  - Creates users row (linked to organization from invitation)
  - Creates user_roles (from invitation.intended_role_id)
  - Creates PERSONAL wallet
  - Marks invitation as ACCEPTED
- Redirects to /workspace

### 3. **Platform Admin Setup** (Vendor-side tool, not in this app)
Creates organizations and first Director invitation

## Database Setup: Exact Steps

### Step 1: Execute Full schema.sql

```bash
# Local dev or Supabase SQL Editor
psql -U postgres -d your_db < schema.sql
```

In Supabase Dashboard:
- Go to SQL Editor
- Create new query
- Copy entire schema.sql (lines 1-1242)
- Click RUN
- Wait for "Query successful"

### Step 2: Seed Initial Roles

```sql
-- Run in Supabase SQL Editor
INSERT INTO roles (organization_id, name, scope_level, is_system_role) 
SELECT 
  organizations.id,
  'DIRECTOR'::text,
  'DIRECTOR'::text,
  false
FROM organizations
LIMIT 1;

-- Repeat for other roles or run this bulk insert:
-- After you have ONE organization created
```

Actually, let me simplify. See Step 3 first.

### Step 3: Create First Organization

You can create this manually OR the Platform Admin creates it. For testing:

```sql
-- Create test organization (in Supabase SQL Editor)
INSERT INTO organizations (id, name, type, template_key)
VALUES (
  gen_random_uuid(),
  'Test Company',
  'ENTERPRISE'::organization_type,
  'GENERIC'
)
RETURNING id;

-- Copy the id from response, use it below
```

### Step 4: Create Roles for This Organization

```sql
-- Replace {ORG_ID} with the id from Step 3
INSERT INTO roles (organization_id, name, scope_level, is_system_role)
VALUES
  ('{ORG_ID}', 'DIRECTOR', 'DIRECTOR', false),
  ('{ORG_ID}', 'DEAN', 'DEAN', false),
  ('{ORG_ID}', 'ORG_UNIT_LEAD', 'ORG_UNIT_LEAD', false),
  ('{ORG_ID}', 'FINANCE_ADMIN', 'FINANCE_ADMIN', false),
  ('{ORG_ID}', 'SYSTEM_ADMIN', 'SYSTEM_ADMIN', false),
  ('{ORG_ID}', 'MEMBER', 'MEMBER', false);

-- Get the DIRECTOR role id (you'll need it next)
SELECT id FROM roles WHERE organization_id = '{ORG_ID}' AND name = 'DIRECTOR';
-- Copy this id
```

### Step 5: Create Root Org Unit

```sql
-- Replace {ORG_ID} with your org id
INSERT INTO org_units (organization_id, name, unit_type, path)
VALUES (
  '{ORG_ID}',
  'Root',
  'ORGANIZATION',
  'root'::ltree
)
RETURNING id;

-- Copy the id returned
```

### Step 6: Create First Director Invitation

```sql
-- Replace placeholders:
-- {ORG_ID} = from Step 3
-- {ROOT_UNIT_ID} = from Step 5
-- {DIRECTOR_ROLE_ID} = from Step 4
-- {DIRECTOR_EMAIL} = the email you want to invite

INSERT INTO invitations (
  organization_id,
  org_unit_id,
  email,
  intended_role_id,
  token,
  status,
  expires_at
)
VALUES (
  '{ORG_ID}',
  '{ROOT_UNIT_ID}',
  '{DIRECTOR_EMAIL}',
  '{DIRECTOR_ROLE_ID}',
  gen_random_uuid()::text,
  'PENDING'::invitation_status,
  NOW() + INTERVAL '7 days'
)
RETURNING token;

-- Copy the token value
```

### Step 7: Create Auth User (in Supabase)

Go to Supabase Dashboard → Authentication → Users → Add User

- Email: `{DIRECTOR_EMAIL}` (same as invitation email)
- Password: Generate strong password
- Auto Confirm User: YES (check this)

This creates the auth.users row.

### Step 8: Generate Invitation Link

```
http://localhost:3000/accept-invite?token={TOKEN_FROM_STEP_6}
```

Test this link locally or send to Director.

## Testing Flow

### Test 1: Accept Invitation (New User)

1. Copy invitation link from Step 8
2. Visit in browser (new incognito window)
3. Should see "Accept Invitation" page
4. Email pre-filled with invitation email
5. Enter password (8+ chars) + name
6. Click "Create Account"
7. Should redirect to /workspace
8. ✅ If you see workspace: **Trigger worked!**

### Test 2: Return and Sign In

1. Go to http://localhost:3000
2. Click "Sign In"
3. Enter the email + password you set
4. Should redirect to /workspace
5. ✅ If you see workspace: **Login worked!**

### Test 3: Verify Database

```sql
-- Check that user was created
SELECT id, email, organization_id FROM users LIMIT 1;

-- Check that invitation is marked ACCEPTED
SELECT id, email, status FROM invitations LIMIT 1;

-- Check that user has role
SELECT user_id, role_id FROM user_roles LIMIT 1;

-- Check that PERSONAL wallet exists
SELECT owner_user_id, purpose FROM wallets LIMIT 1;
```

All should have rows ✅

## Troubleshooting

### Error: "Not authenticated" when accepting invitation

**Cause:** Accepting an invitation doesn't create auth.users automatically
**Fix:** You must create the auth user first (Step 7) BEFORE clicking the invite link

Actually no - the flow should be:
1. Click invite link
2. Page shows "Accept Invitation"
3. You enter password
4. We call auth.signUp which creates auth.users
5. Trigger fires

If you get "Not authenticated", it means you clicked the link but the auth.signUp failed.

**Debug:** Check browser console for the exact error

### Error: "Invalid or expired invitation"

**Cause:** 
- Token doesn't exist in DB
- Invitation is not PENDING
- Invitation expired (expires_at < NOW())

**Fix:** 
- Verify token matches exactly
- Run: `SELECT * FROM invitations WHERE token = '{token}'`
- Check status is 'PENDING'
- Check expires_at > NOW()

### User sees /workspace but no data

**Cause:** RLS policies blocking queries

**Fix:**
- Check user's role has permissions
- Check org_id matches in all queries
- Go to Supabase Dashboard → Database → Tables → users → RLS Policies
- Verify policies exist and are enabled

### Trigger didn't fire (users row not created)

**Cause:** 
- handle_new_auth_user function not created
- on_auth_user_created trigger not created
- No PENDING invitation for this email

**Fix:**
- Verify trigger exists: `SELECT * FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created'`
- Verify function exists: `SELECT * FROM pg_proc WHERE proname = 'handle_new_auth_user'`
- Check invitation: `SELECT * FROM invitations WHERE email = '{user_email}' AND status = 'PENDING'`

### Invitation token mismatch

**Make sure:**
- Token in DB matches token in URL exactly (including UUID format)
- No spaces or special characters
- Copy/paste carefully

## Key Points

1. **NO public signup** - Never create /signup endpoint
2. **Invitations are the gate** - Only way to create users
3. **Trigger does the work** - Automatically links user to organization
4. **Platform Admin provisions** - Creates first org + Director invitation
5. **Director manages everything else** - Invites team members from workspace

## SQL Queries for Debugging

```sql
-- See all organizations
SELECT id, name, type FROM organizations;

-- See all invitations
SELECT id, email, status, expires_at FROM invitations;

-- See all users
SELECT id, email, organization_id FROM users;

-- See user roles
SELECT u.email, r.name FROM user_roles ur
  JOIN users u ON u.id = ur.user_id
  JOIN roles r ON r.id = ur.role_id;

-- See wallets
SELECT u.email, w.purpose, w.balance FROM wallets w
  JOIN users u ON u.id = w.owner_user_id;

-- Check trigger
SELECT schemaname, tablename, triggername, function 
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created';
```

## Deployment

When deploying:

1. Execute schema.sql in production database
2. Manually create first organization (via SQL or admin tool)
3. Create roles for that organization
4. Create root org_unit
5. Create first Director invitation
6. Send invitation link to Director
7. Director accepts and starts onboarding team

Never expose /accept-invite generation - it's admin-only via DB insert or a vendor tool.
