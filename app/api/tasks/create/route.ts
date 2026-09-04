import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { getOrCreateDefaultTaskType } from "@/lib/workledger/default-task-type"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const {
      title,
      description,
      creditValue,
      credit_value,
      priority = "MEDIUM",
      orgUnitId,
      visibilityScope = "ORGANIZATION",
      targetOrgUnitIds = [],
      deadline,
      assignedToId,
      verificationMode = "MANUAL_REPORT",
      allowNomination = true,
    } = await req.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 })
    }

    const rawCredits = creditValue ?? credit_value
    const credits = parseFloat(rawCredits) || 1.0
    const validPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM"
    const validVerificationMode = verificationMode === "FILE_SUBMISSION" ? "FILE_SUBMISSION" : "MANUAL_REPORT"

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    const taskTypeId = await getOrCreateDefaultTaskType(orgId)
    const nowIso = new Date().toISOString()

    const taskPayload = {
      organization_id: orgId,
      org_unit_id: orgUnitId || user.orgUnitId || null,
      task_type_id: taskTypeId,
      category: "UNSTRUCTURED",
      priority: validPriority,
      title: title.trim(),
      description: (description || "").trim(),
      credit_value: credits,
      creator_id: user.id,
      assigned_to_id: assignedToId || null,
      status: assignedToId ? "ASSIGNED" : "OPEN",
      visibility_scope: visibilityScope,
      verification_mode: validVerificationMode,
      allow_nomination: allowNomination,
      deadline: deadline ? new Date(deadline).toISOString() : null,
      created_at: nowIso,
      updated_at: nowIso,
    }

    const { data: inserted, error: insertError } = await db
      .from("tasks")
      .insert(taskPayload)
      .select()
      .single()

    if (insertError) {
      console.error("[tasks/create] insert error:", insertError)
      return NextResponse.json({ error: `Failed to create task: ${insertError.message}` }, { status: 500 })
    }

    if (visibilityScope === "ORGANIZATION" && Array.isArray(targetOrgUnitIds) && targetOrgUnitIds.length > 0) {
      try {
        const targetRows = targetOrgUnitIds.map((uId: string) => ({
          task_id: inserted.id,
          org_unit_id: uId,
          created_at: nowIso,
        }))
        await db.from("task_target_org_units").insert(targetRows)
      } catch (targetErr: any) {
        console.warn("[tasks/create] task_target_org_units optional insert note:", targetErr?.message)
      }
    }

    return NextResponse.json({
      success: true,
      task: inserted,
      message: "Task created successfully.",
    })
  } catch (error: any) {
    console.error("[tasks/create] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
