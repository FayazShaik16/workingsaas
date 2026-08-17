import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
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

    const supabase = await createClient()
    const db = supabase as any
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

    // 2. Insert the unstructured open pool task
    const { data: newTask, error: insertError } = await db
      .from("tasks")
      .insert({
        organization_id: orgId,
        org_unit_id: orgUnitId || user.orgUnitId || null,
        task_type_id: taskTypeId,
        category: "UNSTRUCTURED",
        title: title.trim(),
        description: enrichedDescription,
        credit_value: credits,
        token_value: credits,
        creator_id: user.id,
        assigned_to_id: null, // Open pool
        status: "OPEN",
        deadline: deadline ? new Date(deadline).toISOString() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("[create-unstructured] insert error:", insertError)
      throw new Error(`Failed to create unstructured task: ${insertError.message}`)
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
