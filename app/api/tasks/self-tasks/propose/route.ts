import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
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
      interestArea = "ACADEMIC_INITIATIVE",
      proposedCredits = 2.0,
      targetDate,
      expectedDeliverable,
    } = await req.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Please enter a title for your proposed task." }, { status: 400 })
    }

    if (!description?.trim()) {
      return NextResponse.json(
        { error: "Please provide a description and rationale for why you are interested in this initiative." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId
    const nowIso = new Date().toISOString()
    const taskTypeId = await getOrCreateDefaultTaskType(orgId)

    // Ensure non-null org_unit_id
    let resolvedDeptId = user.orgUnitId
    if (!resolvedDeptId) {
      const { data: fallbackUnits } = await db
        .from("org_units")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
      resolvedDeptId = fallbackUnits?.[0]?.id
    }
    if (!resolvedDeptId) {
      return NextResponse.json({ error: "No academic department found for user." }, { status: 400 })
    }

    const credits = Math.max(0.5, parseFloat(String(proposedCredits)) || 2.0)

    const { data: inserted, error: insertError } = await db
      .from("tasks")
      .insert({
        organization_id: orgId,
        org_unit_id: resolvedDeptId,
        task_type_id: taskTypeId,
        category: "UNSTRUCTURED",
        priority: "MEDIUM",
        title: title.trim(),
        description: description.trim(),
        credit_value: credits,
        creator_id: user.id,
        assigned_to_id: user.id,
        status: "DRAFT",
        visibility_scope: "ORG_UNIT",
        verification_mode: "MANUAL_REPORT",
        allow_nomination: false,
        deadline: targetDate ? `${targetDate.slice(0, 10)}T23:59:59.999Z` : null,
        custom_fields: {
          is_self_proposed: true,
          interest_area: interestArea,
          proposed_credits: credits,
          approved_credits: credits,
          proposal_status: "PENDING",
          proposal_rationale: description.trim(),
          expected_deliverable: expectedDeliverable?.trim() || null,
          target_date: targetDate ? targetDate.slice(0, 10) : null,
          proposed_at: nowIso,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[tasks/self-tasks/propose] insert error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      task: inserted,
      message: `Self-task "${inserted.title}" proposed successfully! Sent to your Department Head for approval.`,
    })
  } catch (error: any) {
    console.error("[tasks/self-tasks/propose] uncaught:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
