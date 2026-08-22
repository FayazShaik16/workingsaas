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
 * @param permittedRoles Roles permitted to access the target
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

/**
 * Enforces task-level visibility and lifecycle authorization.
 */
export function assertTaskAccess(
  actor: SessionUser,
  task: {
    organization_id: string
    org_unit_id?: string | null
    visibility_scope?: string
    assigned_to_id?: string | null
    task_target_org_units?: Array<{ org_unit_id: string }>
  },
  action: "VIEW" | "NOMINATE" | "SUBMIT_PROOF" | "APPROVE" | "ASSIGN"
): void {
  // 1. Organization boundary
  if (task.organization_id !== actor.organizationId) {
    throw new AuthorizationError("Access denied: Cross-organization task access is prohibited.", 403)
  }

  const isDirectorOrAdmin =
    actor.scopeLevels.includes("DIRECTOR") || actor.scopeLevels.includes("SYSTEM_ADMIN")

  if (isDirectorOrAdmin) {
    return
  }

  // 2. Action: APPROVE / ASSIGN (requires HOD of that department)
  if (action === "APPROVE" || action === "ASSIGN") {
    const isHOD = actor.scopeLevels.includes("ORG_UNIT_LEAD")
    if (!isHOD || !actor.orgUnitId || (task.org_unit_id && actor.orgUnitId !== task.org_unit_id)) {
      throw new AuthorizationError("Access denied: Only the department HOD or Director can perform this action.", 403)
    }
    return
  }

  // 3. Action: SUBMIT_PROOF (requires assigned faculty member)
  if (action === "SUBMIT_PROOF") {
    if (task.assigned_to_id && task.assigned_to_id !== actor.id) {
      throw new AuthorizationError("Access denied: You are not the assigned faculty member for this task.", 403)
    }
  }

  // 4. Action: VIEW / NOMINATE (department isolation)
  if (task.visibility_scope === "ORG_UNIT" && task.org_unit_id) {
    if (actor.orgUnitId !== task.org_unit_id) {
      throw new AuthorizationError("Access denied: This task is restricted to members of another department.", 403)
    }
  }

  if (
    task.visibility_scope === "ORGANIZATION" &&
    task.task_target_org_units &&
    task.task_target_org_units.length > 0
  ) {
    const targetIds = task.task_target_org_units.map((t) => t.org_unit_id)
    if (!actor.orgUnitId || !targetIds.includes(actor.orgUnitId)) {
      throw new AuthorizationError("Access denied: This task is targeted to other specific departments.", 403)
    }
  }
}
