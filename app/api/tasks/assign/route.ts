import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { assertDepartmentScope } from "@/lib/workledger/permissions"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, facultyId, assigneeId, nominationId } = await req.json()
    const targetFacultyId = facultyId || assigneeId

    if (!taskId || !targetFacultyId) {
      return NextResponse.json(
        { error: "Both taskId and facultyId are required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch task
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, title, organization_id, org_unit_id, visibility_scope, status")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    // 2. Enforce department isolation
    assertDepartmentScope(user, task.org_unit_id)

    // 3. Fetch target faculty to ensure they belong to permitted department
    const { data: facultyUser, error: facultyErr } = await db
      .from("users")
      .select("id, name, org_unit_id, organization_id")
      .eq("id", targetFacultyId)
      .single()

    if (facultyErr || !facultyUser) {
      return NextResponse.json({ error: "Assigned faculty member not found." }, { status: 404 })
    }

    if (task.visibility_scope === "ORG_UNIT" && task.org_unit_id) {
      if (facultyUser.org_unit_id !== task.org_unit_id) {
        return NextResponse.json(
          { error: "Cannot assign a department task to a faculty member outside the department." },
          { status: 400 }
        )
      }
    }

    const nowIso = new Date().toISOString()

    // 4. Update task assignment
    const { data: updatedTask, error: updateErr } = await db
      .from("tasks")
      .update({
        assigned_to_id: targetFacultyId,
        assigned_by_id: user.id,
        status: "ASSIGNED",
        updated_at: nowIso,
      })
      .eq("id", taskId)
      .select()
      .single()

    if (updateErr) {
      console.error("[tasks/assign] update error:", updateErr)
      return NextResponse.json({ error: `Failed to assign task: ${updateErr.message}` }, { status: 500 })
    }

    // 5. Update nomination states if applicable
    await db
      .from("nominations")
      .update({ status: "ACCEPTED" })
      .eq("task_id", taskId)
      .eq("user_id", targetFacultyId)

    await db
      .from("nominations")
      .update({ status: "REJECTED" })
      .eq("task_id", taskId)
      .neq("user_id", targetFacultyId)

    return NextResponse.json({
      success: true,
      task: updatedTask,
      message: `Task "${task.title}" successfully assigned to ${facultyUser.name}.`,
    })
  } catch (error: any) {
    console.error("[tasks/assign] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.statusCode || 500 }
    )
  }
}
