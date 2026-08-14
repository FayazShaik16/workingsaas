# WorkLedger Quick Start Guide

## Prerequisites
- Node.js 18+ with pnpm installed
- Supabase project (free tier at supabase.com)
- Google OAuth app credentials (optional, for Google login)

## Setup in 5 Minutes

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Create `.env.local` with Supabase Credentials
```bash
cp .env.local.example .env.local
```

Then edit `.env.local` with your Supabase project details:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

To find these values:
1. Log into your Supabase project dashboard
2. Go to Settings → API
3. Copy the URL and keys into `.env.local`

### 3. Set Up Database Schema
1. In Supabase dashboard, go to SQL Editor
2. Create a new query and copy the entire contents of `schema.sql`
3. Execute the query
4. Wait for all tables, enums, and RLS policies to be created

### 4. Generate TypeScript Types (Optional but Recommended)
```bash
pnpm exec supabase gen types typescript --project-id your-project-ref --schema public > lib/database.types.ts
```

### 5. Start Development Server
```bash
pnpm dev
```

The app will start at `http://localhost:3000`

---

## Testing the Full Flow

### Flow 1: New Organization Sign-Up
1. Navigate to `http://localhost:3000/login`
2. Click "Create account"
3. Fill in email, password, and full name
4. Select your organization type (College, Corporate, Government, NGO, or Hospital)
5. You'll be directed to the director wizard to set up your org structure
6. After wizard completes, you'll land on the dashboard

### Flow 2: Member Tasks & Marketplace
1. From dashboard, navigate to `/workspace/member/marketplace`
2. Browse available tasks (if any exist in your database)
3. Click on a task to view details
4. Click "Apply for Task" to nominate yourself
5. Go to `/workspace/member/tasks` to see your nominations
6. Go to `/workspace/member/earnings` to view your credit ledger

### Flow 3: Sign Out
1. On any workspace page, click Settings in the sidebar
2. Scroll to Session section
3. Click "Sign Out" button

---

## Project Structure at a Glance

```
workledger/
├── app/                           # Next.js app directory
│   ├── (workspace)/               # Protected workspace layout
│   │   ├── layout.tsx             # Master workspace layout with shell
│   │   ├── page.tsx               # Dashboard
│   │   ├── member/                # Member workspace pages
│   │   ├── settings/
│   │   └── ...
│   ├── login/                     # Auth pages
│   ├── signup/
│   ├── accept-invite/
│   ├── onboarding/
│   ├── api/                       # Backend API routes
│   ├── layout.tsx                 # Root layout
│   └── globals.css                # Tailwind + design tokens
├── components/
│   ├── ui/                        # shadcn/ui base components
│   ├── shell/                     # Shell components (header, sidebar, etc)
│   ├── shared/                    # Shared domain primitives
│   └── onboarding/                # Onboarding components
├── lib/
│   ├── supabase/                  # Supabase client setup
│   ├── auth/                      # Auth utilities
│   ├── rpc/                       # RPC function wrappers
│   └── database.types.ts          # Generated TypeScript types
├── schema.sql                     # Complete database schema
├── middleware.ts                  # Session refresh on every request
├── IMPLEMENTATION_SUMMARY.md      # Complete architecture guide
└── QUICK_START.md                 # This file
```

---

## Key Pages & Routes

### Public Routes (No Auth Required)
- `GET /login` - Sign in page
- `GET /signup` - Create new account
- `GET /accept-invite?token=...` - Accept invitation

### Protected Routes (Auth Required)
- `GET /workspace` - Main dashboard
- `GET /workspace/settings` - Account settings
- `GET /workspace/member` - Member dashboard
- `GET /workspace/member/marketplace` - Browse tasks
- `GET /workspace/member/marketplace/[taskId]` - Task detail
- `GET /workspace/member/tasks` - My accepted tasks
- `GET /workspace/member/earnings` - Credit ledger

### API Routes
- `POST /api/auth/callback` - OAuth callback handler
- `POST /api/auth/logout` - Sign out
- `POST /api/auth/accept-invite` - Accept invitation with new user
- `POST /api/onboarding/director-setup` - Save org structure from wizard

---

## Authentication Flow

### Email/Password Sign-In
1. User enters email + password
2. Supabase auth validates credentials
3. Session cookie created
4. Redirects to `/workspace`

### Google OAuth Sign-In
1. User clicks "Sign in with Google"
2. Redirects to Google consent screen
3. Google redirects to `/api/auth/callback`
4. Supabase creates/links user
5. Session created and redirected to `/workspace`

### Email Invitation
1. Admin creates invitation in database
2. Invitee receives email with `/accept-invite?token=...` link
3. User fills name + password
4. User + role created automatically
5. Redirects to `/workspace`

---

## Common Tasks

### Add a New Task to Marketplace
Insert into `tasks` table:
```sql
INSERT INTO tasks (
  organization_id,
  title,
  description,
  credit_value,
  deadline,
  status,
  verification_mode
) VALUES (
  'org-id',
  'Finish Project Report',
  'Complete quarterly project report...',
  100,
  NOW() + INTERVAL '7 days',
  'OPEN',
  'peer_review'
);
```

### Invite a New User
Insert into `invitations` table:
```sql
INSERT INTO invitations (
  organization_id,
  email,
  invited_by,
  org_unit_id,
  assigned_scope_level
) VALUES (
  'org-id',
  'newuser@example.com',
  'current-user-id',
  'org-unit-id',
  'MEMBER'
);
```

### Create a Nomination (User applies for task)
Insert into `nominations` table:
```sql
INSERT INTO nominations (
  task_id,
  user_id,
  nominated_message
) VALUES (
  'task-id',
  'user-id',
  'I can complete this task by Friday'
);
```

---

## Troubleshooting

### "Supabase credentials required"
- Check `.env.local` exists and has all three keys
- Verify keys are copied correctly (no extra spaces)
- Restart dev server: `pnpm dev`

### "Module not found" errors
- Run `pnpm install` again
- Delete `node_modules` and `.pnpm-lock.yaml`, then `pnpm install`
- Check that all imports match actual file locations

### Build fails with TypeScript errors
- Run `pnpm build` to see full error list
- Common: Missing type definitions — run `pnpm exec supabase gen types`
- Check `.env.local` is set before building

### Styleing issues
- Check `app/globals.css` is imported in root layout
- Verify Tailwind config (tailwind.config.js or CSS `@theme`)
- Clear `.next` folder: `rm -rf .next && pnpm dev`

---

## Development Workflow

### Making Changes
1. Edit files in `app/`, `components/`, or `lib/`
2. Dev server hot-reloads automatically
3. Check browser console for errors
4. Test with TypeScript: `pnpm build`

### Adding a New Component
1. Create file in `components/` with PascalCase name
2. Import shadcn base components from `@/components/ui/*`
3. Use TypeScript for props typing
4. Example:
```tsx
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export function MyComponent({ title }: { title: string }) {
  return (
    <Card>
      <h2>{title}</h2>
      <Button>Click me</Button>
    </Card>
  )
}
```

### Adding a New Route
1. Create folder under `app/`
2. Add `page.tsx` for the route
3. Add `layout.tsx` if needed (for shared layout)
4. Routes are file-system based (Next.js App Router)

---

## Phase Completion Status

✅ Phase 0: Scaffold  
✅ Phase 1: shadcn/ui Foundation (21 components)  
✅ Phase 2: Supabase SSR Wiring  
✅ Phase 3: Schema Comprehension  
✅ Phase 4: Shell Foundation (8 components)  
✅ Phase 5: Shared Primitives (5 components)  
✅ Phase 6: Auth & Onboarding (complete)  
✅ Phase 7: Member Workspace (complete vertical slice)  

⏳ Phase 8: Lead, Director, Finance, Config workspaces (next)

---

## Next Steps

After exploring the current implementation:

1. **Connect to Real Supabase**
   - Create Supabase account at supabase.com
   - Follow setup steps above with real credentials

2. **Configure Google OAuth** (optional)
   - Create OAuth app at Google Cloud Console
   - Add credentials to Supabase auth settings
   - Update app to use your Google OAuth app ID

3. **Deploy to Vercel** (optional)
   - Push to GitHub
   - Create Vercel project
   - Add `.env.local` secrets in Vercel dashboard
   - Deploy with one click

4. **Continue Building Phase 8**
   - Lead verification queue
   - Director team management
   - Finance wallet management
   - Config workflow engine

---

## Support & Documentation

- **Full Architecture**: See `IMPLEMENTATION_SUMMARY.md`
- **Database Schema**: See `schema.sql`
- **Next.js Docs**: https://nextjs.org/docs
- **Supabase Docs**: https://supabase.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com

---

Happy building! 🚀
