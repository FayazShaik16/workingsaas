import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, description, fileUrl } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 })
    }

    if (!description?.trim() && !fileUrl?.trim()) {
      return NextResponse.json(
        { error: "Please provide deliverable notes or an evidence link for your completed initiative." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch task and ensure ownership
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, assigned_to_id, status, custom_fields")
      .eq("id", taskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    if (task.assigned_to_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only submit deliverables for your own self-proposed tasks." },
        { status: 403 }
      )
    }

    const nowIso = new Date().toISOString()

    // 2. Insert proof record
    const { error: proofErr } = await db.from("task_proofs").insert({
      task_id: taskId,
      user_id: user.id,
      storage_provider: "SUPABASE",
      file_url: fileUrl?.trim() || null,
      description: description?.trim() || "Deliverables submitted for HOD verification.",
      submitted_at: nowIso,
    })

    if (proofErr) {
      console.error("[tasks/self-tasks/submit-deliverable] proof error:", proofErr)
      return NextResponse.json({ error: proofErr.message }, { status: 500 })
    }

    // 3. Update task status to VERIFICATION_PENDING
    const { error: updateErr } = await db
      .from("tasks")
      .update({
        status: "VERIFICATION_PENDING",
        updated_at: nowIso,
        custom_fields: {
          ...(task.custom_fields || {}),
          proof_submitted_at: nowIso,
          proof_notes: description?.trim() || "",
        },
      })
      .eq("id", taskId)

    if (updateErr) {
      console.error("[tasks/self-tasks/submit-deliverable] status update error:", updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Deliverables submitted for "${task.title}"! Pending HOD verification and reward credit.`,
    })
  } catch (error: any) {
    console.error("[tasks/self-tasks/submit-deliverable] uncaught:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
