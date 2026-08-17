/**
 * Human-readable formatters for Roles, Departments, Statuses, and Identifiers
 */

export const ROLE_DISPLAY_NAMES: Record<string, string> = {
  SYSTEM_ADMIN: "System Admin",
  DIRECTOR: "Director",
  FINANCE_ADMIN: "Finance Admin",
  ORG_UNIT_LEAD: "HOD / Dept Lead",
  DEPT_ADMIN: "Dept Admin",
  MEMBER: "Faculty Member",
  FACULTY: "Faculty Member",
  STAFF: "Staff Member",
}

export const UNIT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  DEPARTMENT: "Academic Department",
  DIVISION: "Academic Division",
  FACULTY: "Faculty Unit",
  INSTITUTION: "Institutional Root",
  BRANCH: "Department Branch",
  COMMITTEE: "Institutional Committee",
}

export function formatRole(scopeOrName?: string | null): string {
  if (!scopeOrName) return "Faculty Member"
  
  // If already a clean label
  if (ROLE_DISPLAY_NAMES[scopeOrName]) {
    return ROLE_DISPLAY_NAMES[scopeOrName]
  }

  // If it's a UUID string
  if (isUUID(scopeOrName)) {
    return "Assigned Role"
  }

  // Clean uppercase underscores
  if (scopeOrName.includes("_")) {
    const formatted = scopeOrName
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ")
    return formatted
  }

  return scopeOrName
}

export function formatDepartment(deptNameOrUnit?: string | { name?: string; unit_type?: string } | null): string {
  if (!deptNameOrUnit) return "Institution Root / Executive"
  
  if (typeof deptNameOrUnit === "object") {
    if (deptNameOrUnit.name && !isUUID(deptNameOrUnit.name)) {
      return deptNameOrUnit.name
    }
    if (deptNameOrUnit.unit_type) {
      return UNIT_TYPE_DISPLAY_NAMES[deptNameOrUnit.unit_type] || deptNameOrUnit.unit_type
    }
    return "Academic Department"
  }

  if (isUUID(deptNameOrUnit)) {
    return "Academic Department"
  }

  return deptNameOrUnit
}

export function formatStatus(status?: string | null): string {
  if (!status) return "Active"
  const s = status.toUpperCase()
  if (s === "ACTIVE") return "Active"
  if (s === "PENDING") return "Pending"
  if (s === "VERIFIED") return "Verified"
  if (s === "APPROVED") return "Approved"
  if (s === "REJECTED") return "Rejected"
  if (s === "CLOSED") return "Closed"
  if (s === "IN_REVIEW") return "In Review"
  if (s === "VERIFICATION_PENDING") return "Awaiting Verification"
  return status
}

export function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)
}
