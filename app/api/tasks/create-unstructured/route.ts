import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { getOrCreateDefaultTaskType } from "@/lib/workledger/default-task-type"
import { assertDepartmentScope } from "@/lib/workledger/permissions"
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
      tokenValue, // backwards-compat fallback input
      deadline,
      priority = "MEDIUM",
      orgUnitId,
      visibilityScope: reqVisibilityScope,
      targetOrgUnitIds = [],
      verificationMode = "MANUAL_REPORT",
      allowNomination = true,
      assignedToId = null,
    } = await req.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 })
    }

    if (!description?.trim()) {
      return NextResponse.json({ error: "Task description is required." }, { status: 400 })
    }

    const rawCredits = creditValue ?? credit_value ?? tokenValue
    const credits = parseFloat(rawCredits)
    if (isNaN(credits) || credits <= 0) {
      return NextResponse.json({ error: "Credit value must be a positive number greater than 0." }, { status: 400 })
    }

    const isDirectorOrAdmin = hasScope(user.scopeLevels, "DIRECTOR") || hasScope(user.scopeLevels, "SYSTEM_ADMIN")
    const isHOD = hasScope(user.scopeLevels, "ORG_UNIT_LEAD")

    if (!isDirectorOrAdmin && !isHOD) {
      return NextResponse.json({ error: "Only HOD, Director, or System Admin can create unstructured initiatives." }, { status: 403 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // 1. Transactionally resolve non-null task_type_id
    const taskTypeId = await getOrCreateDefaultTaskType(orgId)
    if (!taskTypeId) {
      return NextResponse.json({ error: "Failed to resolve default task type definition." }, { status: 500 })
    }

    // 2. Determine department scope and visibility
    let finalOrgUnitId: string | null = null
    let finalVisibilityScope: "ORGANIZATION" | "ORG_UNIT" = "ORGANIZATION"

    if (isHOD && !isDirectorOrAdmin) {
      // HOD can only create tasks for their own department
      if (!user.orgUnitId) {
        return NextResponse.json({ error: "Your account is not assigned to a department." }, { status: 403 })
      }
      finalOrgUnitId = user.orgUnitId
      finalVisibilityScope = "ORG_UNIT"
    } else {
      // Director or System Admin
      if (reqVisibilityScope === "ORG_UNIT" && orgUnitId) {
        finalOrgUnitId = orgUnitId
        finalVisibilityScope = "ORG_UNIT"
      } else {
        finalVisibilityScope = "ORGANIZATION"
        finalOrgUnitId = orgUnitId || null
      }
    }

    const validPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM"
    const validVerificationMode = verificationMode === "FILE_SUBMISSION" ? "FILE_SUBMISSION" : "MANUAL_REPORT"
    const nowIso = new Date().toISOString()

    // 3. Insert Task
    const taskPayload = {
      organization_id: orgId,
      org_unit_id: finalOrgUnitId,
      task_type_id: taskTypeId,
      category: "UNSTRUCTURED",
      priority: validPriority,
      title: title.trim(),
      description: description.trim(),
      credit_value: credits,
      creator_id: user.id,
      assigned_to_id: assignedToId || null,
      status: assignedToId ? "ASSIGNED" : "OPEN",
      visibility_scope: finalVisibilityScope,
      verification_mode: validVerificationMode,
      allow_nomination: allowNomination,
      custom_fields: { targetOrgUnitIds },
      deadline: deadline ? new Date(deadline).toISOString() : null,
      created_at: nowIso,
      updated_at: nowIso,
    }

    if (assignedToId && deadline) {
      const targetDate = new Date(deadline).toISOString().slice(0, 10)
      const { data: existingTask } = await db
        .from("tasks")
        .select("id, title")
        .eq("assigned_to_id", assignedToId)
        .eq("title", title.trim())
        .gte("deadline", `${targetDate}T00:00:00.000Z`)
        .lte("deadline", `${targetDate}T23:59:59.999Z`)
        .neq("status", "CANCELLED")
        .neq("status", "REJECTED")
        .limit(1)
        .maybeSingle()

      if (existingTask) {
        return NextResponse.json(
          {
            error: `Task assignment conflict: The selected faculty member already has an initiative task ("${existingTask.title}") scheduled on ${targetDate}. Duplicate assignments for the same task on the same date are prohibited.`,
          },
          { status: 400 }
        )
      }
    }

    const { data: newTask, error: insertErr } = await db
      .from("tasks")
      .insert(taskPayload)
      .select()
      .single()

    if (insertErr || !newTask) {
      console.error("[create-unstructured] insert error:", insertErr)
      return NextResponse.json({ error: `Failed to create task: ${insertErr?.message}` }, { status: 500 })
    }

    // 4. If Director specified targeted departments, insert into task_target_org_units if available
    if (finalVisibilityScope === "ORGANIZATION" && Array.isArray(targetOrgUnitIds) && targetOrgUnitIds.length > 0) {
      try {
        const targetRows = targetOrgUnitIds.map((uId: string) => ({
          task_id: newTask.id,
          org_unit_id: uId,
          created_at: nowIso,
        }))

        await db.from("task_target_org_units").insert(targetRows)
      } catch (targetErr: any) {
        console.warn("[create-unstructured] task_target_org_units optional insert note:", targetErr?.message)
      }
    }

    return NextResponse.json({
      success: true,
      task: newTask,
      message: "Unstructured initiative created and published successfully.",
    })
  } catch (error: any) {
    console.error("[create-unstructured] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
