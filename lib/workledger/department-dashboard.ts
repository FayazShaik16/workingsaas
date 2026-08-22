import { createAdminClient } from "@/lib/supabase/admin"
import { getOrgCycleContext } from "./current-cycle"
import { getMemberMonthlyProgress } from "./progress"

export interface DepartmentDashboardData {
  department: {
    id: string
    name: string
    code?: string
  } | null
  metrics: {
    memberCount: number
    todayScheduledExpected: number
    todayScheduledCompleted: number
    pendingInitiativeReviews: number
    pendingSalaryRequests: number
  }
  attentionItems: Array<{
    id: string
    type: "OVERDUE_TASK" | "PENDING_PROOF" | "UNASSIGNED_TASK"
    title: string
    priority: string
    facultyName?: string
    createdAt: string
  }>
  facultyProgressList: Array<{
    userId: string
    name: string
    email: string
    designation: string
    earnedCredits: number
    targetCredits: number
    progressPercentage: number
    isSalaryEligible: boolean
  }>
  scheduledReviewList: Array<{
    instanceId: string
    facultyId: string
    facultyName: string
    title: string
    workDate: string
    startTime: string
    endTime: string
    creditValue: number
    completedAt?: string
    isFlagged: boolean
    flagReason?: string
  }>
  pendingProofsList: Array<{
    proofId: string
    taskId: string
    taskTitle: string
    facultyId: string
    facultyName: string
    creditValue: number
    submittedAt: string
    proofNotes?: string
    fileUrl?: string
  }>
  salaryRequestsList: Array<{
    requestId: string
    userId: string
    userName: string
    userEmail: string
    earnedCredits: number
    targetCredits: number
    progressPercentage: number
    status: string
    requestedAt: string
  }>
}

export async function getDepartmentDashboardData(
  organizationId: string,
  hodOrgUnitId: string | null
): Promise<DepartmentDashboardData> {
  const admin = createAdminClient()
  const db = admin as any

  if (!hodOrgUnitId) {
    return {
      department: null,
      metrics: {
        memberCount: 0,
        todayScheduledExpected: 0,
        todayScheduledCompleted: 0,
        pendingInitiativeReviews: 0,
        pendingSalaryRequests: 0,
      },
      attentionItems: [],
      facultyProgressList: [],
      scheduledReviewList: [],
      pendingProofsList: [],
      salaryRequestsList: [],
    }
  }

  const ctx = await getOrgCycleContext(organizationId)

  // 1. Fetch Department Info
  const { data: deptInfo } = await db
    .from("org_units")
    .select("id, name, code")
    .eq("id", hodOrgUnitId)
    .single()

  // 2. Fetch Department Faculty Members
  const { data: deptMembers } = await db
    .from("users")
    .select("id, name, email, designation, status")
    .eq("organization_id", organizationId)
    .eq("org_unit_id", hodOrgUnitId)
    .eq("status", "ACTIVE")
    .order("name", { ascending: true })

  const members = deptMembers || []
  const memberIds = members.map((m: any) => m.id)

  // 3. Fetch Today's Scheduled Sessions in Department
  let todayExpected = 0
  let todayCompleted = 0

  if (memberIds.length > 0) {
    const { data: todayInsts } = await db
      .from("scheduled_work_instances")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("work_date", ctx.todayStr)
      .in("assigned_to_id", memberIds)
      .neq("status", "CANCELLED")

    todayExpected = (todayInsts || []).length
    todayCompleted = (todayInsts || []).filter((i: any) => i.status === "SELF_COMPLETED").length
  }

  // 4. Fetch Pending Task Proofs
  let pendingProofsList: DepartmentDashboardData["pendingProofsList"] = []
  if (memberIds.length > 0) {
    const { data: proofs } = await db
      .from("task_proofs")
      .select(`
        id,
        task_id,
        submitted_by,
        proof_notes,
        file_url,
        created_at,
        users!submitted_by(name),
        tasks!task_id(title, credit_value, org_unit_id)
      `)
      .eq("status", "PENDING")
      .in("submitted_by", memberIds)
      .order("created_at", { ascending: false })

    pendingProofsList = (proofs || []).map((p: any) => ({
      proofId: p.id,
      taskId: p.task_id,
      taskTitle: p.tasks?.title || "Department Task",
      facultyId: p.submitted_by,
      facultyName: p.users?.name || "Faculty Member",
      creditValue: Number(p.tasks?.credit_value || 1.0),
      submittedAt: p.created_at,
      proofNotes: p.proof_notes,
      fileUrl: p.file_url,
    }))
  }

  // 5. Fetch Pending Salary Requests
  let salaryRequestsList: DepartmentDashboardData["salaryRequestsList"] = []
  if (memberIds.length > 0) {
    const { data: salaryReqs } = await db
      .from("salary_requests")
      .select(`
        id,
        user_id,
        status,
        created_at,
        users!user_id(name, email)
      `)
      .eq("organization_id", organizationId)
      .in("user_id", memberIds)
      .eq("month_start", ctx.monthStart)
      .order("created_at", { ascending: false })

    // For each salary request, fetch their monthly progress
    for (const req of salaryReqs || []) {
      const p = await getMemberMonthlyProgress(organizationId, req.user_id, ctx.monthStart)
      salaryRequestsList.push({
        requestId: req.id,
        userId: req.user_id,
        userName: req.users?.name || "Faculty Member",
        userEmail: req.users?.email || "",
        earnedCredits: p.rawEarnedCredits,
        targetCredits: p.totalTargetCredits,
        progressPercentage: p.displayProgressPercentage || 0,
        status: req.status,
        requestedAt: req.created_at,
      })
    }
  }

  // 6. Faculty Progress List
  const facultyProgressList: DepartmentDashboardData["facultyProgressList"] = []
  for (const m of members) {
    const p = await getMemberMonthlyProgress(organizationId, m.id, ctx.monthStart)
    facultyProgressList.push({
      userId: m.id,
      name: m.name,
      email: m.email,
      designation: m.designation || "Faculty Member",
      earnedCredits: p.rawEarnedCredits,
      targetCredits: p.totalTargetCredits,
      progressPercentage: p.displayProgressPercentage || 0,
      isSalaryEligible: p.salaryEligible,
    })
  }

  // 7. Scheduled Review List (self-completed sessions in dept)
  let scheduledReviewList: DepartmentDashboardData["scheduledReviewList"] = []
  if (memberIds.length > 0) {
    const { data: completedInsts } = await db
      .from("scheduled_work_instances")
      .select(`
        id,
        assigned_to_id,
        title,
        work_date,
        start_time,
        end_time,
        credit_value,
        users!assigned_to_id(name)
      `)
      .eq("organization_id", organizationId)
      .in("assigned_to_id", memberIds)
      .eq("status", "SELF_COMPLETED")
      .gte("work_date", ctx.monthStart)
      .order("work_date", { ascending: false })
      .limit(10)

    scheduledReviewList = (completedInsts || []).map((i: any) => ({
      instanceId: i.id,
      facultyId: i.assigned_to_id,
      facultyName: i.users?.name || "Faculty Member",
      title: i.title,
      workDate: i.work_date,
      startTime: i.start_time?.slice(0, 5) || "09:00",
      endTime: i.end_time?.slice(0, 5) || "10:00",
      creditValue: Number(i.credit_value || 1.0),
      isFlagged: false,
    }))
  }

  // 8. Attention Items
  const attentionItems: DepartmentDashboardData["attentionItems"] = []
  for (const p of pendingProofsList.slice(0, 4)) {
    attentionItems.push({
      id: p.proofId,
      type: "PENDING_PROOF",
      title: `Proof submitted for "${p.taskTitle}"`,
      priority: "HIGH",
      facultyName: p.facultyName,
      createdAt: p.submittedAt,
    })
  }

  return {
    department: deptInfo ? { id: deptInfo.id, name: deptInfo.name, code: deptInfo.code } : null,
    metrics: {
      memberCount: members.length,
      todayScheduledExpected: todayExpected,
      todayScheduledCompleted: todayCompleted,
      pendingInitiativeReviews: pendingProofsList.length,
      pendingSalaryRequests: salaryRequestsList.filter((s) => s.status === "PENDING_LEAD").length,
    },
    attentionItems,
    facultyProgressList,
    scheduledReviewList,
    pendingProofsList,
    salaryRequestsList,
  }
}
