import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { assertDepartmentScope } from "@/lib/workledger/permissions"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { proofId, taskId, feedback, rejectionReason } = await req.json()

    if (!proofId && !taskId) {
      return NextResponse.json({ error: "Either proofId or taskId is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const nowIso = new Date().toISOString()
    const reason = feedback || rejectionReason || "Returned for revision"

    let targetTaskId = taskId

    if (proofId) {
      const { data: proof } = await db
        .from("task_proofs")
        .select("id, task_id, tasks:task_id(org_unit_id)")
        .eq("id", proofId)
        .single()

      if (proof) {
        const taskData = proof.tasks as any
        if (taskData?.org_unit_id) {
          assertDepartmentScope(user, taskData.org_unit_id)
        }
        targetTaskId = proof.task_id
      }
    }

    if (targetTaskId) {
      const { data: task } = await db
        .from("tasks")
        .select("id, org_unit_id")
        .eq("id", targetTaskId)
        .single()

      if (task?.org_unit_id) {
        assertDepartmentScope(user, task.org_unit_id)
      }

      // 1. Reset task status back to IN_PROGRESS so faculty can resubmit
      await db
        .from("tasks")
        .update({
          status: "IN_PROGRESS",
          updated_at: nowIso,
        })
        .eq("id", targetTaskId)

      // 2. Record rejection in task_peer_reviews
      try {
        await db.from("task_peer_reviews").upsert(
          {
            task_id: targetTaskId,
            reviewer_id: user.id,
            decision: "REJECT",
            comment: reason,
            reviewed_at: nowIso,
          },
          { onConflict: "task_id,reviewer_id" }
        )
      } catch (e: any) {
        console.warn("[reject-proof] Peer review log note:", e?.message)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Initiative proof returned for revision.",
    })
  } catch (error: any) {
    console.error("[reject-proof] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.statusCode || 500 }
    )
  }
}
