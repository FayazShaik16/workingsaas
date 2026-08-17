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

    const { taskId, comment } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any

    // Verify task exists
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, status, organization_id, credit_value")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Execute workflow transition: to CLOSED or LEAD_SIGNED
    const result = await executeWorkflowTransition("tasks", taskId, "CLOSED", user.id)

    if (!result.success) {
      return NextResponse.json({ error: "Transition failed" }, { status: 400 })
    }

    // Record lead sign-off timestamp
    await db
      .from("tasks")
      .update({
        status: "CLOSED",
        updated_at: new Date().toISOString(),
      })
      .eq("id", taskId)

    return NextResponse.json({
      success: true,
      message: "Task approved and credits awarded",
    })
  } catch (error) {
    console.error("Approve proof error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    )
  }
}
