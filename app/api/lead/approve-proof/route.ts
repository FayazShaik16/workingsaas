import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, comment } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Try atomic RPC execution first
    try {
      const { data: rpcData, error: rpcErr } = await db.rpc("approve_adhoc_task_and_award_credit", {
        p_task_id: taskId,
        p_reviewer_id: user.id,
      })

      if (!rpcErr && rpcData) {
        return NextResponse.json(rpcData)
      }
    } catch (rpcEx) {
      console.warn("[approve-proof] RPC fallback triggered:", rpcEx)
    }

    // 2. Direct transactional fallback
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, status, organization_id, credit_value, assigned_to_id, title")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const orgId = task.organization_id || user.organizationId
    const facultyId = task.assigned_to_id
    const creditReward = Number(task.credit_value || 1.0)
    const nowIso = new Date().toISOString()
    const monthStart = `${nowIso.slice(0, 7)}-01`

    // Update task status to CLOSED
    await db
      .from("tasks")
      .update({
        status: "CLOSED",
        lead_signed_by: user.id,
        lead_signed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", taskId)

    // Write to credit_ledger_entries
    if (facultyId) {
      const { data: cycle } = await db
        .from("work_cycles")
        .select("id")
        .eq("organization_id", orgId)
        .eq("status", "ACTIVE")
        .limit(1)
        .maybeSingle()

      const cycleId = cycle?.id || null

      if (cycleId) {
        await db.from("credit_ledger_entries").upsert(
          {
            organization_id: orgId,
            user_id: facultyId,
            work_cycle_id: cycleId,
            month_start: monthStart,
            credit_type: "UNSTRUCTURED_APPROVAL",
            amount: creditReward,
            source_entity_type: "task",
            source_entity_id: task.id,
            idempotency_key: `adhoc_task_${task.id}`,
            created_by: user.id,
            metadata: { title: task.title, comment: comment || null },
          },
          { onConflict: "idempotency_key" }
        )

        // Recompute progress
        await db.rpc("recompute_monthly_work_progress", {
          p_user_id: facultyId,
          p_work_cycle_id: cycleId,
          p_month_start: monthStart,
        }).catch(() => {})
      }
    }

    return NextResponse.json({
      success: true,
      creditAwarded: creditReward,
      message: `Task "${task.title}" approved and +${creditReward.toFixed(1)} WORK credits awarded in ledger.`,
    })
  } catch (error: any) {
    console.error("Approve proof error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
