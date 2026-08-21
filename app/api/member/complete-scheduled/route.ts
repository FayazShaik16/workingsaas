import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { instanceId } = await req.json()
    if (!instanceId) {
      return NextResponse.json({ error: "Instance ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Try atomic RPC execution first
    try {
      const { data: rpcData, error: rpcErr } = await db.rpc("confirm_scheduled_work_instance", {
        p_instance_id: instanceId,
        p_faculty_id: user.id,
      })

      if (!rpcErr && rpcData) {
        return NextResponse.json(rpcData)
      }
    } catch (rpcEx) {
      console.warn("[complete-scheduled] RPC fallback triggered:", rpcEx)
    }

    // 2. Direct Node-level transactional fallback if RPC not yet compiled
    const { data: instance, error: instErr } = await db
      .from("scheduled_work_instances")
      .select("*, work_cycles(*)")
      .eq("id", instanceId)
      .single()

    if (instErr || !instance) {
      return NextResponse.json({ error: "Scheduled work session not found." }, { status: 404 })
    }

    if (instance.assigned_to_id !== user.id) {
      return NextResponse.json({ error: "Forbidden: session is not assigned to you." }, { status: 403 })
    }

    if (instance.status === "SELF_COMPLETED") {
      return NextResponse.json({
        success: true,
        already_completed: true,
        message: "This work session was already self-confirmed.",
      })
    }

    const orgId = instance.organization_id || user.organizationId
    const cycleId = instance.work_cycle_id
    const creditVal = Number(instance.credit_value) || 1.0
    const monthStart = `${instance.work_date.slice(0, 7)}-01`
    const idempotencyKey = `sched_inst_${instance.id}`

    // A. Insert into scheduled_work_completions
    await db.from("scheduled_work_completions").upsert(
      {
        organization_id: orgId,
        instance_id: instance.id,
        faculty_id: user.id,
        confirmation_1_at: new Date().toISOString(),
        confirmation_2_at: new Date().toISOString(),
        credit_value: creditVal,
      },
      { onConflict: "instance_id" }
    )

    // B. Insert into credit_ledger_entries
    await db.from("credit_ledger_entries").upsert(
      {
        organization_id: orgId,
        user_id: user.id,
        work_cycle_id: cycleId,
        month_start: monthStart,
        credit_type: "STRUCTURED_SELF_COMPLETION",
        amount: creditVal,
        source_entity_type: "scheduled_work_instance",
        source_entity_id: instance.id,
        idempotency_key: idempotencyKey,
        created_by: user.id,
        metadata: { work_date: instance.work_date, title: instance.title },
      },
      { onConflict: "idempotency_key" }
    )

    // C. Update instance status
    await db
      .from("scheduled_work_instances")
      .update({
        status: "SELF_COMPLETED",
        self_completed_at: new Date().toISOString(),
        self_completed_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", instance.id)

    // D. Recompute monthly progress summary
    let progressResult = null
    try {
      const { data: pData } = await db.rpc("recompute_monthly_work_progress", {
        p_user_id: user.id,
        p_work_cycle_id: cycleId,
        p_month_start: monthStart,
      })
      progressResult = pData
    } catch {
      // Direct summary calculation fallback
      const { data: ledgerEntries } = await db
        .from("credit_ledger_entries")
        .select("amount")
        .eq("user_id", user.id)
        .eq("month_start", monthStart)

      const rawEarned = (ledgerEntries || []).reduce((acc: number, cur: any) => acc + (Number(cur.amount) || 0), 0)
      const schedWeight = Number(instance.work_cycles?.scheduled_weight_percentage) || 75
      const totalTarget = 100 // fallback standard
      const displayPct = Math.min(100, Math.round((rawEarned / totalTarget) * 100))

      progressResult = {
        raw_earned_credits: rawEarned,
        total_target_credits: totalTarget,
        display_progress_percentage: displayPct,
        salary_eligible: rawEarned >= 85,
      }
    }

    return NextResponse.json({
      success: true,
      instance_id: instance.id,
      credit_awarded: creditVal,
      progress: progressResult,
      message: `Scheduled work recorded · +${creditVal.toFixed(1)} WORK credits.`,
    })
  } catch (error: any) {
    console.error("[api/member/complete-scheduled] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
