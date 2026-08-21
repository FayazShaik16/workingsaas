import { SessionUser } from "./session"

/**
 * Compute post-auth redirect destination from scope_level
 * Single source of truth for role → path mapping
 */
export function getRedirectPath(user: SessionUser | null): string {
  if (!user) {
    return "/login"
  }

  if (!user.organizationId) {
    return "/login?error=no_org"
  }

  const orgId = user.organizationId
  const scopeLevels = user.scopeLevels || []

  // Determine primary scope
  const scopePriority: { [key: string]: number } = {
    SYSTEM_ADMIN: 0,
    DIRECTOR: 1,
    ORG_UNIT_LEAD: 2,
    FINANCE_ADMIN: 3,
    DEPT_ADMIN: 4,
    MEMBER: 5,
  }

  const primaryScope = scopeLevels.sort(
    (a, b) => (scopePriority[a] ?? 999) - (scopePriority[b] ?? 999)
  )[0]

  // Map scope to role base path
  const roleBaseMap: { [key: string]: string } = {
    SYSTEM_ADMIN: "config",
    DIRECTOR: "director",
    ORG_UNIT_LEAD: "lead",
    FINANCE_ADMIN: "finance",
    DEPT_ADMIN: "dept-admin",
    MEMBER: "member",
  }

  const roleBase = roleBaseMap[primaryScope] || "member"

  return `/${orgId}/${roleBase}`
}

/**
 * Build navigation link for a specific role path
 */
export function buildNavLink(user: SessionUser, roleBase: string, subpath?: string): string {
  if (!user?.organizationId) return "/login"
  const base = `/${user.organizationId}/${roleBase}`
  return subpath ? `${base}/${subpath}` : base
}
