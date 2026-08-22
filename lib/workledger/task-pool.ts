import { createAdminClient } from "@/lib/supabase/admin"

export interface TaskPoolItem {
  id: string
  title: string
  description?: string | null
  creditValue: number
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: string
  deadline?: string | null
  verificationType: "MANUAL_REPORT" | "FILE_SUBMISSION"
  visibilityScope: "ORGANIZATION" | "ORG_UNIT"
  orgUnitId?: string | null
  orgUnitName?: string | null
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
    verificationType?: string
  }
): Promise<TaskPoolItem[]> {
  const admin = createAdminClient()
  const db = admin as any

  // 1. Query open tasks for organization
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
      verification_type,
      visibility_scope,
      org_unit_id,
      org_units(name),
      nominations(id, user_id, status)
    `)
    .eq("organization_id", organizationId)
    .eq("status", "OPEN")

  if (filters?.priority) {
    query = query.eq("priority", filters.priority)
  }

  const { data: tasksData, error } = await query
  if (error) {
    console.error("[task-pool] fetch error:", error)
    return []
  }

  // 2. Filter by department isolation
  const filteredTasks: TaskPoolItem[] = []

  for (const t of tasksData || []) {
    // If scoped to an ORG_UNIT, user must belong to that same ORG_UNIT
    if (t.visibility_scope === "ORG_UNIT" && t.org_unit_id) {
      if (!userOrgUnitId || userOrgUnitId !== t.org_unit_id) {
        continue // Skip tasks from other departments
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
      verificationType: t.verification_type === "FILE_UPLOAD" ? "FILE_SUBMISSION" : "MANUAL_REPORT",
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
