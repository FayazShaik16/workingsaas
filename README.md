# WorkLedger — Meta-Engine Architecture & SaaS Platform

WorkLedger is an enterprise work accountability, non-monetary credit liquidity, and organizational resource planning web platform built with Next.js 15 App Router, Supabase, Tailwind CSS, and PostgreSQL.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Node.js 18+ / 20+
- npm / pnpm / yarn

### 2. Environment Setup
Create a `.env.local` file in the root directory with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
NEXT_PUBLIC_SUPABASE_SECRET_KEY=your-secret-key
NEXT_PUBLIC_SUPABASE_JWKS_URL=https://your-supabase-project.supabase.co/auth/v1/.well-known/jwks.json
```

### 3. Database Setup
1. Run `schema.sql` in your Supabase SQL Editor to set up the canonical schema.
2. Run `db-patch-v2.sql` to apply the latest database updates (Academic domain tables, triggers, and RLS policies).

### 4. Running Locally
Install dependencies and run the Next.js development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🛠 Project Structure

- `app/`: Next.js 15 App Router pages and dynamic `/[orgId]/[role]` workspace layouts.
- `components/`: UI components built with Tailwind CSS, Lucide icons, and Shadcn UI.
- `lib/`: Auth utilities, Supabase client initialization, and session handlers.
- `schema.sql` & `db-patch-v2.sql`: Complete PostgreSQL schema, triggers, RLS policies, and functions.
