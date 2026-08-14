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

    // Verify task exists and is in VERIFICATION_PENDING status
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id, status, organization_id, credit_value")
      .eq("id", taskId)
      .single()

    if (taskError || !task || task.status !== "VERIFICATION_PENDING") {
      return NextResponse.json({ error: "Task not found or not in verification status" }, { status: 404 })
    }

    // Verify user has lead scope in this org
    const { data: userRole } = await supabase
      .from("users")
      .select("scope_levels")
      .eq("id", user.id)
      .single()

    if (!userRole?.scope_levels?.includes("ORG_UNIT_LEAD")) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Execute workflow transition: VERIFICATION_PENDING → LEAD_SIGNED
    const result = await executeWorkflowTransition(
      supabase,
      {
        taskId,
        fromState: "VERIFICATION_PENDING",
        toState: "LEAD_SIGNED",
        actorId: user.id,
        organizationId: task.organization_id,
      }
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Transition failed" }, { status: 400 })
    }

    // Record lead sign-off timestamp
    const { error: updateError } = await supabase
      .from("tasks")
      .update({
        lead_signed_by: user.id,
        lead_signed_at: new Date().toISOString(),
      })
      .eq("id", taskId)

    if (updateError) {
      console.error("Error updating task sign-off:", updateError)
    }

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
