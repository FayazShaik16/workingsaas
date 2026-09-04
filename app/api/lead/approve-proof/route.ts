import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { getMemberMonthlyProgress } from "@/lib/workledger/progress"
import { getOrgCycleContext } from "@/lib/workledger/current-cycle"
import { assertDepartmentScope } from "@/lib/workledger/permissions"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { proofId, taskId, feedback, comment } = await req.json()

    if (!proofId && !taskId) {
      return NextResponse.json({ error: "Either proofId or taskId is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    let targetTaskId = taskId
    let targetProofId = proofId
    let facultyId: string | null = null

    // If proofId is passed, look up proof record
    if (proofId) {
      const { data: proof, error: proofErr } = await db
        .from("task_proofs")
        .select("id, task_id, user_id, tasks:task_id(id, credit_value, org_unit_id, title, assigned_to_id)")
        .eq("id", proofId)
        .single()

      if (proofErr || !proof) {
        return NextResponse.json({ error: "Proof submission not found." }, { status: 404 })
      }

      const taskData = proof.tasks as any
      if (taskData?.org_unit_id) {
        assertDepartmentScope(user, taskData.org_unit_id)
      }

      targetTaskId = proof.task_id
      targetProofId = proof.id
      facultyId = proof.user_id || taskData?.assigned_to_id
    }

    // Fetch the task details
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, credit_value, organization_id, org_unit_id, assigned_to_id, status, lead_signed_at")
      .eq("id", targetTaskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task record not found." }, { status: 404 })
    }

    if (task.status === "LEAD_SIGNED" || task.status === "CLOSED" || task.lead_signed_at) {
      return NextResponse.json(
        {
          error: `Task "${task.title}" has already been approved and signed off. Duplicate reward disbursements are prohibited.`,
        },
        { status: 400 }
      )
    }

    if (task.org_unit_id) {
      assertDepartmentScope(user, task.org_unit_id)
    }

    facultyId = facultyId || task.assigned_to_id
    if (!facultyId) {
      return NextResponse.json({ error: "No faculty member assigned to this task." }, { status: 400 })
    }

    const ctx = await getOrgCycleContext(task.organization_id)
    const creditAmount = Number(task.credit_value || 1.0)
    const nowIso = new Date().toISOString()
    const reviewFeedback = feedback || comment || "Task deliverable approved by Department Lead"
    const idempotencyKey = `adhoc_proof_${targetProofId || targetTaskId}_${facultyId}`

    // Check if rewards were already disbursed via ledger
    const { data: existingLedger } = await db
      .from("credit_ledger_entries")
      .select("id")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle()

    if (existingLedger) {
      return NextResponse.json(
        {
          error: `Reward credits for task "${task.title}" have already been disbursed to the faculty wallet.`,
        },
        { status: 400 }
      )
    }

    // 1. Record decision in task_peer_reviews
    try {
      await db.from("task_peer_reviews").upsert(
        {
          task_id: targetTaskId,
          reviewer_id: user.id,
          decision: "APPROVE",
          comment: reviewFeedback,
          reviewed_at: nowIso,
        },
        { onConflict: "task_id,reviewer_id" }
      )
    } catch (e: any) {
      console.warn("[approve-proof] Peer review log note:", e?.message)
    }

    // 2. Update task status to LEAD_SIGNED
    const { error: taskUpdateErr } = await db
      .from("tasks")
      .update({
        status: "LEAD_SIGNED",
        lead_signed_by: user.id,
        lead_signed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", targetTaskId)

    if (taskUpdateErr) {
      console.error("[approve-proof] task update error:", taskUpdateErr)
      return NextResponse.json({ error: `Failed to update task: ${taskUpdateErr.message}` }, { status: 500 })
    }

    // 3. Insert idempotent credit ledger entry
    if (ctx.activeWorkCycle?.id) {
      const { error: ledgerErr } = await db.from("credit_ledger_entries").upsert(
        {
          organization_id: task.organization_id,
          work_cycle_id: ctx.activeWorkCycle.id,
          user_id: facultyId,
          month_start: ctx.monthStart,
          credit_type: "UNSTRUCTURED_APPROVAL",
          amount: creditAmount,
          source_entity_type: "tasks",
          source_entity_id: targetTaskId,
          idempotency_key: idempotencyKey,
          created_by: user.id,
          metadata: {
            title: task.title,
            proof_id: targetProofId || null,
            feedback: reviewFeedback,
            approved_by: user.id,
          },
        },
        { onConflict: "idempotency_key" }
      )

      if (ledgerErr) {
        console.error("[approve-proof] ledger error:", ledgerErr)
      }
    }

    // 4. Disburse credits to faculty PERSONAL wallet
    let { data: wallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("owner_user_id", facultyId)
      .eq("purpose", "PERSONAL")
      .maybeSingle()

    if (!wallet) {
      const { data: newWallet } = await db
        .from("wallets")
        .insert({
          organization_id: task.organization_id,
          owner_user_id: facultyId,
          purpose: "PERSONAL",
          balance: 0,
        })
        .select("id, balance")
        .single()
      wallet = newWallet
    }

    if (wallet?.id) {
      await db
        .from("wallets")
        .update({ balance: Number(wallet.balance || 0) + creditAmount })
        .eq("id", wallet.id)
    }

    // 5. Recompute progress
    let updatedProgress = null
    try {
      updatedProgress = await getMemberMonthlyProgress(task.organization_id, facultyId, ctx.monthStart)
    } catch {
      // ignore
    }

    return NextResponse.json({
      success: true,
      message: `Task proof approved and ${creditAmount.toFixed(1)} WORK credits awarded to faculty member.`,
      creditAmount,
      updatedProgress,
    })
  } catch (error: any) {
    console.error("[approve-proof] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.statusCode || 500 }
    )
  }
}
