# WorkLedger: B2B Multi-Tenant Architecture & Technical Roadmap

This document outlines the architectural blueprint, state management models, data schemas, security boundaries, and the development roadmap for the WorkLedger platform.

---

## 1. Core Architectural Pillars

WorkLedger is designed as a merit-based resource allocation and labor ledger platform for B2B multi-tenant environments. It enforces organization-level isolation and role-based permissions at every boundary.

### A. Multi-Tenancy Isolation Model (URL & DB Level)
1. **Dynamic URL Namespace (`/[orgId]/[role]`)**:
   - The application routing has been restructured to dynamically capture and isolate tenant contexts.
   - Example paths:
     - `/12e24437-12cc-4dca-85c5-4fdbef37d9a4/member` (Faculty/Member View)
     - `/12e24437-12cc-4dca-85c5-4fdbef37d9a4/lead` (HOD/Department Supervisor View)
     - `/12e24437-12cc-4dca-85c5-4fdbef37d9a4/director` (Institutional Director View)
2. **Database Security (RLS Hardening)**:
   - Supabase Row Level Security (RLS) is applied to all tenant tables (`users`, `tasks`, `wallets`, `token_transactions`, etc.).
   - Rather than relying on easily tampered or missing claims in the client-side JWT token, the backend database dynamically queries the active authenticated session's user mapping to find the correct `organization_id` using a secure `SECURITY DEFINER` SQL function:
     ```sql
     CREATE OR REPLACE FUNCTION public.get_jwt_session_org_id()
     RETURNS uuid AS $$
       SELECT organization_id FROM public.users WHERE id = auth.uid();
     $$ LANGUAGE sql STABLE SECURITY DEFINER;
     ```

### B. Role & Capability Hierarchy
The system maps individual access levels to explicit workspace capabilities:
*   **SYSTEM_ADMIN** (`/config`): Configures global state machine workflows, access control rules, qualifiers, and notification templates.
*   **DIRECTOR** (`/director`): Institutional view; manages organization-wide targets, department budgets, wallets, and user role provisioning.
*   **FINANCE_ADMIN** (`/finance`): Manages the institutional salary pool, loan pools, and manually releases weekly/monthly disbursements.
*   **ORG_UNIT_LEAD** (`/lead`): Supervisors (e.g., HODs); creates, assigns, and approves structured task allocations for their department.
*   **MEMBER** (`/member`): Core work force (e.g., Faculty); browses the marketplace, accepts tasks, completes work, and requests peer reviews.

---

## 2. Component & Database Mappings

```
  [ Frontend Client ]                         [ Database Layer (Postgres) ]
+---------------------+                      +-----------------------------+
| /[orgId]/member     | <==================> | Table: wallets (PERSONAL)   |
|   - Earnings        |                      | Table: token_transactions   |
+---------------------+                      +-----------------------------+
| /[orgId]/lead       | <==================> | Table: tasks (STRUCTURED)   |
|   - Schedule        |                      | Table: org_units            |
+---------------------+                      +-----------------------------+
| /[orgId]/director   | <==================> | Table: users, organizations |
|   - Team Management |                      | Table: user_roles           |
+---------------------+                      +-----------------------------+
```

---

## 3. Implemented Sprint Features

### `LD-19` Department Calendar View (`/[orgId]/lead/schedule`)
Provides supervisors with a unified, clean overview of scheduled lectures, invigilations, and exams assigned within their department. Filters tasks automatically to retain the department scope boundary.

### `LD-20` Bulk Schedule Generator (`/[orgId]/lead/schedule/generate`)
Enables department leads to generate recurring structured tasks for faculty members across multiple weeks in a single form submission. Generates precise calendar sequences with pre-allocated credits.

---

## 4. Immediate Roadmap & Verification Plan

1. **Verify Redirect Routing Flow**:
   - Access `/` while authenticated. Expect immediate redirection to the correct tenant organization base (`/[orgId]/[roleBase]`).
2. **Hardening Database RLS Policies**:
   - Ensure the new `get_jwt_session_org_id()` function has been applied to all tables in Supabase.
3. **Verify Onboarding & Director Wizards**:
   - Create a test account, complete the sign-up setup wizard, and confirm the new organization name is updated correctly without raising RLS permissions issues.
