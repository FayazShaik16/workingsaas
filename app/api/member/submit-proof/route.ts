import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, description, fileUrl, storageProvider } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 })
    }

    if (!description && !fileUrl) {
      return NextResponse.json(
        { error: "Please provide a description of the work completed or a deliverable file/URL." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch task to verify assignment
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, status, assigned_to_id, organization_id")
      .eq("id", taskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    if (task.assigned_to_id !== user.id) {
      return NextResponse.json(
        { error: "You can only submit deliverables for tasks assigned to you." },
        { status: 403 }
      )
    }

    const nowIso = new Date().toISOString()

    // 2. Insert proof record into task_proofs
    const { data: proof, error: proofErr } = await db
      .from("task_proofs")
      .insert({
        task_id: taskId,
        user_id: user.id,
        storage_provider: storageProvider || "SUPABASE",
        file_url: fileUrl || null,
        description: description || "Deliverable submitted for verification.",
        submitted_at: nowIso,
      })
      .select()
      .single()

    if (proofErr) {
      console.error("[member/submit-proof] insert error:", proofErr)
      return NextResponse.json({ error: `Failed to record proof: ${proofErr.message}` }, { status: 500 })
    }

    // 3. Transition task status to VERIFICATION_PENDING
    const { error: taskUpdateErr } = await db
      .from("tasks")
      .update({
        status: "VERIFICATION_PENDING",
        updated_at: nowIso,
      })
      .eq("id", taskId)

    if (taskUpdateErr) {
      console.error("[member/submit-proof] task status update error:", taskUpdateErr)
      return NextResponse.json({ error: `Failed to update task state: ${taskUpdateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Deliverable for "${task.title}" submitted successfully for Department Lead verification.`,
      proof,
    })
  } catch (error: any) {
    console.error("[member/submit-proof] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
