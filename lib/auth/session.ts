import { createClient } from "@/lib/supabase/server"
import { ensureUserRecord } from "./ensure-user"
import { cache } from "react"

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
 * Memoized per request via React cache()
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
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
      .maybeSingle()

    const userData = user as any
    if (userError || !userData || !userData.organization_id) {
      // If user exists in Auth but is missing or incomplete in public.users, auto-heal
      return await ensureUserRecord(authData.user)
    }

    const roles = (userData.user_roles as any[])?.map((ur: any) => ur.roles?.id).filter(Boolean) || []
    const scopeLevels = (userData.user_roles as any[])?.map((ur: any) => ur.roles?.scope_level).filter(Boolean) || []

    return {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      organizationId: userData.organization_id,
      orgUnitId: userData.org_unit_id,
      roles,
      scopeLevels,
    }
  } catch (error) {
    console.error("[session] getSessionUser failed:", error)
    return null
  }
})

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

    const userData = user as any
    const scopeLevels = (userData.user_roles as any[])?.map((ur: any) => ur.roles?.scope_level).filter(Boolean) || []

    // SYSTEM_ADMIN / DIRECTOR can see all
    if (scopeLevels.includes("SYSTEM_ADMIN") || scopeLevels.includes("DIRECTOR")) {
      const { data: units } = await supabase
        .from("org_units")
        .select("*")
        .eq("organization_id", organizationId)

      return units || []
    }

    // ORG_UNIT_LEAD can see own unit + children
    if (scopeLevels.includes("ORG_UNIT_LEAD") && userData.org_unit_id) {
      const { data: units } = await supabase
        .from("org_units")
        .select("*")
        .eq("organization_id", organizationId)
        .or(`id.eq.${userData.org_unit_id},parent_id.eq.${userData.org_unit_id}`)

      return units || []
    }

    // MEMBER can see own unit only
    if (userData.org_unit_id) {
      const { data: units } = await supabase
        .from("org_units")
        .select("*")
        .eq("id", userData.org_unit_id)

      return units || []
    }

    return []
  } catch (error) {
    console.error("[session] getScopeVisibleOrgUnits failed:", error)
    return []
  }
}
