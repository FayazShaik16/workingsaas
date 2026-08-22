import { createAdminClient } from "@/lib/supabase/admin"
import { requireAuth } from "@/lib/auth/protect"

export interface OrgCycleContext {
  userId: string
  organizationId: string
  userOrgUnitId: string | null
  activeWorkCycle: {
    id: string
    name: string
    status: string
    start_date: string
    end_date: string
    scheduled_work_weight_percentage: number
    unstructured_work_weight_percentage: number
    salary_authorization_threshold_percentage: number
    salary_request_open_day: number
  } | null
  monthStart: string
  todayStr: string
  timezone: string
}

export async function getOrgCycleContext(explicitOrgId?: string): Promise<OrgCycleContext> {
  const user = await requireAuth()
  const orgId = explicitOrgId || user.organizationId

  const admin = createAdminClient()
  const db = admin as any

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const monthStart = `${todayStr.slice(0, 7)}-01`

  // 1. Fetch user's department org_unit_id
  const { data: userProfile } = await db
    .from("users")
    .select("org_unit_id")
    .eq("id", user.id)
    .maybeSingle()

  const userOrgUnitId = userProfile?.org_unit_id || user.orgUnitId || null

  // 2. Fetch active work cycle for this organization
  const { data: activeCycle } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    userId: user.id,
    organizationId: orgId,
    userOrgUnitId,
    activeWorkCycle: activeCycle || null,
    monthStart,
    todayStr,
    timezone: "Asia/Kolkata",
  }
}
