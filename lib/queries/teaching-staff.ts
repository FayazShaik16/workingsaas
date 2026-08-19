export interface TeachingStaffUser {
  id: string
  name: string
  email: string
  designation?: string | null
  employee_id?: string | null
  org_unit_id?: string | null
  progress_percentage?: number | null
  target_credits?: number | null
  quality_score?: number | null
  status?: string | null
  roles?: {
    id: string
    name: string
    scope_level: string
  }[]
}

/**
 * Checks if a user is classified as teaching staff.
 * A user counts as teaching staff iff they hold the MEMBER scope_level
 * (including HODs who hold both ORG_UNIT_LEAD and MEMBER).
 */
export function isTeachingStaff(user: any): boolean {
  if (!user) return false
  if (Array.isArray(user.user_roles)) {
    return user.user_roles.some((ur: any) => ur.roles?.scope_level === "MEMBER" || ur.role?.scope_level === "MEMBER")
  }
  if (Array.isArray(user.roles)) {
    return user.roles.some((r: any) => r.scope_level === "MEMBER" || r.name === "Faculty" || r.name === "Faculty Member")
  }
  if (user.scope_level === "MEMBER" || user.scopeLevels?.includes?.("MEMBER")) {
    return true
  }
  return false
}

/**
 * Filter an array of users to only teaching staff.
 */
export function filterTeachingStaff<T extends Record<string, any>>(users: T[]): T[] {
  return (users || []).filter((u) => isTeachingStaff(u))
}

/**
 * Canonical query to fetch teaching staff for an organization (and optional department).
 * Enforces scope_level = 'MEMBER', status = 'ACTIVE', deleted_at IS NULL.
 */
export async function getTeachingStaff(
  supabaseClient: any,
  orgId: string,
  orgUnitId?: string
): Promise<TeachingStaffUser[]> {
  let query = supabaseClient
    .from("users")
    .select(`
      id,
      name,
      email,
      designation,
      employee_id,
      org_unit_id,
      progress_percentage,
      target_credits,
      quality_score,
      status,
      user_roles (
        role_id,
        roles (
          id,
          name,
          scope_level
        )
      )
    `)
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)

  if (orgUnitId) {
    query = query.eq("org_unit_id", orgUnitId)
  }

  const { data: users, error } = await query

  if (error) {
    console.error("[getTeachingStaff] query error:", error)
    return []
  }

  return (users || [])
    .filter((u: any) => {
      const roles = (u.user_roles || []).map((ur: any) => ur.roles).filter(Boolean)
      return roles.some((r: any) => r.scope_level === "MEMBER")
    })
    .map((u: any) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      designation: u.designation,
      employee_id: u.employee_id,
      org_unit_id: u.org_unit_id,
      progress_percentage: Number(u.progress_percentage || 0),
      target_credits: u.target_credits !== null && u.target_credits !== undefined ? Number(u.target_credits) : 0,
      quality_score: Number(u.quality_score || 0),
      status: u.status,
      roles: (u.user_roles || []).map((ur: any) => ur.roles).filter(Boolean),
    }))
}
