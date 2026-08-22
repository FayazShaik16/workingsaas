import { SessionUser } from "@/lib/auth/session"

export class AuthorizationError extends Error {
  statusCode: number
  constructor(message: string, statusCode = 403) {
    super(message)
    this.name = "AuthorizationError"
    this.statusCode = statusCode
  }
}

/**
 * Enforces multi-tenant organization boundaries and department-level isolation.
 *
 * @param actor Authenticated user object from requireAuth() / getSessionUser()
 * @param targetOrgUnitId Department / Org Unit ID being accessed or mutated
 * @param permittedRoles Roles permitted to access the target (e.g. ['ORG_UNIT_LEAD', 'DIRECTOR', 'SYSTEM_ADMIN'])
 */
export function assertDepartmentScope(
  actor: SessionUser,
  targetOrgUnitId: string | null | undefined,
  permittedRoles: string[] = ["ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN"]
): void {
  // 1. Check if actor has at least one permitted role
  const hasRole = actor.scopeLevels.some((role: string) => permittedRoles.includes(role))
  if (!hasRole) {
    throw new AuthorizationError(
      `Access denied: You do not have the required role (${permittedRoles.join(", ")}) to perform this action.`,
      403
    )
  }

  // 2. System Admins and Directors have organization-wide authority
  const isOrgWide =
    actor.scopeLevels.includes("DIRECTOR") || actor.scopeLevels.includes("SYSTEM_ADMIN")
  if (isOrgWide) {
    return
  }

  // 3. Department Leads (HOD) and Dept Admins MUST match target org unit
  if (!actor.orgUnitId) {
    throw new AuthorizationError(
      "Access denied: Your account is not assigned to a department.",
      403
    )
  }

  if (targetOrgUnitId && actor.orgUnitId !== targetOrgUnitId) {
    throw new AuthorizationError(
      "Access denied: Department isolation prevents accessing or modifying items in another department.",
      403
    )
  }
}
