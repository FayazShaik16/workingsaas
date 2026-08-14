# WorkLedger - Quick Reference Card

## 🚀 Getting Started (5 Minutes)

### Prerequisites
- Node.js 18+ (check: `node --version`)
- pnpm (install: `npm i -g pnpm`)
- Supabase account (create at supabase.com)
- Git (already have it)

### Setup
```bash
# 1. Clone and install
git clone <your-repo>
cd workledger
pnpm install

# 2. Create .env.local (copy from .env.local.example)
cp .env.local.example .env.local
# Edit: Add your Supabase URL + keys

# 3. Execute database schema
# Go to Supabase Dashboard → SQL Editor
# Copy entire schema.sql from your project
# Paste and click RUN
# Wait for "Query successful"

# 4. Start dev server
pnpm dev
# Visit http://localhost:3000
```

### Verify Setup
```bash
# In browser console:
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
# Should print your Supabase URL (not undefined)

# In Supabase Dashboard:
# Database → Triggers → Look for "on_auth_user_created"
# Should exist if schema executed correctly
```

---

## 📚 Documentation

| Document | Purpose | Read Time |
|----------|---------|-----------|
| **SETUP_AND_TROUBLESHOOTING.md** | Environment setup, database config, common errors, testing | 20 min |
| **ARCHITECTURE_AND_BUILD_SUMMARY.md** | Full system design, database schema, features | 30 min |
| **README.md** | Project overview, features, quick start | 10 min |
| **This file** | Quick reference, common tasks | 5 min |

---

## 🔧 Common Commands

```bash
# Start development
pnpm dev

# Build for production
pnpm build

# Run production build locally
pnpm build && pnpm start

# Type check
pnpm tsc --noEmit

# Format code
pnpm format

# Check for errors
pnpm lint
```

---

## 🗂️ Project Structure

```
app/
├── auth/              # Login, signup, callbacks
├── onboarding/        # Director wizard
└── (workspace)/       # Protected shell with role-based nav
    ├── /workspace     # Role switcher
    ├── /member        # Member dashboard & marketplace
    ├── /lead          # Lead verification queue
    ├── /director      # Organization dashboard
    ├── /finance       # Wallet management
    └── /config        # System configuration

components/
├── ui/                # 21 shadcn/ui base components
├── shell/             # Layout & navigation (8 components)
├── shared/            # DataTable, dialogs, status pills (5 components)
└── [domain]/          # Feature-specific components

lib/
├── supabase/          # Supabase client setup
├── auth/              # Auth helpers (session, scope checks)
├── rpc/               # PostgreSQL RPC functions
└── utils.ts           # Utilities (cn, formatNumber, etc)

schema.sql            # Complete database schema (50+ tables)
```

---

## 🔑 Key Files

| File | Purpose |
|------|---------|
| `schema.sql` | All 50+ tables, RLS policies, triggers, functions |
| `app/signup/page.tsx` | 2-step signup flow |
| `app/(workspace)/layout.tsx` | Protected shell with role-based access |
| `app/(workspace)/member/page.tsx` | Member dashboard |
| `lib/auth/session.ts` | Get current user session |
| `lib/auth/protect.ts` | Route guards (requireAuth, requireScope) |
| `.env.local.example` | Environment variable template |

---

## 🎯 Signup Flow (What Happens)

### Step 1: Email & Password
```
User fills email + password
↓
App creates temporary organization
↓
App calls supabase.auth.signUp() with organization_id in metadata
↓
PostgreSQL TRIGGER fires: on_auth_user_created
↓
Trigger creates public.users row + PERSONAL wallet
↓
Form progresses to Step 2
```

### Step 2: Organization Details
```
User fills name + org name + org type
↓
App updates organization (name, type)
↓
App updates user (name)
↓
App creates SALARY_POOL + LOAN_POOL wallets
↓
App creates SYSTEM_ADMIN role + assigns to user
↓
Redirect to director wizard
```

### Step 3: Director Wizard
```
User creates org_units (company structure)
↓
User creates roles (DIRECTOR, LEAD, MEMBER)
↓
User assigns roles to self
↓
Redirect to /workspace/member (dashboard)
```

---

## 🔍 Debugging

### Issue: Signup fails with "Database error saving new user"

**Check 1**: Trigger exists?
```bash
# Supabase Dashboard → Database → Triggers
# Look for: "on_auth_user_created"
```

**Check 2**: Environment variables loaded?
```javascript
// Browser console
console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)
// Should NOT be undefined
```

**Check 3**: Schema executed?
```bash
# Supabase Dashboard → Database → Tables
# Should see: organizations, users, wallets, tasks, etc
```

**Check 4**: User row exists?
```sql
-- Supabase SQL Editor
SELECT * FROM public.users WHERE email = 'test@example.com';
-- Should return 1 row if trigger worked
```

### More Issues?
See **SETUP_AND_TROUBLESHOOTING.md** section: "Common Errors & Solutions"

---

## 🚢 Deployment

### To Vercel

```bash
# 1. Connect GitHub to Vercel
# https://vercel.com/new

# 2. Add environment variables in Vercel project settings
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# 3. Deploy
git push origin main
# Vercel auto-deploys on push
```

### To Production

1. Set up Supabase project (prod environment)
2. Execute schema.sql in production database
3. Update environment variables to production keys
4. Deploy to Vercel or self-hosted

---

## 📊 Database Tables (Quick Reference)

**Core Tables**:
- `organizations` - Tenants
- `users` - User profiles
- `org_units` - Org structure
- `wallets` - Token storage
- `token_transactions` - Ledger
- `tasks` - Task marketplace
- `nominations` - Task applications
- `task_proofs` - Proof submissions
- `workflow_transition_log` - Audit trail
- `invitations` - Email invites
- `roles`, `user_roles` - RBAC

**Configuration Tables** (edit in /config):
- `workflow_definitions` - State machines
- `business_rules` - Auto actions
- `access_control_rules` - Permissions
- `reference_qualifiers` - Enum mappings
- `notification_definitions` - Alert templates
- `report_definitions` - Report specs

---

## 🔐 Authentication

### How It Works
```
1. User signs up at /signup
   ↓
2. Supabase Auth creates auth.users row
   ↓
3. PostgreSQL trigger creates public.users + wallet
   ↓
4. Middleware refresh session on every request
   ↓
5. Routes check session + scope with requireAuth() + requireScope()
```

### Session Access in Code
```typescript
// In Server Components or Server Actions
import { getSessionUser } from "@/lib/auth/session"

const user = await getSessionUser()
console.log(user.id, user.email, user.organization_id)
```

### Route Protection
```typescript
// In layout.tsx or page.tsx
import { requireAuth, requireScope } from "@/lib/auth/protect"

// Check user is authenticated
const user = await requireAuth()

// Check user has scope
await requireScope("DIRECTOR")  // e.g., at /director
```

---

## 🎨 UI Components

All from shadcn/ui (21 components):
- `Button`, `Input`, `Label`, `Card`
- `Dialog`, `Sheet`, `Popover`, `Dropdown`
- `Table`, `Select`, `Tabs`, `Checkbox`
- `Progress`, `Avatar`, `Badge`, `Skeleton`
- And more...

**Styling**: Tailwind CSS v4 (CSS variables for theming)

---

## 📈 Monitoring & Logs

### Local Development
```bash
# Terminal: pnpm dev
# Shows build errors, warnings
# Check browser console (F12) for runtime errors
```

### Production
- **Supabase Dashboard** → Logs (database errors)
- **Vercel Dashboard** → Deployments (build errors)
- **Sentry** (optional, for error tracking)

---

## 🚨 Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `Your project's URL and API key are required` | Env vars not loaded | Restart dev server |
| `Database error saving new user` | Trigger missing | Re-run schema.sql |
| `organization_id required in user metadata` | Metadata not passed | Check signup code |
| `Relation "public.users" does not exist` | Schema not executed | Run schema.sql |
| Foreign key violations | Org doesn't exist | Create org first |

---

## 🎓 Learning Path

1. **10 min**: Read README.md (overview)
2. **20 min**: Read SETUP_AND_TROUBLESHOOTING.md (setup)
3. **5 min**: Test signup at http://localhost:3000/signup
4. **30 min**: Read ARCHITECTURE_AND_BUILD_SUMMARY.md (deep dive)
5. **Read code**: app/signup/page.tsx, lib/auth/, components/
6. **Build**: Add your first feature using existing patterns

---

## 🤝 Contributing

### Code Style
- TypeScript (strict mode)
- Tailwind CSS utilities
- shadcn/ui components
- Server Components where possible
- Consistent naming (kebab-case for files, camelCase for vars)

### Making Changes
1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes
3. Test locally: `pnpm dev`
4. Commit: `git commit -m "Description"`
5. Push: `git push origin feature/my-feature`
6. Open PR

---

## 📞 Support

### Documentation
- **SETUP_AND_TROUBLESHOOTING.md** - Setup help
- **ARCHITECTURE_AND_BUILD_SUMMARY.md** - System design
- **README.md** - Project overview

### Supabase Logs
- Dashboard → SQL Editor → Check recent queries
- Dashboard → Logs → PostgreSQL errors

### Code Questions
- Check similar components/pages for patterns
- Read schema.sql for data structure
- Check lib/auth/ for auth patterns

---

## 🎯 Next Steps

### Immediate
1. Execute schema.sql in Supabase
2. Test signup flow
3. Read documentation

### Short Term
4. Create test org and members
5. Test task workflow
6. Explore each workspace

### Longer Term
7. Deploy to Vercel
8. Invite real users
9. Extend with your features

---

## 📋 Checklist for Production

- [ ] schema.sql executed in Supabase
- [ ] on_auth_user_created trigger exists
- [ ] All 50+ tables created
- [ ] RLS policies enabled
- [ ] Environment variables set
- [ ] Test signup flow works
- [ ] pnpm build succeeds
- [ ] pnpm tsc passes (no TS errors)
- [ ] GitHub connected to Vercel
- [ ] Deployed to production

---

**Status**: Production-Ready  
**Last Updated**: January 2025  
**Version**: 1.0.0

Start here → **pnpm dev** → http://localhost:3000

