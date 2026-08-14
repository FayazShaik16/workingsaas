# WorkLedger - Complete Setup & Troubleshooting Guide

## Table of Contents
1. [Environment Setup](#environment-setup)
2. [Database Configuration](#database-configuration)
3. [Auth & Signup Flow](#auth--signup-flow)
4. [Common Errors & Solutions](#common-errors--solutions)
5. [Step-by-Step Testing](#step-by-step-testing)

---

## Environment Setup

### 1. Environment Variables

Copy `.env.local.example` to `.env.local`:
```bash
cp .env.local.example .env.local
```

Your `.env.local` must have THREE variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-key-here
```

**Where to find these:**
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **Settings → API**
4. Copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service role secret** → `SUPABASE_SERVICE_ROLE_KEY`

**⚠️ Critical**: After updating `.env.local`, restart your dev server:
```bash
# Stop the dev server (Ctrl+C)
pnpm dev
```

### 2. Verify Environment Variables Load

Check that your environment is loaded correctly:
```bash
# In the browser console, run:
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
```

If you see `undefined`, your env vars are NOT loaded. The most common fix:
1. Stop the dev server completely
2. Delete `.next` folder: `rm -rf .next`
3. Restart with: `pnpm dev`

---

## Database Configuration

### Step 1: Execute schema.sql in Supabase

The `schema.sql` file contains the complete database schema with the critical auth trigger.

**Critical files that must exist:**
- ✅ `schema.sql` - Complete database schema (1242 lines)
- ✅ Trigger: `on_auth_user_created` - Fires when auth.users is created
- ✅ Function: `handle_new_auth_user()` - Creates users row + PERSONAL wallet

**To execute schema.sql:**

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy entire contents of `schema.sql` from your project
6. Paste into the SQL editor
7. Click **Run**
8. Wait for completion (should see "Query successful")

**If you get an error:**
- Check the error message carefully (see [Common Errors](#common-errors--solutions))
- Common issues: Missing extensions, wrong enum names, incorrect REFERENCES
- Our schema uses standard PostgreSQL 16 - no special Supabase-specific features except auth integration

### Step 2: Verify Tables Created

After executing schema.sql, verify the tables exist:

1. Go to **Database → Tables** in Supabase
2. You should see:
   - `organizations` - Tenant root
   - `users` - User profiles linked to auth.users
   - `org_units` - Org structure (hierarchical tree)
   - `invitations` - Email invites
   - `roles` - Role definitions
   - `user_roles` - User-to-role mapping
   - `tasks` - Task marketplace
   - `nominations` - User applications for tasks
   - `task_proofs` - Proof submissions
   - `wallets` - Token wallets (PERSONAL, SALARY_POOL, LOAN_POOL)
   - `token_transactions` - Ledger entries
   - `workflow_transition_log` - Audit trail
   - `business_rules` - Configurable actions
   - And 30+ more tables...

If any table is missing, schema execution failed. Check Supabase logs.

### Step 3: Enable Row Level Security (RLS)

RLS policies are defined in schema.sql and automatically created. They restrict data access by organization.

To verify RLS is enabled:
1. Go to **Database → Tables**
2. Click on `users` table
3. Go to **RLS** tab
4. You should see policies like:
   - `Enable access to own org users`
   - `Block all other access`

If no policies exist, schema execution failed.

### Step 4: Critical Trigger Verification

The `handle_new_auth_user` trigger is ESSENTIAL for signup to work.

To verify it exists:
1. Go to **Database → Triggers** in Supabase
2. Look for: `on_auth_user_created`
3. If it exists, signup will work
4. If it does NOT exist, signup will fail with "Database error saving new user"

**If trigger is missing:**
- Schema.sql execution failed
- Re-run the last 76 lines of schema.sql (lines 1167-1242)
- Or re-run entire schema.sql

---

## Auth & Signup Flow

### How Signup Works (Complete Flow)

```
1. User fills email + password at /signup
   ↓
2. Client calls supabase.auth.signUp() with metadata
   - metadata contains: organization_id, name
   ↓
3. Supabase Auth creates auth.users row
   ↓
4. PostgreSQL trigger fires: on_auth_user_created
   ↓
5. Trigger runs handle_new_auth_user() function
   - Gets organization_id from auth.users.raw_user_meta_data
   - Creates public.users row (linked to auth.users via id)
   - Creates PERSONAL wallet for user
   ↓
6. User moves to Step 2: Organization details
   - Updates org name, type
   - Updates user name
   - Creates SALARY_POOL, LOAN_POOL wallets
   ↓
7. Director onboarding wizard
   ↓
8. Signup complete → Redirect to /workspace/member
```

### Why Metadata is Critical

The trigger needs `organization_id` to create the user row:

```typescript
// In signup Step 1:
const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      organization_id: tempOrg.id,  // ← THIS IS REQUIRED
      name: email.split("@")[0],
    },
  },
})
```

If `organization_id` is NOT in metadata:
```
Error: "organization_id required in user metadata for signup"
```

---

## Common Errors & Solutions

### ❌ Error 1: "Your project's URL and API key are required"

**Cause**: Environment variables not loaded

**Solution**:
1. Check `.env.local` exists and has all 3 variables
2. Restart dev server: `pnpm dev`
3. In browser console, verify:
   ```javascript
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   // Should NOT be undefined
   ```

### ❌ Error 2: "Database error saving new user"

**Cause**: The `handle_new_auth_user` trigger is missing or failing

**Solution**:
1. Check Supabase dashboard → **Database → Triggers**
2. Look for `on_auth_user_created` trigger
3. If missing:
   - Re-run last section of schema.sql (lines 1167-1242)
4. If trigger exists but still fails:
   - Check the trigger function for errors
   - Go to **Database → Functions**
   - Look for `handle_new_auth_user`
   - Verify it has no syntax errors

**If still failing**, the trigger might be failing silently. Check:
1. Go to **SQL Editor**
2. Run this query:
   ```sql
   SELECT * FROM public.users WHERE email = 'test@example.com';
   ```
3. If no row exists after signup, trigger didn't fire
4. Run query to see trigger errors:
   ```sql
   SELECT * FROM pg_catalog.pg_proc WHERE proname = 'handle_new_auth_user';
   ```

### ❌ Error 3: AuthRetryableFetchError: {}

**Cause**: Network error + empty error object = trigger or database transaction failed

**Solution**:
- This is usually a symptom of Error 2 above
- The signup transaction is rolling back
- Check Supabase logs:
  1. Go to **Database → Query** performance
  2. Look for failed transactions
  3. Check PostgreSQL error logs in Supabase

### ❌ Error 4: "organization_id required in user metadata for signup"

**Cause**: Step 1 of signup didn't create temporary org or didn't pass it in metadata

**Solution**:
1. Check browser console for Step 1 errors
2. Verify that tempOrg was created before auth.signUp() call
3. Ensure metadata is passed:
   ```typescript
   options: {
     data: {
       organization_id: tempOrg.id,  // Must exist
       name: email.split("@")[0],
     },
   }
   ```

### ❌ Error 5: Foreign Key Constraint Violations

**Example**: "insert or update on table \"users\" violates foreign key constraint \"users_organization_id_fkey\""

**Cause**: Organization doesn't exist when creating user

**Solution**:
- Make sure organizations table has the org you're trying to reference
- In Step 1, verify tempOrg was created successfully
- Check Supabase logs for the actual error

### ❌ Error 6: "Relation \"public.users\" does not exist"

**Cause**: schema.sql was never executed

**Solution**:
- Go to Supabase → SQL Editor
- Run entire schema.sql file
- Wait for "Query successful" message
- Check that tables now exist in Database → Tables

---

## Step-by-Step Testing

### Complete Signup Flow Test

Follow these steps exactly:

#### Part 1: Prepare Environment

1. **Start fresh dev server**
   ```bash
   rm -rf .next node_modules/.next
   pnpm dev
   ```
   Wait for "Ready in XXms"

2. **Check env vars loaded**
   ```
   Browser → DevTools Console → Run:
   console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
   # Should print your Supabase URL (not undefined)
   ```

3. **Verify database connected**
   ```
   Browser → Open http://localhost:3000/login
   Page should load (not throw error)
   ```

#### Part 2: Test Signup

1. **Navigate to /signup**
   - Click "Create account" link
   - Should see Step 1 form

2. **Fill Step 1: Account Details**
   ```
   Email: test123@example.com
   Password: TestPassword123!
   Click "Create Account"
   ```

   **What should happen:**
   - Form shows loading spinner
   - No error message
   - Form progresses to Step 2
   - Check browser console: no errors

   **If Step 1 fails:**
   - Check error message in red text
   - If "Database error saving new user": Trigger is missing/broken
   - If "organization_id required": Metadata not passed
   - See [Common Errors](#common-errors--solutions) above

3. **Fill Step 2: Organization Details**
   ```
   Name: John Doe
   Organization Name: My First Organization
   Organization Type: Enterprise
   Click "Create Organization"
   ```

   **What should happen:**
   - Form shows loading spinner
   - After 2-3 seconds, redirects to director wizard
   - No error message

   **If Step 2 fails:**
   - Check for database FK constraint errors
   - Verify org was created in Step 1
   - Check Supabase → Database → Tables → organizations

4. **Complete Director Wizard**
   ```
   Step 1: Create Org Unit
   - Name: Engineering
   - Type: Department
   - Click "Add Unit"

   Step 2: Assign Roles
   - Keep defaults
   - Click "Create Roles"

   Step 3: Review
   - Review all entries
   - Click "Complete Setup"
   ```

   **What should happen:**
   - After wizard, redirects to /workspace/member
   - Dashboard loads with "Welcome back" message
   - No errors

#### Part 3: Verify Data Created

1. **Check users table in Supabase**
   ```
   Supabase → SQL Editor → Run:
   SELECT * FROM public.users WHERE email = 'test123@example.com';
   ```
   Should return 1 row with:
   - id: (UUID from auth.users)
   - email: test123@example.com
   - name: John Doe
   - organization_id: (UUID of org you created)

2. **Check wallets created**
   ```sql
   SELECT * FROM public.wallets WHERE owner_user_id = (
     SELECT id FROM public.users WHERE email = 'test123@example.com'
   );
   ```
   Should return 3 rows:
   - PERSONAL (balance: 0)
   - SALARY_POOL (balance: 0)
   - LOAN_POOL (balance: 0)

3. **Check user roles**
   ```sql
   SELECT ur.*, r.name, r.scope_level
   FROM public.user_roles ur
   JOIN public.roles r ON ur.role_id = r.id
   WHERE ur.user_id = (
     SELECT id FROM public.users WHERE email = 'test123@example.com'
   );
   ```
   Should show:
   - SYSTEM_ADMIN role assigned

#### Part 4: Test Member Workspace

1. **Navigate to /workspace/member**
   - Dashboard should show "Welcome back" message
   - Should see "Monthly Progress" bar
   - Should see empty "Active Nominations" section

2. **Go to /workspace/member/marketplace**
   - Should see list of tasks (if any exist)
   - If empty, that's fine - you can create test tasks via SQL:
   ```sql
   INSERT INTO tasks (
     id, organization_id, title, description, category, status,
     credit_value, deadline
   ) VALUES (
     gen_random_uuid(),
     (SELECT organization_id FROM users WHERE email = 'test123@example.com'),
     'Test Task',
     'This is a test task',
     'STRUCTURED',
     'OPEN',
     10,
     NOW() + INTERVAL '7 days'
   );
   ```

3. **Click on a task**
   - Should see full details
   - Should see "Apply for Task" button
   - Click button to apply

4. **Check /workspace/member/earnings**
   - Should see wallet balances
   - Should see transaction history (empty initially)

---

## Database Schema Summary

### Core Tables (What You MUST understand)

| Table | Purpose | Links To |
|-------|---------|----------|
| **organizations** | Tenant root | org_units, users, tasks, wallets |
| **users** | User profiles | invitations, user_roles, wallets, responsibilities |
| **org_units** | Org structure tree | users (as lead), responsibilities |
| **invitations** | Email invites | users (via accept flow), roles |
| **roles** | Role definitions | user_roles, permissions |
| **user_roles** | User→Role mapping | users, roles |
| **wallets** | Token storage | users, transactions |
| **tasks** | Marketplace tasks | nominations, task_proofs, workflow_log |
| **nominations** | User applications | users, tasks |
| **task_proofs** | Proof submissions | tasks, users |
| **token_transactions** | Ledger | wallets, users |
| **workflow_transition_log** | Audit trail | tasks, loans, users |

### Auth Integration

- **Supabase Auth** creates `auth.users` row
- **PostgreSQL Trigger** `on_auth_user_created` fires
- **Function** `handle_new_auth_user()` creates `public.users` row
- **Result**: User can access workspace with real data

### RLS (Row Level Security)

Every query is automatically scoped to the user's organization by RLS policies:
```sql
-- Example: Users can only see org members
SELECT * FROM users; -- Automatically filtered by organization_id
```

This means:
- ✅ No need to filter organizati on_id in application code
- ✅ Database enforces access control
- ✅ Multi-tenant isolation is automatic

---

## Useful SQL Queries

### Check all orgs created
```sql
SELECT id, name, type, created_at FROM organizations ORDER BY created_at DESC;
```

### Check users in your org
```sql
SELECT id, email, name, created_at FROM users WHERE organization_id = 'YOUR-ORG-ID';
```

### Check wallets
```sql
SELECT u.email, w.purpose, w.balance FROM wallets w
JOIN users u ON w.owner_user_id = u.id
WHERE w.organization_id = 'YOUR-ORG-ID';
```

### Check audit trail
```sql
SELECT entity_type, from_state, to_state, created_at FROM workflow_transition_log
ORDER BY created_at DESC LIMIT 20;
```

### Debug trigger execution
```sql
SELECT prosrc FROM pg_catalog.pg_proc WHERE proname = 'handle_new_auth_user';
-- Shows the function source code
```

---

## Quick Troubleshooting Checklist

Before reporting an error, verify:

- [ ] `.env.local` exists with 3 variables
- [ ] Dev server restarted after adding env vars
- [ ] `NEXT_PUBLIC_SUPABASE_URL` not undefined in console
- [ ] schema.sql executed in Supabase SQL Editor
- [ ] `on_auth_user_created` trigger exists in Supabase
- [ ] Tried clearing `.next` folder and restarting dev
- [ ] Checked Supabase logs for PostgreSQL errors
- [ ] Verified org was created before auth signup
- [ ] Verified metadata contains organization_id

If all above pass but signup still fails, it's likely a database trigger issue. Contact support with:
1. Error message (exact text)
2. Supabase project ID
3. Results of: `SELECT * FROM public.users;` (should have test user rows)
4. Results of trigger check query above

---

## Next Steps After Successful Setup

1. **Create test data** via SQL queries above
2. **Test each workspace**: /workspace/member, /lead, /director, /finance, /config
3. **Review schema.sql** to understand your data model
4. **Read IMPLEMENTATION_SUMMARY.md** for architecture overview
5. **Deploy to Vercel** when ready (see README.md)

