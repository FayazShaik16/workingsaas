import { createAdminClient } from "@/lib/supabase/admin"
import { getOrCreateDefaultTaskType } from "@/lib/workledger/default-task-type"
import { getOrgCycleContext } from "@/lib/workledger/current-cycle"

export type SelfTaskInterestArea =
  | "RESEARCH"
  | "DEVELOPMENT"
  | "WORKSHOP"
  | "LAB_UPGRADE"
  | "MENTORSHIP"
  | "ACADEMIC_INITIATIVE"
  | "OTHER"

export interface SelfTaskItem {
  id: string
  title: string
  description: string
  interestArea: SelfTaskInterestArea
  proposedCredits: number
  approvedCredits: number
  facultyId: string
  facultyName: string
  facultyEmail: string
  facultyDesignation?: string | null
  departmentId: string
  departmentName: string
  targetCompletionDate?: string
  expectedDeliverable?: string
  proposalStatus: "PENDING" | "APPROVED" | "REJECTED"
  taskStatus: "DRAFT" | "ASSIGNED" | "VERIFICATION_PENDING" | "LEAD_SIGNED" | "REJECTED" | string
  hodApprovedBy?: string
  hodApprovedByName?: string
  hodApprovedAt?: string
  hodApprovalComment?: string
  proofDescription?: string
  proofUrl?: string
  proofSubmittedAt?: string
  hodVerifiedBy?: string
  hodVerifiedByName?: string
  hodVerifiedAt?: string
  hodVerificationComment?: string
  createdAt: string
}

export interface DirectorSelfTaskAuditSummary {
  totalProposals: number
  pendingProposals: number
  activeInProgress: number
  verifiedCompleted: number
  totalTokensDisbursed: number
  averageTokensPerCompletedTask: number
  departmentBreakdown: Record<
    string,
    {
      departmentName: string
      totalTasks: number
      completedTasks: number
      tokensDisbursed: number
      facultyCount: number
    }
  >
  flaggedTasks: Array<{
    task: SelfTaskItem
    reason: string
  }>
}

/**
 * Fetch self-proposed tasks for a specific faculty member.
 */
export async function getFacultySelfTasks(
  orgId: string,
  facultyId: string
): Promise<SelfTaskItem[]> {
  const admin = createAdminClient()
  const db = admin as any

  const { data: rawTasks } = await db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      status,
      org_unit_id,
      deadline,
      created_at,
      lead_signed_at,
      custom_fields,
      users:assigned_to_id(id, name, email, designation, org_unit_id, org_units:org_unit_id(name)),
      lead:lead_signed_by(id, name),
      task_proofs(id, description, file_url, submitted_at)
    `)
    .eq("organization_id", orgId)
    .eq("assigned_to_id", facultyId)
    .eq("custom_fields->>is_self_proposed", "true")
    .order("created_at", { ascending: false })

  return (rawTasks || []).map((t: any) => mapToSelfTaskItem(t, facultyId))
}

/**
 * Fetch self-proposed tasks within a department for HOD oversight.
 */
export async function getDepartmentSelfTasks(
  orgId: string,
  deptId?: string
): Promise<{
  pendingProposals: SelfTaskItem[]
  pendingVerifications: SelfTaskItem[]
  activeInProgress: SelfTaskItem[]
  completedTasks: SelfTaskItem[]
  allTasks: SelfTaskItem[]
}> {
  const admin = createAdminClient()
  const db = admin as any

  let query = db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      status,
      org_unit_id,
      deadline,
      created_at,
      lead_signed_at,
      custom_fields,
      users:assigned_to_id(id, name, email, designation, org_unit_id, org_units:org_unit_id(name)),
      lead:lead_signed_by(id, name),
      task_proofs(id, description, file_url, submitted_at)
    `)
    .eq("organization_id", orgId)
    .eq("custom_fields->>is_self_proposed", "true")
    .order("created_at", { ascending: false })

  if (deptId) {
    query = query.eq("org_unit_id", deptId)
  }

  const { data: rawTasks } = await query
  const allTasks: SelfTaskItem[] = (rawTasks || []).map((t: any) => mapToSelfTaskItem(t))

  const pendingProposals = allTasks.filter((t) => t.proposalStatus === "PENDING" && t.taskStatus === "DRAFT")
  const pendingVerifications = allTasks.filter((t) => t.taskStatus === "VERIFICATION_PENDING")
  const activeInProgress = allTasks.filter((t) => t.proposalStatus === "APPROVED" && t.taskStatus === "ASSIGNED")
  const completedTasks = allTasks.filter((t) => t.taskStatus === "LEAD_SIGNED" || t.taskStatus === "CLOSED")

  return {
    pendingProposals,
    pendingVerifications,
    activeInProgress,
    completedTasks,
    allTasks,
  }
}

/**
 * Fetch all self-proposed tasks across the organization for Director transparency audit.
 */
export async function getDirectorSelfTasksAudit(
  orgId: string
): Promise<{
  summary: DirectorSelfTaskAuditSummary
  allTasks: SelfTaskItem[]
}> {
  const admin = createAdminClient()
  const db = admin as any

  const { data: rawTasks } = await db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      status,
      org_unit_id,
      deadline,
      created_at,
      lead_signed_at,
      custom_fields,
      users:assigned_to_id(id, name, email, designation, org_unit_id, org_units:org_unit_id(name)),
      lead:lead_signed_by(id, name),
      task_proofs(id, description, file_url, submitted_at)
    `)
    .eq("organization_id", orgId)
    .eq("custom_fields->>is_self_proposed", "true")
    .order("created_at", { ascending: false })

  const allTasks: SelfTaskItem[] = (rawTasks || []).map((t: any) => mapToSelfTaskItem(t))

  let totalTokensDisbursed = 0
  let completedCount = 0
  const deptMap: Record<
    string,
    {
      departmentName: string
      totalTasks: number
      completedTasks: number
      tokensDisbursed: number
      facultySet: Set<string>
    }
  > = {}

  const flaggedTasks: Array<{ task: SelfTaskItem; reason: string }> = []

  allTasks.forEach((item) => {
    const isCompleted = item.taskStatus === "LEAD_SIGNED" || item.taskStatus === "CLOSED"
    if (isCompleted) {
      completedCount += 1
      totalTokensDisbursed += item.approvedCredits
    }

    const deptKey = item.departmentId || "unassigned"
    if (!deptMap[deptKey]) {
      deptMap[deptKey] = {
        departmentName: item.departmentName || "General",
        totalTasks: 0,
        completedTasks: 0,
        tokensDisbursed: 0,
        facultySet: new Set<string>(),
      }
    }

    deptMap[deptKey].totalTasks += 1
    deptMap[deptKey].facultySet.add(item.facultyId)
    if (isCompleted) {
      deptMap[deptKey].completedTasks += 1
      deptMap[deptKey].tokensDisbursed += item.approvedCredits
    }

    // Anti-favoritism transparency flags
    if (item.approvedCredits >= 5.0) {
      flaggedTasks.push({
        task: item,
        reason: `High Credit Allocation (≥ 5.0 WORK tokens). Verify objective milestones.`,
      })
    }
    if (isCompleted && !item.proofUrl && (!item.proofDescription || item.proofDescription.length < 20)) {
      flaggedTasks.push({
        task: item,
        reason: `Minimal or Missing Deliverable Proof attached upon verification.`,
      })
    }
  })

  const departmentBreakdown: Record<
    string,
    {
      departmentName: string
      totalTasks: number
      completedTasks: number
      tokensDisbursed: number
      facultyCount: number
    }
  > = {}

  Object.entries(deptMap).forEach(([k, v]) => {
    departmentBreakdown[k] = {
      departmentName: v.departmentName,
      totalTasks: v.totalTasks,
      completedTasks: v.completedTasks,
      tokensDisbursed: Number(v.tokensDisbursed.toFixed(2)),
      facultyCount: v.facultySet.size,
    }
  })

  return {
    summary: {
      totalProposals: allTasks.length,
      pendingProposals: allTasks.filter((t) => t.proposalStatus === "PENDING").length,
      activeInProgress: allTasks.filter((t) => t.taskStatus === "ASSIGNED").length,
      verifiedCompleted: completedCount,
      totalTokensDisbursed: Number(totalTokensDisbursed.toFixed(2)),
      averageTokensPerCompletedTask:
        completedCount > 0 ? Number((totalTokensDisbursed / completedCount).toFixed(2)) : 0,
      departmentBreakdown,
      flaggedTasks,
    },
    allTasks,
  }
}

function mapToSelfTaskItem(t: any, fallbackFacultyId?: string): SelfTaskItem {
  const cf = t.custom_fields || {}
  const proof = Array.isArray(t.task_proofs) && t.task_proofs[0] ? t.task_proofs[0] : null
  const proposed = Number(cf.proposed_credits || t.credit_value || 1.0)
  const approved = Number(cf.approved_credits || t.credit_value || proposed)

  return {
    id: t.id,
    title: t.title,
    description: cf.proposal_rationale || t.description || "",
    interestArea: (cf.interest_area || "ACADEMIC_INITIATIVE") as SelfTaskInterestArea,
    proposedCredits: proposed,
    approvedCredits: approved,
    facultyId: t.users?.id || fallbackFacultyId || "",
    facultyName: t.users?.name || "Faculty Member",
    facultyEmail: t.users?.email || "",
    facultyDesignation: t.users?.designation || null,
    departmentId: t.org_unit_id || t.users?.org_unit_id || "",
    departmentName: t.users?.org_units?.name || "Department",
    targetCompletionDate: cf.target_date || t.deadline || undefined,
    expectedDeliverable: cf.expected_deliverable || undefined,
    proposalStatus: (cf.proposal_status || (t.status === "DRAFT" ? "PENDING" : "APPROVED")) as any,
    taskStatus: t.status,
    hodApprovedBy: cf.hod_approved_by || undefined,
    hodApprovedByName: cf.hod_approved_by_name || undefined,
    hodApprovedAt: cf.hod_approved_at || undefined,
    hodApprovalComment: cf.hod_approval_comment || undefined,
    proofDescription: proof?.description || undefined,
    proofUrl: proof?.file_url || undefined,
    proofSubmittedAt: proof?.submitted_at || undefined,
    hodVerifiedBy: t.lead?.id || undefined,
    hodVerifiedByName: t.lead?.name || undefined,
    hodVerifiedAt: t.lead_signed_at || undefined,
    hodVerificationComment: cf.hod_verification_comment || undefined,
    createdAt: t.created_at,
  }
}

/**
 * Propose a self-task initiative with interest area.
 */
export async function proposeSelfTask(params: {
  organizationId: string
  facultyUserId: string
  title: string
  description: string
  areaOfInterest: string
  proposedCredits: number
  targetDate?: string
  deliverablePlan?: string
  orgUnitId?: string
}): Promise<{ success: boolean; task?: any; error?: string }> {
  try {
    const admin = createAdminClient()
    const db = admin as any
    const nowIso = new Date().toISOString()
    const taskTypeId = await getOrCreateDefaultTaskType(params.organizationId)

    let resolvedDeptId = params.orgUnitId
    if (!resolvedDeptId) {
      const { data: fallbackUnits } = await db
        .from("org_units")
        .select("id")
        .eq("organization_id", params.organizationId)
        .limit(1)
      resolvedDeptId = fallbackUnits?.[0]?.id
    }
    if (!resolvedDeptId) {
      return { success: false, error: "No academic department found for user." }
    }

    const credits = Math.max(0.5, parseFloat(String(params.proposedCredits)) || 2.0)

    const { data: inserted, error: insertError } = await db
      .from("tasks")
      .insert({
        organization_id: params.organizationId,
        org_unit_id: resolvedDeptId,
        task_type_id: taskTypeId,
        category: "UNSTRUCTURED",
        priority: "MEDIUM",
        title: params.title.trim(),
        description: params.description.trim(),
        credit_value: credits,
        creator_id: params.facultyUserId,
        assigned_to_id: params.facultyUserId,
        status: "DRAFT",
        visibility_scope: "ORG_UNIT",
        verification_mode: "MANUAL_REPORT",
        allow_nomination: false,
        deadline: params.targetDate ? `${params.targetDate.slice(0, 10)}T23:59:59.999Z` : null,
        custom_fields: {
          is_self_proposed: true,
          interest_area: params.areaOfInterest,
          proposed_credits: credits,
          proposal_rationale: params.description.trim(),
          proposal_status: "PENDING",
          target_date: params.targetDate || null,
          expected_deliverable: params.deliverablePlan?.trim() || null,
          submitted_at: nowIso,
        },
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }
    return { success: true, task: inserted }
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to propose self task" }
  }
}

/**
 * Review a self-task proposal (Approve or Reject).
 */
export async function reviewSelfTaskProposal(params: {
  taskId: string
  reviewerId: string
  reviewerName?: string
  action: "APPROVE" | "REJECT"
  approvedCredits?: number
  reviewNotes?: string
}): Promise<{ success: boolean; task?: any; error?: string }> {
  try {
    const admin = createAdminClient()
    const db = admin as any

    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, credit_value, org_unit_id, status, custom_fields")
      .eq("id", params.taskId)
      .single()

    if (taskErr || !task) {
      return { success: false, error: "Proposed task not found." }
    }

    const nowIso = new Date().toISOString()
    const cf = task.custom_fields || {}

    if (params.action === "REJECT") {
      const { data: updated, error: updateErr } = await db
        .from("tasks")
        .update({
          status: "CANCELLED",
          updated_at: nowIso,
          custom_fields: {
            ...cf,
            proposal_status: "REJECTED",
            hod_rejection_comment: params.reviewNotes || "Proposal declined by department head.",
            hod_reviewed_at: nowIso,
            hod_reviewed_by: params.reviewerId,
            hod_reviewed_by_name: params.reviewerName || "Department Head",
          },
        })
        .eq("id", params.taskId)
        .select()
        .single()

      if (updateErr) return { success: false, error: updateErr.message }
      return { success: true, task: updated }
    }

    const finalCredits = Math.max(0.5, parseFloat(String(params.approvedCredits)) || Number(task.credit_value) || 2.0)

    const { data: updated, error: updateErr } = await db
      .from("tasks")
      .update({
        status: "ASSIGNED",
        credit_value: finalCredits,
        updated_at: nowIso,
        custom_fields: {
          ...cf,
          proposal_status: "APPROVED",
          approved_credits: finalCredits,
          hod_approval_comment: params.reviewNotes || "Approved by Department Head. You may now commence work.",
          hod_approved_at: nowIso,
          hod_approved_by: params.reviewerId,
          hod_approved_by_name: params.reviewerName || "Department Head",
        },
      })
      .eq("id", params.taskId)
      .select()
      .single()

    if (updateErr) return { success: false, error: updateErr.message }
    return { success: true, task: updated }
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to review proposal" }
  }
}

/**
 * Submit deliverables for a self-task.
 */
export async function submitSelfTaskDeliverable(params: {
  taskId: string
  facultyUserId: string
  deliverableNotes?: string
  proofUrl?: string
}): Promise<{ success: boolean; task?: any; error?: string }> {
  try {
    const admin = createAdminClient()
    const db = admin as any

    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, assigned_to_id, status, custom_fields")
      .eq("id", params.taskId)
      .single()

    if (taskErr || !task) return { success: false, error: "Task not found." }

    const nowIso = new Date().toISOString()

    // Insert task_proofs
    await db.from("task_proofs").insert({
      task_id: params.taskId,
      user_id: params.facultyUserId,
      storage_provider: "SUPABASE",
      file_url: params.proofUrl?.trim() || null,
      description: params.deliverableNotes?.trim() || "Deliverables submitted for HOD verification.",
      submitted_at: nowIso,
    })

    const { data: updated, error: updateErr } = await db
      .from("tasks")
      .update({
        status: "VERIFICATION_PENDING",
        updated_at: nowIso,
        custom_fields: {
          ...(task.custom_fields || {}),
          proof_submitted_at: nowIso,
          proof_notes: params.deliverableNotes?.trim() || "",
        },
      })
      .eq("id", params.taskId)
      .select()
      .single()

    if (updateErr) return { success: false, error: updateErr.message }
    return { success: true, task: updated }
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to submit deliverable" }
  }
}

/**
 * Verify deliverables and disburse WORK tokens.
 */
export async function verifySelfTaskDeliverable(params: {
  taskId: string
  verifierId: string
  verifierName?: string
  action: "APPROVE" | "REJECT"
  feedback?: string
}): Promise<{ success: boolean; task?: any; disbursedCredits?: number; error?: string }> {
  try {
    const admin = createAdminClient()
    const db = admin as any

    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, credit_value, organization_id, org_unit_id, assigned_to_id, status, custom_fields")
      .eq("id", params.taskId)
      .single()

    if (taskErr || !task) return { success: false, error: "Task not found." }

    const facultyId = task.assigned_to_id
    if (!facultyId) return { success: false, error: "No faculty member assigned." }

    const nowIso = new Date().toISOString()
    const cf = task.custom_fields || {}

    if (params.action === "REJECT") {
      const { data: updated, error: updateErr } = await db
        .from("tasks")
        .update({
          status: "ASSIGNED",
          updated_at: nowIso,
          custom_fields: {
            ...cf,
            verification_status: "REVISION_REQUESTED",
            hod_verification_feedback: params.feedback || "Please revise deliverables as requested.",
          },
        })
        .eq("id", params.taskId)
        .select()
        .single()

      if (updateErr) return { success: false, error: updateErr.message }
      return { success: true, task: updated }
    }

    const ctx = await getOrgCycleContext(task.organization_id)
    const rewardAmount = Number(task.credit_value || cf.approved_credits || 2.0)
    const idempotencyKey = `self_task_verify_${task.id}_${facultyId}`

    const { data: updated, error: taskUpdateErr } = await db
      .from("tasks")
      .update({
        status: "LEAD_SIGNED",
        lead_signed_by: params.verifierId,
        lead_signed_at: nowIso,
        updated_at: nowIso,
        custom_fields: {
          ...cf,
          verification_status: "VERIFIED",
          hod_verification_feedback: params.feedback || "Deliverables verified and accepted.",
          hod_verified_at: nowIso,
          hod_verified_by: params.verifierId,
          hod_verified_by_name: params.verifierName || "Department Head",
        },
      })
      .eq("id", params.taskId)
      .select()
      .single()

    if (taskUpdateErr) return { success: false, error: taskUpdateErr.message }

    let cycleId = ctx?.activeWorkCycle?.id
    if (!cycleId) {
      const { data: cycles } = await db
        .from("work_cycles")
        .select("id")
        .eq("organization_id", task.organization_id)
        .order("created_at", { ascending: false })
        .limit(1)
      cycleId = cycles?.[0]?.id
    }

    if (cycleId) {
      const monthStart = ctx?.monthStart || `${nowIso.slice(0, 7)}-01`
      const { error: ledgerErr } = await db.from("credit_ledger_entries").upsert(
        {
          organization_id: task.organization_id,
          user_id: facultyId,
          work_cycle_id: cycleId,
          month_start: monthStart,
          credit_type: "UNSTRUCTURED_APPROVAL",
          amount: rewardAmount,
          source_entity_type: "tasks",
          source_entity_id: task.id,
          created_by: params.verifierId,
          metadata: {
            task_title: task.title,
            approver_name: params.verifierName || "Department Head",
            feedback: params.feedback || null,
            is_self_proposed: true,
          },
          idempotency_key: idempotencyKey,
        },
        { onConflict: "idempotency_key" }
      )

      if (ledgerErr) {
        console.warn("[verifySelfTaskDeliverable] ledger insert warning (idempotent):", ledgerErr.message)
      }
    }

    return { success: true, task: updated, disbursedCredits: rewardAmount }
  } catch (err: any) {
    return { success: false, error: err?.message || "Failed to verify deliverable" }
  }
}
