import { SessionUser } from "./session"

/**
 * Compute post-auth redirect destination from scope_level
 * CRITICAL: This is the single source of truth for role → path mapping
 * All auth redirects and navigation use this function
 */
export function getRedirectPath(user: SessionUser | null): string {
  if (!user) {
    return "/login"
  }

  // No organization = fallback (should only happen if not invited/onboarded)
  if (!user.organizationId) {
    return "/login?error=no_org"
  }

  const orgId = user.organizationId
  const scopeLevels = user.scopeLevels || []

  // Determine primary scope (highest priority)
  const scopePriority: { [key: string]: number } = {
    DIRECTOR: 0,
    SYSTEM_ADMIN: 1,
    FINANCE_ADMIN: 2,
    ORG_UNIT_LEAD: 3,
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
    FINANCE_ADMIN: "finance",
    ORG_UNIT_LEAD: "lead",
    DEPT_ADMIN: "dept-admin",
    MEMBER: "member",
  }

  const roleBase = roleBaseMap[primaryScope] || "member"

  // Return: /{orgId}/{roleBase}
  // Matches app/(workspace)/[orgId]/{roleBase}/page.tsx routes
  return `/${orgId}/${roleBase}`
}

/**
 * Build navigation link for a specific role path
 * Usage: buildNavLink(user, "member", "tasks")
 */
export function buildNavLink(user: SessionUser, roleBase: string, subpath?: string): string {
  if (!user?.organizationId) return "/login"
  const base = `/${user.organizationId}/${roleBase}`
  return subpath ? `${base}/${subpath}` : base
}
