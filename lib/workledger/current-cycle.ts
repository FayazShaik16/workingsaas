import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"

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
  let user: any = null
  try {
    user = await getSessionUser()
  } catch {
    // Called outside Next.js request store
  }

  const orgId = explicitOrgId || user?.organizationId || ""
  const userId = user?.id || ""

  const admin = createAdminClient()
  const db = admin as any

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const monthStart = `${todayStr.slice(0, 7)}-01`

  // 1. Fetch user's department org_unit_id
  let userOrgUnitId: string | null = null
  if (userId) {
    const { data: userProfile } = await db
      .from("users")
      .select("org_unit_id")
      .eq("id", userId)
      .maybeSingle()

    userOrgUnitId = userProfile?.org_unit_id || user?.orgUnitId || null
  }

  // 2. Fetch active work cycle for this organization
  let { data: activeCycle } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // Fallback: any cycle for this org
  if (!activeCycle && orgId) {
    const { data: existingCycle } = await db
      .from("work_cycles")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existingCycle) {
      activeCycle = existingCycle
    } else {
      // Auto-provision initial cycle for org
      try {
        const cycleStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0]
        const cycleEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().split("T")[0]
        const { data: createdCycle } = await db
          .from("work_cycles")
          .insert({
            organization_id: orgId,
            name: `${today.toLocaleString("default", { month: "long" })} ${today.getFullYear()} Academic Cycle`,
            starts_on: cycleStart,
            ends_on: cycleEnd,
            scheduled_weight_percentage: 75,
            salary_threshold_percentage: 85,
            salary_request_opens_day: 26,
            status: "ACTIVE",
          })
          .select()
          .single()

        if (createdCycle) {
          activeCycle = createdCycle
        }
      } catch (e) {
        console.warn("[getOrgCycleContext] Auto-provisioning cycle warning:", e)
      }
    }
  }

  return {
    userId,
    organizationId: orgId,
    userOrgUnitId,
    activeWorkCycle: activeCycle || null,
    monthStart,
    todayStr,
    timezone: "Asia/Kolkata",
  }
}
