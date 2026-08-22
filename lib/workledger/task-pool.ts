import { createAdminClient } from "@/lib/supabase/admin"

export interface TaskPoolItem {
  id: string
  title: string
  description?: string | null
  creditValue: number
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: string
  deadline?: string | null
  verificationMode: "MANUAL_REPORT" | "FILE_SUBMISSION"
  visibilityScope: "ORGANIZATION" | "ORG_UNIT"
  orgUnitId?: string | null
  orgUnitName?: string | null
  targetOrgUnitNames?: string[]
  isNominatedByMe: boolean
  nominationStatus?: string | null
  nominationCount: number
}

export async function getScopedTaskPool(
  organizationId: string,
  userId: string,
  userOrgUnitId: string | null,
  filters?: {
    priority?: string
    verificationMode?: string
  }
): Promise<TaskPoolItem[]> {
  const admin = createAdminClient()
  const db = admin as any

  // 1. Query open tasks with real verification_mode and relations
  let query = db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      priority,
      status,
      deadline,
      verification_mode,
      visibility_scope,
      org_unit_id,
      custom_fields,
      org_units(name),
      nominations(id, user_id, status)
    `)
    .eq("organization_id", organizationId)
    .eq("status", "OPEN")

  if (filters?.priority && filters.priority !== "ALL") {
    query = query.eq("priority", filters.priority)
  }

  if (filters?.verificationMode && filters.verificationMode !== "ALL") {
    query = query.eq("verification_mode", filters.verificationMode)
  }

  const { data: tasksData, error } = await query
  if (error) {
    console.error("[task-pool] fetch error:", error)
    return []
  }

  // 2. Filter by department isolation
  const filteredTasks: TaskPoolItem[] = []

  for (const t of tasksData || []) {
    // A. Department-scoped task: only visible if user belongs to same org_unit
    if (t.visibility_scope === "ORG_UNIT" && t.org_unit_id) {
      if (!userOrgUnitId || userOrgUnitId !== t.org_unit_id) {
        continue // Skip department task from another department
      }
    }

    // B. Organization-scoped task with explicit targets in custom_fields
    const targetUnitIds = t.custom_fields?.targetOrgUnitIds
    if (t.visibility_scope === "ORGANIZATION" && Array.isArray(targetUnitIds) && targetUnitIds.length > 0) {
      if (!userOrgUnitId || !targetUnitIds.includes(userOrgUnitId)) {
        continue // Skip task not targeted to user's department
      }
    }

    const myNomination = (t.nominations || []).find((n: any) => n.user_id === userId)

    filteredTasks.push({
      id: t.id,
      title: t.title,
      description: t.description,
      creditValue: Number(t.credit_value || 1.0),
      priority: (t.priority || "MEDIUM") as any,
      status: t.status,
      deadline: t.deadline,
      verificationMode: t.verification_mode === "FILE_SUBMISSION" ? "FILE_SUBMISSION" : "MANUAL_REPORT",
      visibilityScope: t.visibility_scope || "ORGANIZATION",
      orgUnitId: t.org_unit_id,
      orgUnitName: t.org_units?.name || null,
      isNominatedByMe: Boolean(myNomination),
      nominationStatus: myNomination?.status || null,
      nominationCount: (t.nominations || []).length,
    })
  }

  return filteredTasks
}
