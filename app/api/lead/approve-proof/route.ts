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

    const { proofId, taskId, feedback } = await req.json()

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
        .select("id, task_id, submitted_by, status, tasks(id, credit_value, org_unit_id, title)")
        .eq("id", proofId)
        .single()

      if (proofErr || !proof) {
        return NextResponse.json({ error: "Proof submission not found." }, { status: 404 })
      }

      // Enforce department isolation
      assertDepartmentScope(user, proof.tasks?.org_unit_id)

      targetTaskId = proof.task_id
      targetProofId = proof.id
      facultyId = proof.submitted_by
    } else if (taskId) {
      const { data: task, error: taskErr } = await db
        .from("tasks")
        .select("id, credit_value, org_unit_id, assigned_to_id, title")
        .eq("id", taskId)
        .single()

      if (taskErr || !task) {
        return NextResponse.json({ error: "Task not found." }, { status: 404 })
      }

      // Enforce department isolation
      assertDepartmentScope(user, task.org_unit_id)
      facultyId = task.assigned_to_id
    }

    // Fetch the task details
    const { data: task } = await db
      .from("tasks")
      .select("id, title, credit_value, organization_id, assigned_to_id")
      .eq("id", targetTaskId)
      .single()

    if (!task) {
      return NextResponse.json({ error: "Task record not found." }, { status: 404 })
    }

    facultyId = facultyId || task.assigned_to_id
    if (!facultyId) {
      return NextResponse.json({ error: "No faculty member assigned to this task." }, { status: 400 })
    }

    const ctx = await getOrgCycleContext(task.organization_id)
    const creditAmount = Number(task.credit_value || 1.0)
    const nowIso = new Date().toISOString()
    const idempotencyKey = `adhoc_proof_${targetProofId || targetTaskId}_${facultyId}`

    // 1. Update proof status if proof exists
    if (targetProofId) {
      await db
        .from("task_proofs")
        .update({
          status: "APPROVED",
          reviewer_id: user.id,
          reviewer_notes: feedback || null,
          reviewed_at: nowIso,
          updated_at: nowIso,
        })
        .eq("id", targetProofId)
    }

    // 2. Update task status to COMPLETED
    await db
      .from("tasks")
      .update({
        status: "COMPLETED",
        lead_signed_by: user.id,
        lead_signed_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", targetTaskId)

    // 3. Insert idempotent credit ledger entry
    const { error: ledgerErr } = await db.from("credit_ledger_entries").upsert(
      {
        organization_id: task.organization_id,
        work_cycle_id: ctx.activeWorkCycle?.id || null,
        user_id: facultyId,
        credit_type: "UNSCHEDULED_APPROVAL",
        credit_amount: creditAmount,
        reference_id: targetTaskId,
        idempotency_key: idempotencyKey,
        occurred_at: nowIso,
        metadata: {
          title: task.title,
          proof_id: targetProofId || null,
          feedback: feedback || null,
          approved_by: user.id,
        },
      },
      { onConflict: "idempotency_key" }
    )

    if (ledgerErr) {
      console.error("[approve-proof] ledger error:", ledgerErr)
    }

    // 4. Recompute progress
    const updatedProgress = await getMemberMonthlyProgress(task.organization_id, facultyId, ctx.monthStart)

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
