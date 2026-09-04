import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { getMemberMonthlyProgress } from "@/lib/workledger/progress"
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

    // 1. Fetch instance first to validate assignment, status, and prevent duplicate slot payouts
    const { data: instance, error: instErr } = await db
      .from("scheduled_work_instances")
      .select("*, work_cycles(*), scheduled_work_templates(title)")
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

    // 2. Guard: Prevent duplicate reward accumulation for overlapping time slots on the same date
    const { data: existingCompleted } = await db
      .from("scheduled_work_instances")
      .select("id, scheduled_start, scheduled_end, status")
      .eq("assigned_to_id", user.id)
      .eq("work_date", instance.work_date)
      .eq("status", "SELF_COMPLETED")
      .neq("id", instance.id)

    const hasTimeOverlap = (existingCompleted || []).some((other: any) => {
      const otherStart = new Date(other.scheduled_start).getTime()
      const otherEnd = new Date(other.scheduled_end).getTime()
      const instStart = new Date(instance.scheduled_start).getTime()
      const instEnd = new Date(instance.scheduled_end).getTime()

      if (!isNaN(otherStart) && !isNaN(otherEnd) && !isNaN(instStart) && !isNaN(instEnd)) {
        return otherStart < instEnd && instStart < otherEnd
      }
      return other.scheduled_start === instance.scheduled_start
    })

    if (hasTimeOverlap) {
      return NextResponse.json(
        {
          error: "A scheduled session for this exact or overlapping time slot has already been completed and rewarded. Duplicate completion rewards for the same time slot are prohibited.",
        },
        { status: 400 }
      )
    }

    // 3. Try atomic RPC execution first
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

    // 4. Direct Node-level transactional fallback if RPC not available

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
        metadata: { work_date: instance.work_date, title: instance.scheduled_work_templates?.title || "Scheduled Session" },
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

    // D. Credit personal wallet
    let { data: userWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("owner_user_id", user.id)
      .eq("purpose", "PERSONAL")
      .maybeSingle()

    if (!userWallet) {
      const { data: newW } = await db
        .from("wallets")
        .insert({
          organization_id: orgId,
          owner_user_id: user.id,
          purpose: "PERSONAL",
          balance: 0,
        })
        .select("id, balance")
        .single()
      userWallet = newW
    }

    if (userWallet?.id) {
      await db
        .from("wallets")
        .update({ balance: Number(userWallet.balance || 0) + creditVal })
        .eq("id", userWallet.id)
    }

    // E. Recompute monthly progress summary via unified service layer
    const progressResult = await getMemberMonthlyProgress(orgId, user.id, monthStart)

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
