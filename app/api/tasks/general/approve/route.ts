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
    if (
      !hasScope(scopes, "ORG_UNIT_LEAD") &&
      !hasScope(scopes, "DIRECTOR") &&
      !hasScope(scopes, "SYSTEM_ADMIN") &&
      !hasScope(scopes, "DEPT_ADMIN")
    ) {
      return NextResponse.json({ error: "Forbidden: Higher authority role required." }, { status: 403 })
    }

    const { logTaskId, decision = "APPROVE", comment } = await req.json()

    if (!logTaskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch the logged general task
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, credit_value, organization_id, org_unit_id, assigned_to_id, status, custom_fields")
      .eq("id", logTaskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: "Logged session record not found." }, { status: 404 })
    }

    if (task.status === "LEAD_SIGNED" || task.status === "CLOSED") {
      return NextResponse.json(
        { error: "This general task session has already been approved and credited." },
        { status: 400 }
      )
    }

    // Check department scope if user is HOD
    if (task.org_unit_id && hasScope(scopes, "ORG_UNIT_LEAD") && !hasScope(scopes, "DIRECTOR") && !hasScope(scopes, "SYSTEM_ADMIN")) {
      assertDepartmentScope(user, task.org_unit_id)
    }

    const facultyId = task.assigned_to_id
    if (!facultyId) {
      return NextResponse.json({ error: "No faculty member associated with this log." }, { status: 400 })
    }

    const nowIso = new Date().toISOString()

    if (decision === "REJECT") {
      await db
        .from("tasks")
        .update({
          status: "REJECTED",
          updated_at: nowIso,
          custom_fields: {
            ...(task.custom_fields || {}),
            rejection_reason: comment || "Rejected by department administrator",
          },
        })
        .eq("id", logTaskId)

      return NextResponse.json({ success: true, message: "General task session rejected." })
    }

    // APPROVE flow:
    const ctx = await getOrgCycleContext(task.organization_id)
    const creditAmount = Number(task.credit_value || 0.5)
    const idempotencyKey = `general_task_${task.id}_${facultyId}`

    // Check duplicate ledger disbursement
    const { data: existingLedger } = await db
      .from("credit_ledger_entries")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingLedger) {
      return NextResponse.json({ error: "Reward credits for this session have already been disbursed." }, { status: 400 })
    }

    // Update task status to LEAD_SIGNED
    const { error: updateErr } = await db
      .from("tasks")
      .update({
        status: "LEAD_SIGNED",
        lead_signed_by: user.id,
        lead_signed_at: nowIso,
        updated_at: nowIso,
        custom_fields: {
          ...(task.custom_fields || {}),
          approval_notes: comment || "Approved by authority for productivity accounting",
        },
      })
      .eq("id", logTaskId)

    if (updateErr) {
      console.error("[tasks/general/approve] update error:", updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    // Disburse to credit_ledger_entries if active work cycle exists
    if (ctx.activeWorkCycle?.id) {
      await db.from("credit_ledger_entries").upsert(
        {
          organization_id: task.organization_id,
          work_cycle_id: ctx.activeWorkCycle.id,
          user_id: facultyId,
          month_start: ctx.monthStart,
          entry_type: "CREDIT",
          amount: creditAmount,
          reason: `General Task Productivity: ${task.title}`,
          idempotency_key: idempotencyKey,
          task_id: task.id,
          metadata: {
            task_title: task.title,
            approver_id: user.id,
            duration_hours: task.custom_fields?.duration_hours,
            is_general_task: true,
          },
          created_at: nowIso,
        },
        { onConflict: "idempotency_key" }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Session approved! +${creditAmount} WORK tokens successfully credited to faculty wallet.`,
    })
  } catch (error: any) {
    console.error("[tasks/general/approve] uncaught:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
