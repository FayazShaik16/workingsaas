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

    const { nominationId, taskId, userId } = await req.json()

    if (!nominationId && (!taskId || !userId)) {
      return NextResponse.json(
        { error: "nominationId or (taskId and userId) is required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    // Fetch nomination and task to verify department scope
    let query = db.from("nominations").select("id, task_id, user_id, tasks(id, org_unit_id, organization_id, title)")
    if (nominationId) {
      query = query.eq("id", nominationId)
    } else {
      query = query.eq("task_id", taskId).eq("user_id", userId)
    }

    const { data: nom, error: nomError } = await query.maybeSingle()

    if (nomError || !nom) {
      return NextResponse.json({ error: "Nomination record not found." }, { status: 404 })
    }

    const task = nom.tasks as any
    if (task?.org_unit_id) {
      assertDepartmentScope(user, task.org_unit_id)
    }

    const { error: updateErr } = await db
      .from("nominations")
      .update({ status: "REJECTED", updated_at: new Date().toISOString() })
      .eq("id", nom.id)

    if (updateErr) {
      return NextResponse.json({ error: `Failed to reject nomination: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Nomination for "${task?.title || "task"}" rejected.`,
    })
  } catch (error: any) {
    console.error("[tasks/reject-nomination] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.statusCode || 500 }
    )
  }
}
