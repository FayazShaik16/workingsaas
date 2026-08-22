import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, pitchNote } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch task to verify it is OPEN and allow_nomination is true
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, title, organization_id, status, allow_nomination, visibility_scope, org_unit_id")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    if (task.status !== "OPEN") {
      return NextResponse.json(
        { error: "This task is no longer open for self-nomination." },
        { status: 400 }
      )
    }

    if (task.allow_nomination === false) {
      return NextResponse.json(
        { error: "Self-nomination is disabled for this task." },
        { status: 400 }
      )
    }

    // 2. Department isolation check
    if (task.visibility_scope === "ORG_UNIT" && task.org_unit_id) {
      if (user.orgUnitId !== task.org_unit_id) {
        return NextResponse.json(
          { error: "You can only self-nominate for tasks within your department." },
          { status: 403 }
        )
      }
    }

    const nowIso = new Date().toISOString()

    // 3. Upsert nomination record idempotently
    const { data: nomination, error: nomError } = await db
      .from("nominations")
      .upsert(
        {
          task_id: taskId,
          user_id: user.id,
          status: "PENDING",
          message: pitchNote || "I would like to volunteer for this task.",
        },
        { onConflict: "task_id,user_id" }
      )
      .select()
      .single()

    if (nomError) {
      console.error("[tasks/nominate] nomination error:", nomError)
      return NextResponse.json({ error: `Failed to record nomination: ${nomError.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      nomination,
      message: `Self-nomination for "${task.title}" submitted successfully.`,
    })
  } catch (error: any) {
    console.error("[tasks/nominate] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
