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

    const scopes = user.scopeLevels || []
    if (!hasScope(scopes, "ORG_UNIT_LEAD") && !hasScope(scopes, "DIRECTOR") && !hasScope(scopes, "SYSTEM_ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden: Only Department Head or Director can review self-task proposals." },
        { status: 403 }
      )
    }

    const { taskId, decision = "APPROVE", approvedCredits, comment } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch task
    const { data: task, error: taskErr } = await db
      .from("tasks")
      .select("id, title, credit_value, org_unit_id, status, custom_fields")
      .eq("id", taskId)
      .single()

    if (taskErr || !task) {
      return NextResponse.json({ error: "Proposed task not found." }, { status: 404 })
    }

    // Verify department scope
    if (task.org_unit_id && hasScope(scopes, "ORG_UNIT_LEAD") && !hasScope(scopes, "DIRECTOR") && !hasScope(scopes, "SYSTEM_ADMIN")) {
      assertDepartmentScope(user, task.org_unit_id)
    }

    const nowIso = new Date().toISOString()
    const cf = task.custom_fields || {}

    if (decision === "REJECT") {
      await db
        .from("tasks")
        .update({
          status: "CANCELLED",
          updated_at: nowIso,
          custom_fields: {
            ...cf,
            proposal_status: "REJECTED",
            hod_rejection_comment: comment || "Proposal declined by department head.",
            hod_reviewed_at: nowIso,
            hod_reviewed_by: user.id,
            hod_reviewed_by_name: user.name,
          },
        })
        .eq("id", taskId)

      return NextResponse.json({
        success: true,
        message: `Self-task proposal "${task.title}" has been declined.`,
      })
    }

    // APPROVE
    const finalCredits = Math.max(0.5, parseFloat(String(approvedCredits)) || Number(task.credit_value) || 2.0)

    const { error: updateErr } = await db
      .from("tasks")
      .update({
        status: "ASSIGNED",
        credit_value: finalCredits,
        updated_at: nowIso,
        custom_fields: {
          ...cf,
          proposal_status: "APPROVED",
          approved_credits: finalCredits,
          hod_approval_comment: comment || "Approved by Department Head. You may now commence work.",
          hod_approved_at: nowIso,
          hod_approved_by: user.id,
          hod_approved_by_name: user.name,
        },
      })
      .eq("id", taskId)

    if (updateErr) {
      console.error("[tasks/self-tasks/review-proposal] update error:", updateErr)
      return NextResponse.json({ error: updateErr.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      approvedCredits: finalCredits,
      message: `Proposal "${task.title}" approved! The faculty member can now execute and submit deliverables for ${finalCredits} WORK tokens.`,
    })
  } catch (error: any) {
    console.error("[tasks/self-tasks/review-proposal] uncaught:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
