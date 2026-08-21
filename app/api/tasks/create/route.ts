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
      organizationId,
      title,
      description,
      creditValue,
      penaltyValue,
      category = "UNSTRUCTURED",
      priority = "MEDIUM",
      orgUnitId,
      deadline,
      assignedToId,
      status = "OPEN",
      validationMode = "FILE_PROOF",
      tags = [],
    } = await req.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Task title is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = organizationId || user.organizationId

    const credits = parseFloat(creditValue) || 1.0
    const validPriority = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM"

    // Prepare description with tags if present
    let enrichedDescription = description || ""
    if (Array.isArray(tags) && tags.length > 0) {
      enrichedDescription += `\n\n**Tags**: ${tags.join(", ")}`
    }
    if (validationMode) {
      enrichedDescription += `\n**Verification**: ${validationMode}`
    }

    const targetOrgUnitId = orgUnitId || user.orgUnitId || null
    const finalStatus = assignedToId ? "ASSIGNED" : status || "OPEN"

    const taskPayload: any = {
      organization_id: orgId,
      org_unit_id: targetOrgUnitId,
      category: category,
      priority: validPriority,
      title: title.trim(),
      description: enrichedDescription,
      credit_value: credits,
      penalty_value: penaltyValue ? parseFloat(penaltyValue) : 0,
      creator_id: user.id,
      assigned_to_id: assignedToId || null,
      status: finalStatus,
      custom_fields: { tags, validationMode, priority: validPriority },
      deadline: deadline ? new Date(deadline).toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: inserted, error: insertError } = await db
      .from("tasks")
      .insert(taskPayload)
      .select()
      .single()

    if (insertError) {
      console.error("[tasks/create] insert error:", insertError)
      throw new Error(`Failed to create task: ${insertError.message}`)
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
