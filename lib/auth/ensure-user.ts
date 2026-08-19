import { createAdminClient } from "@/lib/supabase/admin"
import { SessionUser } from "./session"
import type { User as AuthUser } from "@supabase/supabase-js"

/**
 * Ensures a user record exists in public.users, organizations, and user_roles
 * even if the Postgres database trigger did not execute (e.g. for Google OAuth or direct signups).
 */
export async function ensureUserRecord(authUser: AuthUser): Promise<SessionUser | null> {
  const admin = createAdminClient()
  const email = authUser.email || ""
  const name =
    authUser.user_metadata?.name ||
    authUser.user_metadata?.full_name ||
    email.split("@")[0] ||
    "User"

  try {
    // 1. Check for an active pending invitation first (Priority)
    const { data: invite } = await (admin as any)
      .from("invitations")
      .select("*, roles(id, name, scope_level)")
      .eq("email", email)
      .eq("status", "PENDING")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    // 2. Fetch existing public.users record
    const { data: existingUser } = await (admin as any)
      .from("users")
      .select(`
        id,
        email,
        name,
        organization_id,
        org_unit_id,
        user_roles(
          role_id,
          roles(
            id,
            name,
            scope_level
          )
        )
      `)
      .eq("id", authUser.id)
      .maybeSingle()

    // If there is an active pending invitation for this user, fulfill it immediately
    if (invite) {
      const orgId = invite.organization_id
      const unitId = invite.org_unit_id || null
      const roleId = invite.intended_role_id || null
      let scopeLevel = invite.roles?.scope_level || "MEMBER"

      // Upsert user into the invited organization
      await (admin as any).from("users").upsert({
        id: authUser.id,
        organization_id: orgId,
        org_unit_id: unitId,
        email,
        name,
        status: "ACTIVE",
        employment_type: "FULL_TIME",
      })

      if (roleId) {
        await (admin as any).from("user_roles").upsert(
          { user_id: authUser.id, role_id: roleId },
          { onConflict: "user_id,role_id" }
        )
        const { data: roleData } = await (admin as any)
          .from("roles")
          .select("scope_level")
          .eq("id", roleId)
          .single()
        if (roleData?.scope_level) scopeLevel = roleData.scope_level
      }

      await (admin as any).from("wallets").upsert(
        {
          organization_id: orgId,
          owner_user_id: authUser.id,
          purpose: "PERSONAL",
          balance: 0,
        },
        { onConflict: "owner_user_id,purpose" }
      )

      await (admin as any).from("invitations").update({ status: "ACCEPTED" }).eq("id", invite.id)

      return {
        id: authUser.id,
        email,
        name,
        organizationId: orgId,
        orgUnitId: unitId || undefined,
        roles: roleId ? [roleId] : [],
        scopeLevels: [scopeLevel],
      }
    }

    // If existing user already has organization and roles, return them
    if (existingUser && existingUser.organization_id) {
      let roles = (existingUser.user_roles as any[])?.map((ur: any) => ur.roles?.id).filter(Boolean) || []
      let scopeLevels = (existingUser.user_roles as any[])?.map((ur: any) => ur.roles?.scope_level).filter(Boolean) || []

      // If user is in an org but has no roles in user_roles, auto-assign their role
      if (scopeLevels.length === 0) {
        const { data: orgRoles } = await (admin as any)
          .from("roles")
          .select("id, scope_level")
          .eq("organization_id", existingUser.organization_id)

        let targetRole = orgRoles?.find((r: any) => r.scope_level === "DIRECTOR") || orgRoles?.[0]
        if (!targetRole) {
          const { data: newRole } = await (admin as any)
            .from("roles")
            .insert({
              organization_id: existingUser.organization_id,
              name: "Director",
              scope_level: "DIRECTOR",
              is_system_role: true,
            })
            .select("id, scope_level")
            .single()
          targetRole = newRole
        }

        if (targetRole) {
          await (admin as any).from("user_roles").upsert(
            { user_id: authUser.id, role_id: targetRole.id },
            { onConflict: "user_id,role_id" }
          )
          roles = [targetRole.id]
          scopeLevels = [targetRole.scope_level || "DIRECTOR"]
        }
      }

      return {
        id: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        organizationId: existingUser.organization_id,
        orgUnitId: existingUser.org_unit_id,
        roles,
        scopeLevels,
      }
    }

    // New self-signup / Direct signup (No prior invitation and no existing user)
    let orgId: string

    // 1. Create organization
    const { data: newOrg, error: orgErr } = await (admin as any)
      .from("organizations")
      .insert({
        name: `${name}'s Organization`,
        type: "GENERIC",
      })
      .select("id")
      .single()

    if (orgErr || !newOrg) {
      console.error("[ensureUserRecord] Failed to create organization:", orgErr)
      return null
    }
    orgId = newOrg.id

    // 2. Create root organization unit
    await (admin as any)
      .from("org_units")
      .insert({
        organization_id: orgId,
        name: "Main",
        unit_type: "DEPARTMENT",
      })

    // 3. Upsert user into public.users with org_unit_id = null (Operator identity)
    await (admin as any).from("users").upsert({
      id: authUser.id,
      organization_id: orgId,
      org_unit_id: null,
      email,
      name,
      status: "ACTIVE",
      employment_type: "FULL_TIME",
    })

    // 4. Seed standard deduplicated roles for the organization
    const standardRoles = [
      { name: "System Administrator", scope_level: "SYSTEM_ADMIN", is_system_role: true },
      { name: "Director", scope_level: "DIRECTOR", is_system_role: true },
      { name: "Head of Department", scope_level: "ORG_UNIT_LEAD", is_system_role: true },
      { name: "Department Administrator", scope_level: "DEPT_ADMIN", is_system_role: true },
      { name: "Finance Administrator", scope_level: "FINANCE_ADMIN", is_system_role: true },
      { name: "Faculty / Member", scope_level: "MEMBER", is_system_role: true },
    ]

    const { data: seededRoles } = await (admin as any)
      .from("roles")
      .upsert(
        standardRoles.map((r) => ({
          organization_id: orgId,
          ...r,
        })),
        { onConflict: "organization_id,scope_level,name" }
      )
      .select("id, scope_level")

    const sysAdminRole = (seededRoles || []).find((r: any) => r.scope_level === "SYSTEM_ADMIN")
    const roleId = sysAdminRole?.id || null
    const scopeLevel = "SYSTEM_ADMIN"

    if (roleId) {
      await (admin as any).from("user_roles").upsert(
        { user_id: authUser.id, role_id: roleId },
        { onConflict: "user_id,role_id" }
      )
    }

    // 5. Create Org-Level Singleton Wallets (SALARY_POOL & LOAN_POOL)
    await (admin as any).from("wallets").upsert(
      [
        {
          organization_id: orgId,
          owner_user_id: null,
          purpose: "SALARY_POOL",
          balance: 0,
        },
        {
          organization_id: orgId,
          owner_user_id: null,
          purpose: "LOAN_POOL",
          balance: 0,
        },
      ],
      { onConflict: "organization_id,purpose" }
    )

    return {
      id: authUser.id,
      email,
      name,
      organizationId: orgId,
      orgUnitId: undefined,
      roles: roleId ? [roleId] : [],
      scopeLevels: [scopeLevel],
    }
  } catch (error) {
    console.error("[ensureUserRecord] Failed to ensure user record:", error)
    return null
  }
}
