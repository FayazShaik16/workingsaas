import { requireAuth } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  MinimalFacultyDashboard,
  ScheduledInstanceRow,
  AssignedAdHocTask,
} from "@/components/member/minimal-faculty-dashboard"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  const admin = createAdminClient()
  const db = admin as any

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  // 1. Fetch user profile
  const { data: profile } = await db
    .from("users")
    .select("id, name, designation, email")
    .eq("id", user.id)
    .maybeSingle()

  const userName = profile?.name || user.name || "Faculty Member"
  const userDesignation = profile?.designation || "Faculty / Member"

  // 2. Fetch active work cycle
  const { data: activeCycle } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Fetch monthly work progress summary
  let progressData = null
  if (activeCycle?.id) {
    const { data: pData } = await db
      .from("monthly_work_progress")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("work_cycle_id", activeCycle.id)
      .eq("month_start", currentMonthStart)
      .maybeSingle()

    progressData = pData
  }

  // If monthly_work_progress is not yet computed, calculate live from credit ledger
  let rawEarnedCredits = Number(progressData?.raw_earned_credits || 0)
  let totalTargetCredits = Number(progressData?.total_target_credits || 0)
  let displayPercentage = Number(progressData?.display_progress_percentage || 0)
  let isSalaryEligible = Boolean(progressData?.salary_eligible)

  if (!progressData) {
    const { data: ledgerEntries } = await db
      .from("credit_ledger_entries")
      .select("amount")
      .eq("user_id", user.id)
      .eq("month_start", currentMonthStart)

    rawEarnedCredits = (ledgerEntries || []).reduce((acc: number, c: any) => acc + (Number(c.amount) || 0), 0)

    // Calculate scheduled target from scheduled instances
    const { data: monthInstances } = await db
      .from("scheduled_work_instances")
      .select("credit_value")
      .eq("assigned_to_id", user.id)
      .gte("work_date", currentMonthStart)
      .neq("status", "CANCELLED")

    const schedTarget = (monthInstances || []).reduce((acc: number, c: any) => acc + (Number(c.credit_value) || 0), 0)
    const schedWeight = Number(activeCycle?.scheduled_weight_percentage) || 75

    if (schedTarget > 0) {
      totalTargetCredits = Math.round((schedTarget / (schedWeight / 100)) * 100) / 100
      displayPercentage = Math.min(100, Math.round((rawEarnedCredits / totalTargetCredits) * 100))
      isSalaryEligible = rawEarnedCredits >= totalTargetCredits * 0.85
    } else {
      totalTargetCredits = 0
      displayPercentage = 0
      isSalaryEligible = false
    }
  }

  // 4. Fetch today's scheduled work instances
  const { data: todayInstances } = await db
    .from("scheduled_work_instances")
    .select(`
      id,
      work_date,
      scheduled_start,
      scheduled_end,
      credit_value,
      status,
      template_id,
      scheduled_work_templates (title, start_time, end_time)
    `)
    .eq("assigned_to_id", user.id)
    .eq("work_date", todayStr)
    .neq("status", "CANCELLED")
    .order("scheduled_start", { ascending: true })

  const scheduledInstances: ScheduledInstanceRow[] = (todayInstances || []).map((inst: any) => {
    const tmpl = inst.scheduled_work_templates
    const title = tmpl?.title || "Scheduled Lecture / Session"
    const startTime = (tmpl?.start_time || inst.scheduled_start?.slice(11, 16) || "09:00").slice(0, 5)
    const endTime = (tmpl?.end_time || inst.scheduled_end?.slice(11, 16) || "10:00").slice(0, 5)

    return {
      id: inst.id,
      title,
      workDate: inst.work_date,
      startTime,
      endTime,
      creditValue: Number(inst.credit_value) || 1.0,
      status: inst.status || "UPCOMING",
    }
  })

  // 5. Fetch assigned ad-hoc / unstructured tasks
  const { data: assignedTasksRaw } = await db
    .from("tasks")
    .select("id, title, description, credit_value, status, deadline, priority, verification_mode")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .neq("status", "CLOSED")
    .order("created_at", { ascending: false })

  const assignedAdHocTasks: AssignedAdHocTask[] = (assignedTasksRaw || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    creditValue: Number(t.credit_value) || 2.0,
    priority: t.priority || "MEDIUM",
    status: t.status,
    deadline: t.deadline,
    verificationMode: t.verification_mode || "MANUAL_REPORT",
  }))

  return (
    <div className="p-6 md:p-8 min-h-screen bg-slate-950 text-slate-100">
      <MinimalFacultyDashboard
        orgId={orgId}
        userId={user.id}
        userName={userName}
        userDesignation={userDesignation}
        workCycleName={activeCycle?.name || null}
        rawEarnedCredits={rawEarnedCredits}
        totalTargetCredits={totalTargetCredits}
        displayPercentage={displayPercentage}
        isSalaryEligible={isSalaryEligible}
        scheduledInstances={scheduledInstances}
        assignedTasks={assignedAdHocTasks}
      />
    </div>
  )
}
