# System Patterns & Contracts

## Technology Choices
- Next.js 15 (App Router)
- Supabase (PostgreSQL & GoTrue Auth)
- Tailwind CSS & Shadcn UI

## Design Guidelines
- Multi-tenancy isolation enforced via URL dynamic route prefix `/[orgId]/`.
- Layout components handle validation/redirects for unauthorized organization access.
- Row Level Security (RLS) helpers must fetch auth user metadata via `security definer` database functions instead of direct JWT claims.
