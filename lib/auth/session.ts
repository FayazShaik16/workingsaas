import { createClient } from "@/lib/supabase/server"

export interface SessionUser {
  id: string
  email: string
  name: string
  organizationId: string
  orgUnitId?: string
  roles: string[]
  scopeLevels: string[]
}

/**
 * Get current session with organization & role context
 * Safe to call from Server Components
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient()

  try {
    // Get auth user
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) return null

    // Get user record with org/role context
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(
        `
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
      `
      )
      .eq("id", authData.user.id)
      .single()

    if (userError || !user) return null

    const roles = (user.user_roles as any[])?.map((ur: any) => ur.roles?.id).filter(Boolean) || []
    const scopeLevels = (user.user_roles as any[])?.map((ur: any) => ur.roles?.scope_level).filter(Boolean) || []

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      organizationId: user.organization_id,
      orgUnitId: user.org_unit_id,
      roles,
      scopeLevels,
    }
  } catch (error) {
    console.error("[session] getSessionUser failed:", error)
    return null
  }
}

/**
 * Check if user has a specific scope level
 */
export function hasScope(scopeLevels: string[], requiredScope: string): boolean {
  return scopeLevels.includes(requiredScope)
}

/**
 * Get all scope-visible org_units for user
 * (Users can see their own unit + children if they're a LEAD)
 */
export async function getScopeVisibleOrgUnits(
  userId: string,
  organizationId: string
): Promise<any[]> {
  const supabase = await createClient()

  try {
    // Get user's org_unit and role scope
    const { data: user, error: userError } = await supabase
      .from("users")
      .select(
        `
        org_unit_id,
        user_roles(
          roles(scope_level)
        )
      `
      )
      .eq("id", userId)
      .single()

    if (userError || !user) return []

    const scopeLevels = (user.user_roles as any[])?.map((ur: any) => ur.roles?.scope_level).filter(Boolean) || []

    // SYSTEM_ADMIN / DIRECTOR can see all
    if (scopeLevels.includes("SYSTEM_ADMIN") || scopeLevels.includes("DIRECTOR")) {
      const { data: units } = await supabase
        .from("org_units")
        .select("*")
        .eq("organization_id", organizationId)

      return units || []
    }

    // ORG_UNIT_LEAD can see own unit + children
    if (scopeLevels.includes("ORG_UNIT_LEAD") && user.org_unit_id) {
      const { data: units } = await supabase
        .from("org_units")
        .select("*")
        .eq("organization_id", organizationId)
        .or(`id.eq.${user.org_unit_id},parent_id.eq.${user.org_unit_id}`)

      return units || []
    }

    // MEMBER can see own unit only
    if (user.org_unit_id) {
      const { data: units } = await supabase
        .from("org_units")
        .select("*")
        .eq("id", user.org_unit_id)

      return units || []
    }

    return []
  } catch (error) {
    console.error("[session] getScopeVisibleOrgUnits failed:", error)
    return []
  }
}
