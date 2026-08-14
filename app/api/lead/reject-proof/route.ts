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

    // Verify task exists and is in VERIFICATION_PENDING status
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status, organization_id, assigned_to_id")
      .eq("id", taskId)
      .single()

    if (taskError || !task || task.status !== "VERIFICATION_PENDING") {
      return NextResponse.json({ error: "Task not found or not in verification status" }, { status: 404 })
    }

    // Verify user has lead scope
    const { data: userRole } = await supabase
      .from("users")
      .select("scope_levels")
      .eq("id", user.id)
      .single()

    if (!userRole?.scope_levels?.includes("ORG_UNIT_LEAD")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Execute workflow transition: VERIFICATION_PENDING → IN_PROGRESS (back to work)
    const result = await executeWorkflowTransition(
      supabase,
      {
        taskId,
        fromState: "VERIFICATION_PENDING",
        toState: "IN_PROGRESS",
        actorId: user.id,
        organizationId: task.organization_id,
      }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Transition failed" }, { status: 400 })
    }

    // Optionally delete the proof submission so user can resubmit
    await supabase.from("task_proofs").delete().eq("task_id", taskId)

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
