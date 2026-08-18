import { createClient } from "@/lib/supabase/server"
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

    const supabase = await createClient()
    const db = supabase as any
    const orgId = user.organizationId

    // 1. Fetch task to verify it is OPEN
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, title, creator_id, organization_id, status")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    if (task.status !== "OPEN") {
      return NextResponse.json(
        { error: "This task is no longer open for nominations." },
        { status: 400 }
      )
    }

    // 2. Upsert application into task_applications
    const { data: application, error: appError } = await db
      .from("task_applications")
      .upsert(
        {
          organization_id: task.organization_id || orgId,
          task_id: taskId,
          user_id: user.id,
          pitch_note: pitchNote || "I would like to volunteer for this task.",
          status: "PENDING",
          created_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id,task_id,user_id",
        }
      )
      .select()
      .single()

    if (appError) {
      // Fallback without conflict clause
      const { data: fallbackApp, error: fallbackErr } = await db
        .from("task_applications")
        .insert({
          organization_id: task.organization_id || orgId,
          task_id: taskId,
          user_id: user.id,
          pitch_note: pitchNote || "I would like to volunteer for this task.",
          status: "PENDING",
        })
        .select()
        .single()

      if (fallbackErr) throw fallbackErr
    }

    return NextResponse.json({
      success: true,
      message: `Self-nomination for "${task.title}" submitted successfully. The task coordinator has been notified.`,
    })
  } catch (error: any) {
    console.error("[tasks/nominate] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
