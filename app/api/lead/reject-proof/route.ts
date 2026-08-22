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

    const { proofId, taskId, feedback } = await req.json()

    if (!proofId && !taskId) {
      return NextResponse.json({ error: "Either proofId or taskId is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const nowIso = new Date().toISOString()

    if (proofId) {
      const { data: proof } = await db
        .from("task_proofs")
        .select("id, task_id, tasks(org_unit_id)")
        .eq("id", proofId)
        .single()

      if (proof) {
        assertDepartmentScope(user, proof.tasks?.org_unit_id)
        await db
          .from("task_proofs")
          .update({
            status: "REJECTED",
            reviewer_id: user.id,
            reviewer_notes: feedback || "Returned for revision",
            reviewed_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", proofId)
      }
    }

    const targetTaskId = taskId || (proofId ? (await db.from("task_proofs").select("task_id").eq("id", proofId).single()).data?.task_id : null)

    if (targetTaskId) {
      await db
        .from("tasks")
        .update({
          status: "IN_PROGRESS",
          updated_at: nowIso,
        })
        .eq("id", targetTaskId)
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
