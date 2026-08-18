import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { executeWorkflowTransition } from "@/lib/rpc/workflow"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, rejectionReason } = await req.json()

    if (!taskId || !rejectionReason) {
      return NextResponse.json({ error: "Task ID and rejection reason required" }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any

    // Verify task exists
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, status, organization_id, assigned_to_id")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Execute workflow transition: back to ASSIGNED / IN_PROGRESS
    const result = await executeWorkflowTransition("tasks", taskId, "ASSIGNED", user.id)

    if (!result.success) {
      return NextResponse.json({ error: "Transition failed" }, { status: 400 })
    }

    await db
      .from("tasks")
      .update({
        status: "ASSIGNED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)

    return NextResponse.json({
      success: true,
      message: "Task returned to in-progress status",
    })
  } catch (error) {
    console.error("Reject proof error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
