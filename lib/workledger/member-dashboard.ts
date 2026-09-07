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
    isNominated?: boolean
    nominationStatus?: string
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
    .select("id, name, email, designation, org_units:org_unit_id(id, name)")
    .eq("id", userId)
    .single()

  const departmentName = (userProfile?.org_units as any)?.name || "Academic Department"

  // 2. Fetch live progress contract
  const progress = await getMemberMonthlyProgress(organizationId, userId, ctx.monthStart)

  // 3. Fetch today's scheduled instances
  const { data: todayInsts } = await db
    .from("scheduled_work_instances")
    .select(`
      id,
      work_date,
      scheduled_start,
      scheduled_end,
      credit_value,
      status,
      scheduled_work_templates:template_id ( title, start_time, end_time )
    `)
    .eq("organization_id", organizationId)
    .eq("assigned_to_id", userId)
    .eq("work_date", ctx.todayStr)
    .neq("status", "CANCELLED")
    .order("scheduled_start", { ascending: true })

  const todayInstances = (todayInsts || []).map((i: any) => ({
    id: i.id,
    title: i.scheduled_work_templates?.title || "Scheduled Session",
    workDate: i.work_date,
    startTime: i.scheduled_work_templates?.start_time?.slice(0, 5) || (i.scheduled_start ? new Date(i.scheduled_start).toISOString().slice(11, 16) : "09:00"),
    endTime: i.scheduled_work_templates?.end_time?.slice(0, 5) || (i.scheduled_end ? new Date(i.scheduled_end).toISOString().slice(11, 16) : "10:00"),
    creditValue: Number(i.credit_value || 1.0),
    status: i.status === "UPCOMING" ? "SCHEDULED" : i.status,
  }))

  // 4. Fetch next upcoming session if today has 0
  let nextUpcomingInstance: MemberDashboardData["nextUpcomingInstance"] = null
  if (todayInstances.length === 0) {
    const { data: nextInst } = await db
      .from("scheduled_work_instances")
      .select(`
        id,
        work_date,
        scheduled_start,
        scheduled_end,
        credit_value,
        scheduled_work_templates:template_id ( title, start_time, end_time )
      `)
      .eq("organization_id", organizationId)
      .eq("assigned_to_id", userId)
      .gt("work_date", ctx.todayStr)
      .neq("status", "CANCELLED")
      .order("work_date", { ascending: true })
      .order("scheduled_start", { ascending: true })
      .limit(1)
      .maybeSingle()

    if (nextInst) {
      nextUpcomingInstance = {
        id: nextInst.id,
        title: nextInst.scheduled_work_templates?.title || "Scheduled Session",
        workDate: nextInst.work_date,
        startTime: nextInst.scheduled_work_templates?.start_time?.slice(0, 5) || (nextInst.scheduled_start ? new Date(nextInst.scheduled_start).toISOString().slice(11, 16) : "09:00"),
        endTime: nextInst.scheduled_work_templates?.end_time?.slice(0, 5) || (nextInst.scheduled_end ? new Date(nextInst.scheduled_end).toISOString().slice(11, 16) : "10:00"),
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
    .not("status", "in", '("CLOSED","CANCELLED","REJECTED")')
    .order("created_at", { ascending: false })

  // 5b. Fetch user nominations from Task Pool
  const { data: userNominations } = await db
    .from("nominations")
    .select(`
      id,
      status,
      message,
      task:tasks (
        id,
        title,
        description,
        credit_value,
        priority,
        status,
        deadline,
        verification_mode,
        organization_id,
        assigned_to_id
      )
    `)
    .eq("user_id", userId)
    .in("status", ["PENDING", "ACCEPTED"])

  const taskMap = new Map<string, MemberDashboardData["assignedTasks"][number]>()

  for (const t of tasksData || []) {
    taskMap.set(t.id, {
      id: t.id,
      title: t.title,
      description: t.description,
      creditValue: Number(t.credit_value || 1.0),
      priority: (t.priority || "MEDIUM") as any,
      status: t.status,
      deadline: t.deadline,
      verificationMode: (t.verification_mode === "FILE_SUBMISSION" ? "FILE_SUBMISSION" : "MANUAL_REPORT") as any,
      isNominated: false,
      nominationStatus: undefined,
    })
  }

  for (const nom of userNominations || []) {
    const t = nom.task
    if (!t || t.organization_id !== organizationId) continue

    if (taskMap.has(t.id)) {
      const existing = taskMap.get(t.id)!
      existing.isNominated = true
      existing.nominationStatus = nom.status
    } else {
      if (!["CLOSED", "CANCELLED", "REJECTED"].includes(t.status)) {
        taskMap.set(t.id, {
          id: t.id,
          title: t.title,
          description: t.description,
          creditValue: Number(t.credit_value || 1.0),
          priority: (t.priority || "MEDIUM") as any,
          status: nom.status === "PENDING" ? "NOMINATED" : t.status,
          deadline: t.deadline,
          verificationMode: (t.verification_mode === "FILE_SUBMISSION" ? "FILE_SUBMISSION" : "MANUAL_REPORT") as any,
          isNominated: true,
          nominationStatus: nom.status,
        })
      }
    }
  }

  const priorityOrder: Record<string, number> = {
    URGENT: 1,
    HIGH: 2,
    MEDIUM: 3,
    LOW: 4,
  }

  const assignedTasks = Array.from(taskMap.values()).sort((a: any, b: any) => {
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
