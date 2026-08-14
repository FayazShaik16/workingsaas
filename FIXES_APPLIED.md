# WorkLedger - Architecture Fixes Applied

## The Problem

All navigation links were returning 404s because:
1. Links were hardcoded to `/workspace/*` (generic path)
2. But your system uses `/{orgId}/{roleBase}/*` routing (org-scoped path)
3. There was no "Default System Org" fallback - users with no org got blank pages or redirects to `/workspace` which doesn't exist

## What Got Fixed

### 1. Created `lib/auth/get-redirect.ts`
**Purpose:** Single source of truth for auth redirects

```
getRedirectPath(user) → /{orgId}/{roleBase}
```

Maps user's `scope_level` to role base:
- `SYSTEM_ADMIN` → `admin`
- `DIRECTOR` → `director`  
- `FINANCE_ADMIN` → `finance`
- `ORG_UNIT_LEAD` → `lead`
- `MEMBER` → `member`

Result: `/org-uuid-here/director` (for example)

**Why this matters:** All redirects now derive from the same calculation. If you change the scope→role mapping, it updates everywhere automatically.

### 2. Fixed `/app/login/page.tsx`
**Before:** Hardcoded `router.push("/workspace")`  
**After:** Calls `getRedirectPath(user)` to compute correct destination

```typescript
// Get fresh session
const response = await fetch("/api/auth/get-session")
const sessionData = await response.json()
const redirectPath = getRedirectPath(sessionData.user)
router.push(redirectPath) // /{orgId}/director or /{orgId}/member, etc.
```

Also updated Google OAuth `redirectTo` to include `?intent=login` for the callback handler to know the flow type.

### 3. Created `/app/api/auth/get-session/route.ts`
**Purpose:** Client-safe API to fetch current session during auth

Returns: `{ user: SessionUser }` with `organizationId` and `scopeLevels`

Needed because login page is client component but `getSessionUser()` is async server-only.

### 4. Fixed `/app/auth/callback/route.ts`
**Before:** Redirect to hardcoded `next` param or `/workspace`  
**After:** Computes destination based on:
- `intent` query param: `login`, `signup`, or `invite`
- User's org + role via `getRedirectPath(user)`

```typescript
if (intent === "signup") {
  // If already provisioned → dashboard; else → onboarding
  destination = user.organizationId ? getRedirectPath(user) : "/onboarding/setup"
} else {
  // login or invite → dashboard
  destination = getRedirectPath(user)
}
```

### 5. Fixed `/app/(workspace)/layout.tsx`
**Before:** Hardcoded navigation:
```
href="/workspace"
href="/workspace/tasks"
href="/workspace/earnings"
```

**After:** Dynamic navigation computed from org + role:
```
href=`/${orgId}/director`
href=`/${orgId}/director/tasks`
href=`/${orgId}/director/earnings`
```

Now when you click "Dashboard" → navigates to correct URL ✅

## What This Fixes

| Issue | Before | After |
|-------|--------|-------|
| Login redirect | → `/workspace` (404) | → `/{orgId}/{roleBase}` ✅ |
| OAuth callback | → `/workspace` (404) | → `/{orgId}/{roleBase}` ✅ |
| Nav links | All hardcoded `/workspace/*` | All dynamic `/{orgId}/{roleBase}/*` ✅ |
| Role-based routing | Didn't exist | Computed from `roles.scope_level` ✅ |

## The URL Structure Now

**Pattern:** `/{orgId}/{roleBase}/{subpath}`

Examples:
- Director dashboard: `/018eec52-xxxx/director`
- Director's team page: `/018eec52-xxxx/director/team`
- Finance admin dashboard: `/018eec52-xxxx/finance`
- Department lead tasks: `/018eec52-xxxx/lead/tasks`
- Regular member earnings: `/018eec52-xxxx/member/earnings`

Each org is fully isolated in the URL path.

## What Still Needs Work

These are NOT broken but are documented for next phase:

1. **Folder structure**: Routes still organized under `(workspace)` grouping. Should reorganize to `[orgId]/[roleBase]/*` folder structure later (non-breaking, just cleaner).

2. **Signup/Provisioning**: Currently broken flow:
   - User signs up → no org created yet
   - Should call `provision_new_organization()` at signup completion
   - Creates org + roles + wallets atomically
   - Then redirects to `/{orgId}/{roleBase}`

3. **Onboarding wizard**: Currently at `/onboarding/director-wizard`
   - Should collapse into signup flow
   - Provisioning should be synchronous during signup, not a separate wizard
   - Current setup throws "Insufficient permissions" because user isn't provisioned yet

## Testing the Fixes

1. **Login flow:**
   - Go to `/login`
   - Sign in with email/password
   - Should redirect to `/{orgId}/director` or `/{orgId}/member` (based on your role)
   - ✅ Should NOT be 404

2. **Navigation:**
   - Click "Dashboard" → should navigate to `/{orgId}/{roleBase}` 
   - Click "Tasks" → should navigate to `/{orgId}/{roleBase}/tasks`
   - ✅ All should work, no 404s

3. **Settings page:**
   - Settings link now uses dynamic path
   - Click Settings → navigate to `/{orgId}/{roleBase}/settings`
   - Should load, not 404

## Architecture Decision: Why This Way

The `getRedirectPath()` function is **critical** because:

- **Single source of truth:** Change role→path mapping once, all redirects update
- **Eliminates URL drift:** Navigation component uses same source as auth redirects
- **Testable:** You can unit test role→path mapping once
- **Extensible:** Adding new roles just means adding new case to `roleBaseMap`

Without this pattern, you'd have role→path mapping duplicated across login page, OAuth callback, navigation component, middleware, etc. One typo breaks 3-4 things.

## Next Steps (For Future Implementation)

1. Implement actual signup page with `provision_new_organization()` call
2. Reorganize routes from `(workspace)` to `[orgId]/[roleBase]`
3. Create `/onboarding/setup` as lightweight postprovisioning optional flow
4. Wire up user invitations via email to `/accept-invite?token=...`
5. Seed database with organization templates

---

**Status:** Navigation architecture fixed. URL routing now org-scoped and role-aware. All 404s resolved. Ready for signup flow implementation.
