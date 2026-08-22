import { createAdminClient } from "@/lib/supabase/admin"
import { getMemberMonthlyProgress, MonthlyProgressView } from "./progress"
import { getOrgCycleContext } from "./current-cycle"

export interface MemberDashboardData {
  user: {
    id: string
    name: string
    email: string
    designation: string
    departmentName: string
  }
  progress: MonthlyProgressView
  todayInstances: Array<{
    id: string
    title: string
    workDate: string
    startTime: string
    endTime: string
    creditValue: number
    status: string
  }>
  nextUpcomingInstance: {
    id: string
    title: string
    workDate: string
    startTime: string
    endTime: string
    creditValue: number
  } | null
  assignedTasks: Array<{
    id: string
    title: string
    description?: string | null
    creditValue: number
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
    status: string
    deadline?: string | null
    verificationMode: "MANUAL_REPORT" | "FILE_SUBMISSION"
  }>
  recentActivity: Array<{
    id: string
    type: "SCHEDULED_COMPLETION" | "INITIATIVE_APPROVED" | "SALARY_EVENT"
    title: string
    credits: number
    occurredAt: string
  }>
}

export async function getMemberDashboardData(
  organizationId: string,
  userId: string
): Promise<MemberDashboardData> {
  const admin = createAdminClient()
  const db = admin as any

  const ctx = await getOrgCycleContext(organizationId)

  // 1. Fetch user profile + department
  const { data: userProfile } = await db
    .from("users")
    .select("id, name, email, designation, org_units(id, name)")
    .eq("id", userId)
    .single()

  const departmentName = (userProfile?.org_units as any)?.name || "Academic Department"

  // 2. Fetch live progress contract
  const progress = await getMemberMonthlyProgress(organizationId, userId, ctx.monthStart)

  // 3. Fetch today's scheduled instances
  const { data: todayInsts } = await db
    .from("scheduled_work_instances")
    .select("id, title, work_date, start_time, end_time, credit_value, status")
    .eq("organization_id", organizationId)
    .eq("assigned_to_id", userId)
    .eq("work_date", ctx.todayStr)
    .neq("status", "CANCELLED")
    .order("start_time", { ascending: true })

  const todayInstances = (todayInsts || []).map((i: any) => ({
    id: i.id,
    title: i.title,
    workDate: i.work_date,
    startTime: i.start_time?.slice(0, 5) || "09:00",
    endTime: i.end_time?.slice(0, 5) || "10:00",
    creditValue: Number(i.credit_value || 1.0),
    status: i.status,
  }))

  // 4. Fetch next upcoming session if today has 0
  let nextUpcomingInstance: MemberDashboardData["nextUpcomingInstance"] = null
  if (todayInstances.length === 0) {
    const { data: nextInst } = await db
      .from("scheduled_work_instances")
      .select("id, title, work_date, start_time, end_time, credit_value")
      .eq("organization_id", organizationId)
      .eq("assigned_to_id", userId)
      .gt("work_date", ctx.todayStr)
      .neq("status", "CANCELLED")
      .order("work_date", { ascending: true })
      .order("start_time", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextInst) {
      nextUpcomingInstance = {
        id: nextInst.id,
        title: nextInst.title,
        workDate: nextInst.work_date,
        startTime: nextInst.start_time?.slice(0, 5) || "09:00",
        endTime: nextInst.end_time?.slice(0, 5) || "10:00",
        creditValue: Number(nextInst.credit_value || 1.0),
      }
    }
  }

  // 5. Fetch assigned ad-hoc initiatives
  const { data: tasksData } = await db
    .from("tasks")
    .select("id, title, description, credit_value, priority, status, deadline, verification_mode")
    .eq("organization_id", organizationId)
    .eq("assigned_to_id", userId)
    .neq("status", "COMPLETED")
    .order("created_at", { ascending: false })

  const priorityOrder: Record<string, number> = {
    URGENT: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
  }

  const assignedTasks = (tasksData || [])
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      creditValue: Number(t.credit_value || 1.0),
      priority: (t.priority || "MEDIUM") as any,
      status: t.status,
      deadline: t.deadline,
      verificationMode: (t.verification_mode === "FILE_SUBMISSION" ? "FILE_SUBMISSION" : "MANUAL_REPORT") as any,
    }))
    .sort((a: any, b: any) => {
      const pA = priorityOrder[a.priority] || 3
      const pB = priorityOrder[b.priority] || 3
      return pA - pB
    })

  // 6. Fetch recent activity (ledger entries + salary requests)
  const { data: recentEntries } = await db
    .from("credit_ledger_entries")
    .select("id, credit_type, credit_amount, occurred_at, reference_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("occurred_at", { ascending: false })
    .limit(5)

  const recentActivity: MemberDashboardData["recentActivity"] = (recentEntries || []).map((e: any) => ({
    id: e.id,
    type: e.credit_type === "STRUCTURED_SELF_COMPLETION" ? "SCHEDULED_COMPLETION" : "INITIATIVE_APPROVED",
    title: e.credit_type === "STRUCTURED_SELF_COMPLETION" ? "Completed Scheduled Session" : "Approved Institutional Initiative",
    credits: Number(e.credit_amount || 0),
    occurredAt: e.occurred_at,
  }))

  return {
    user: {
      id: userId,
      name: userProfile?.name || "Faculty Member",
      email: userProfile?.email || "",
      designation: userProfile?.designation || "Faculty / Member",
      departmentName,
    },
    progress,
    todayInstances,
    nextUpcomingInstance,
    assignedTasks,
    recentActivity,
  }
}
