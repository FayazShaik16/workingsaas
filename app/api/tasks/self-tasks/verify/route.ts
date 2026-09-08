import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { assertDepartmentScope } from "@/lib/workledger/permissions"
import { getOrgCycleContext } from "@/lib/workledger/current-cycle"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const scopes = user.scopeLevels || []
    if (!hasScope(scopes, "ORG_UNIT_LEAD") && !hasScope(scopes, "DIRECTOR") && !hasScope(scopes, "SYSTEM_ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden: Only Department Head or Director can verify self-tasks." },
        { status: 403 }
      )
    }

    const { taskId, decision = "APPROVE", comment } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch task
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, credit_value, organization_id, org_unit_id, assigned_to_id, status, custom_fields")
      .eq("id", taskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task record not found." }, { status: 404 })
    }

    if (task.status === "LEAD_SIGNED" || task.status === "CLOSED") {
      return NextResponse.json(
        { error: "This self-task has already been verified and rewarded." },
        { status: 400 }
      )
    }

    if (task.org_unit_id && hasScope(scopes, "ORG_UNIT_LEAD") && !hasScope(scopes, "DIRECTOR") && !hasScope(scopes, "SYSTEM_ADMIN")) {
      assertDepartmentScope(user, task.org_unit_id)
    }

    const facultyId = task.assigned_to_id
    if (!facultyId) {
      return NextResponse.json({ error: "No faculty member assigned to this task." }, { status: 400 })
    }

    const nowIso = new Date().toISOString()
    const cf = task.custom_fields || {}

    if (decision === "REJECT") {
      await db
        .from("tasks")
        .update({
          status: "ASSIGNED", // return to in-progress for revision
          updated_at: nowIso,
          custom_fields: {
            ...cf,
            verification_status: "REVISION_REQUESTED",
            hod_verification_feedback: comment || "Please revise deliverables as requested.",
          },
        })
        .eq("id", taskId)

      return NextResponse.json({
        success: true,
        message: "Deliverables returned to faculty member for revision.",
      })
    }

    // APPROVE & DISBURSE
    const ctx = await getOrgCycleContext(task.organization_id)
    const rewardAmount = Number(task.credit_value || cf.approved_credits || 2.0)
    const idempotencyKey = `self_task_verify_${task.id}_${facultyId}`

    // Check duplicate ledger entry
    const { data: existingLedger } = await db
      .from("credit_ledger_entries")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingLedger) {
      return NextResponse.json(
        { error: "Reward credits for this self-task have already been disbursed." },
        { status: 400 }
      )
    }

    // Update task to LEAD_SIGNED
    const { error: taskUpdateErr } = await db
      .from("tasks")
      .update({
        status: "LEAD_SIGNED",
        lead_signed_by: user.id,
        lead_signed_at: nowIso,
        updated_at: nowIso,
        custom_fields: {
          ...cf,
          verification_status: "VERIFIED",
          hod_verified_by: user.id,
          hod_verified_by_name: user.name,
          hod_verified_at: nowIso,
          hod_verification_comment: comment || "Deliverable verified by Department Head.",
        },
      })
      .eq("id", taskId)

    if (taskUpdateErr) {
      console.error("[tasks/self-tasks/verify] update error:", taskUpdateErr)
      return NextResponse.json({ error: taskUpdateErr.message }, { status: 500 })
    }

    // Disburse to credit_ledger_entries if cycle exists
    let cycleId = ctx.activeWorkCycle?.id
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
      const monthStart = ctx.monthStart || `${nowIso.slice(0, 7)}-01`
      await db.from("credit_ledger_entries").upsert(
        {
          organization_id: task.organization_id,
          work_cycle_id: cycleId,
          user_id: facultyId,
          month_start: monthStart,
          credit_type: "UNSTRUCTURED_APPROVAL",
          amount: rewardAmount,
          source_entity_type: "tasks",
          source_entity_id: task.id,
          created_by: user.id,
          idempotency_key: idempotencyKey,
          metadata: {
            task_title: task.title,
            approver_id: user.id,
            approver_name: user.name,
            interest_area: cf.interest_area,
            is_self_proposed: true,
            feedback: comment || null,
          },
        },
        { onConflict: "idempotency_key" }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Self-task "${task.title}" verified! +${rewardAmount} WORK tokens successfully credited to faculty wallet.`,
    })
  } catch (error: any) {
    console.error("[tasks/self-tasks/verify] uncaught:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
