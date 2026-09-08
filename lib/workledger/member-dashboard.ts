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
  walletBalance: number
  progress: MonthlyProgressView
  salaryComponent: {
    baseSalary: number
    currency: string
    targetCredits: number
    thresholdCredits: number
    earnedCredits: number
    unlockedSalaryAmount: number
    remainingCreditsToThreshold: number
    isEligible: boolean
    isCustomConfigured: boolean
  }
  motivationalPacing: {
    status: "BEHIND" | "ON_TRACK" | "THRESHOLD_MET" | "EXCEEDED"
    headline: string
    subtext: string
    daysUntilSalaryReview: number
    tokensToSafety: number
  }
  actionableSuggestions: Array<{
    id: string
    type: "SCHEDULED_SESSION" | "PENDING_PROOF" | "MARKETPLACE_INITIATIVE" | "PACING_NUDGE"
    title: string
    actionLabel: string
    actionUrl: string
    creditValue: number
    priority: "URGENT" | "HIGH" | "MEDIUM"
    reason: string
  }>
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

  // 1. Fetch user profile + department + salary skills
  const { data: userProfile } = await db
    .from("users")
    .select("id, name, email, designation, skills, target_credits, org_units:org_unit_id(id, name)")
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
    .select("id, credit_type, amount, created_at, metadata")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(5)

  const recentActivity: MemberDashboardData["recentActivity"] = (recentEntries || []).map((e: any) => ({
    id: e.id,
    type: e.credit_type === "STRUCTURED_SELF_COMPLETION" ? "SCHEDULED_COMPLETION" : "INITIATIVE_APPROVED",
    title: e.metadata?.title || (e.credit_type === "STRUCTURED_SELF_COMPLETION" ? "Completed Scheduled Session" : "Approved Institutional Initiative"),
    credits: Number(e.amount || 0),
    occurredAt: e.created_at,
  }))

  // 7. Fetch faculty member personal wallet balance
  const { data: wallet } = await db
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", userId)
    .eq("purpose", "PERSONAL")
    .maybeSingle()

  const walletBalance = Number(wallet?.balance || 0)

  // 8. Compute Salary Component Matrix
  const skillsObj =
    userProfile?.skills && typeof userProfile.skills === "object" && !Array.isArray(userProfile.skills)
      ? userProfile.skills
      : {}
  const comp = skillsObj.salary_component || {}
  const baseSalary = Number(comp.base_salary || 75000)
  const currency = comp.currency || "INR"
  const isCustomConfigured = Boolean(comp.base_salary)
  const targetCredits = Number(progress.totalTargetCredits || userProfile?.target_credits || 20.0)
  const thresholdPct = Number(progress.salaryThresholdPercentage || comp.threshold_percentage || 85.0)
  const thresholdCredits = Math.round(((targetCredits * thresholdPct) / 100) * 10) / 10
  const earnedCredits = Number(progress.rawEarnedCredits || 0)
  const progressFraction = targetCredits > 0 ? Math.min(1.0, earnedCredits / targetCredits) : 0
  const unlockedSalaryAmount = Math.round(baseSalary * progressFraction)
  const remainingCreditsToThreshold = Math.max(0, Math.round((thresholdCredits - earnedCredits) * 10) / 10)

  const salaryComponent: MemberDashboardData["salaryComponent"] = {
    baseSalary,
    currency,
    targetCredits,
    thresholdCredits,
    earnedCredits,
    unlockedSalaryAmount,
    remainingCreditsToThreshold,
    isEligible: progress.salaryEligible || earnedCredits >= thresholdCredits,
    isCustomConfigured,
  }

  // 9. Psychological Pacing & Motivational State
  const currentDay = new Date().getDate()
  const openDay = Number(ctx.activeWorkCycle?.salary_request_open_day ?? (ctx.activeWorkCycle as any)?.salary_request_opens_day ?? 26)
  const daysUntilSalaryReview = Math.max(0, openDay - currentDay)

  let status: MemberDashboardData["motivationalPacing"]["status"] = "BEHIND"
  let headline = ""
  let subtext = ""

  if ((progress.displayProgressPercentage || 0) >= 100) {
    status = "EXCEEDED"
    headline = "⭐ Outstanding Achievement: 100% Salary Target Reached!"
    subtext = "Full monthly base salary is guaranteed! Surplus tokens earned accumulate directly to your token balance for rewards & recognition."
  } else if (salaryComponent.isEligible) {
    status = "THRESHOLD_MET"
    headline = "🎉 85% Salary Clearance Threshold Met!"
    subtext = `You have officially qualified for monthly salary clearance. Review unlocks on Day ${openDay} (${daysUntilSalaryReview === 0 ? "Today!" : `in ${daysUntilSalaryReview} days`}). Complete remaining classes to earn additional performance tokens!`
  } else if ((progress.displayProgressPercentage || 0) >= 50) {
    status = "ON_TRACK"
    headline = `🔥 Final Sprint: Only ${remainingCreditsToThreshold.toFixed(1)} WORK Tokens to 85% Safety!`
    subtext = daysUntilSalaryReview > 0
      ? `Only ${daysUntilSalaryReview} days left until payroll review on Day ${openDay}. Completing 1 task or 2 classes locks in your monthly salary clearance!`
      : "Payroll review is currently open! Complete your pending sessions to unlock salary endorsement."
  } else {
    status = "BEHIND"
    headline = `🚀 Momentum Alert: Bank ${remainingCreditsToThreshold.toFixed(1)} WORK Tokens for Salary Clearance`
    subtext = "Pacing checkpoint: Completing scheduled timetable sessions this week will boost your progress and protect your payroll clearance timeline."
  }

  const motivationalPacing: MemberDashboardData["motivationalPacing"] = {
    status,
    headline,
    subtext,
    daysUntilSalaryReview,
    tokensToSafety: remainingCreditsToThreshold,
  }

  // 10. Generate Actionable Work Recommendations
  const actionableSuggestions: MemberDashboardData["actionableSuggestions"] = []

  // (a) Uncompleted Scheduled Sessions for Today
  const pendingSessions = todayInstances.filter((inst: any) => inst.status !== "SELF_COMPLETED")
  for (const session of pendingSessions.slice(0, 2)) {
    actionableSuggestions.push({
      id: `session-${session.id}`,
      type: "SCHEDULED_SESSION",
      title: `Complete Class: ${session.title} (${session.startTime}–${session.endTime})`,
      actionLabel: "Complete Session",
      actionUrl: `/${organizationId}/member/schedule`,
      creditValue: session.creditValue,
      priority: "HIGH",
      reason: `Earn +${session.creditValue.toFixed(1)} WORK tokens instantly on trust towards your ${thresholdCredits.toFixed(1)} cr salary safety mark.`,
    })
  }

  // (b) Assigned initiatives waiting for proof submission
  const actionableTasks = assignedTasks.filter(
    (t) => t.status === "ASSIGNED" || t.status === "IN_PROGRESS" || t.status === "OPEN"
  )
  for (const task of actionableTasks.slice(0, 2)) {
    actionableSuggestions.push({
      id: `task-${task.id}`,
      type: "PENDING_PROOF",
      title: `Submit Proof: "${task.title}"`,
      actionLabel: "Submit Proof",
      actionUrl: `/${organizationId}/member/tasks`,
      creditValue: task.creditValue,
      priority: task.priority === "URGENT" ? "URGENT" : "HIGH",
      reason: `Unlocks +${task.creditValue.toFixed(1)} WORK tokens immediately upon HOD review and approval.`,
    })
  }

  // (c) Marketplace task nomination suggestion if gap exists
  if (remainingCreditsToThreshold > 0 && actionableSuggestions.length < 3) {
    actionableSuggestions.push({
      id: "marketplace-pool-suggestion",
      type: "MARKETPLACE_INITIATIVE",
      title: "Self-Nominate for Open Department Initiatives",
      actionLabel: "Browse Task Pool",
      actionUrl: `/${organizationId}/member/marketplace`,
      creditValue: 2.5,
      priority: "MEDIUM",
      reason: `Select an available initiative in the Task Pool (+2.0 to +5.0 WORK) to bridge your token gap before Day ${openDay}.`,
    })
  }

  return {
    user: {
      id: userId,
      name: userProfile?.name || "Faculty Member",
      email: userProfile?.email || "",
      designation: userProfile?.designation || "Faculty / Member",
      departmentName,
    },
    walletBalance,
    progress,
    salaryComponent,
    motivationalPacing,
    actionableSuggestions,
    todayInstances,
    nextUpcomingInstance,
    assignedTasks,
    recentActivity,
  }
}
