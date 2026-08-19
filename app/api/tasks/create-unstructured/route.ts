import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
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
      tokenValue,
      deadline,
      orgUnitId,
      skillTags,
      validationMode,
      requiresPeerReview,
    } = await req.json()

    if (!title?.trim() || !tokenValue) {
      return NextResponse.json(
        { error: "Task title and credit token value are required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    const credits = parseFloat(tokenValue) || 1.0

    // 1. Find or create task type definition if validationMode specified
    let taskTypeId: string | null = null
    const { data: taskType } = await db
      .from("task_type_definitions")
      .select("id")
      .eq("organization_id", orgId)
      .eq("category", "UNSTRUCTURED")
      .limit(1)
      .maybeSingle()

    taskTypeId = taskType?.id || null

    // Format description with skill tags and validation mode if provided
    let enrichedDescription = description || ""
    if (Array.isArray(skillTags) && skillTags.length > 0) {
      enrichedDescription += `\n\n**Skills Required**: ${skillTags.join(", ")}`
    }
    if (validationMode) {
      enrichedDescription += `\n**Verification Method**: ${validationMode}`
    }

    const isDirectorOrAdmin = hasScope(user.scopeLevels, "DIRECTOR") || hasScope(user.scopeLevels, "SYSTEM_ADMIN")
    const visibilityScope = isDirectorOrAdmin ? "ORGANIZATION" : "ORG_UNIT"
    const targetOrgUnitId = isDirectorOrAdmin ? (orgUnitId || null) : (user.orgUnitId || orgUnitId || null)

    // 2. Insert the unstructured open pool task (standardized on credit_value)
    const taskPayload: any = {
      organization_id: orgId,
      org_unit_id: targetOrgUnitId,
      task_type_id: taskTypeId,
      category: "UNSTRUCTURED",
      title: title.trim(),
      description: enrichedDescription,
      credit_value: credits,
      creator_id: user.id,
      assigned_to_id: null, // Open pool
      status: "OPEN",
      custom_fields: { visibility_scope: visibilityScope, skillTags, validationMode },
      deadline: deadline ? new Date(deadline).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    // Try inserting with visibility_scope column, fallback to custom_fields
    let newTask = null
    const { data: inserted, error: insertError } = await db
      .from("tasks")
      .insert({ ...taskPayload, visibility_scope: visibilityScope })
      .select()
      .single()

    if (insertError) {
      const { data: fallbackInserted, error: fallbackError } = await db
        .from("tasks")
        .insert(taskPayload)
        .select()
        .single()

      if (fallbackError) {
        console.error("[create-unstructured] insert error:", fallbackError)
        throw new Error(`Failed to create unstructured task: ${fallbackError.message}`)
      }
      newTask = fallbackInserted
    } else {
      newTask = inserted
    }

    return NextResponse.json({
      success: true,
      task: newTask,
      message: "Unstructured task published to open marketplace successfully.",
    })
  } catch (error: any) {
    console.error("[create-unstructured] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
