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

    const scopes = user.scopeLevels || []
    if (
      !hasScope(scopes, "ORG_UNIT_LEAD") &&
      !hasScope(scopes, "DIRECTOR") &&
      !hasScope(scopes, "SYSTEM_ADMIN") &&
      !hasScope(scopes, "DEPT_ADMIN")
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only HOD, Director, or Dept Admin can create General Tasks." },
        { status: 403 }
      )
    }

    const {
      title,
      description,
      generalCategory = "COUNSELLING",
      hourlyRate = 0.5,
      orgUnitId,
      minDurationHours = 0.5,
      maxDurationHours = 8.0,
    } = await req.json()

    if (!title?.trim()) {
      return NextResponse.json({ error: "Title is required for General Task." }, { status: 400 })
    }

    const rate = Math.max(0.1, parseFloat(String(hourlyRate)) || 0.5)
    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId
    const nowIso = new Date().toISOString()
    const taskTypeId = await getOrCreateDefaultTaskType(orgId)

    // Determine target department:
    let targetDeptId = orgUnitId ?? null
    if (hasScope(scopes, "ORG_UNIT_LEAD") && !hasScope(scopes, "DIRECTOR") && !hasScope(scopes, "SYSTEM_ADMIN")) {
      targetDeptId = user.orgUnitId || targetDeptId
    }

    const isOrgWide = !targetDeptId || targetDeptId === "ALL"
    if (isOrgWide) {
      const { data: fallbackUnits } = await db
        .from("org_units")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
      targetDeptId = fallbackUnits?.[0]?.id
    }

    const creatorRole = hasScope(scopes, "DIRECTOR")
      ? "DIRECTOR"
      : hasScope(scopes, "ORG_UNIT_LEAD")
      ? "ORG_UNIT_LEAD"
      : hasScope(scopes, "DEPT_ADMIN")
      ? "DEPT_ADMIN"
      : "SYSTEM_ADMIN"

    const { data: inserted, error: insertError } = await db
      .from("tasks")
      .insert({
        organization_id: orgId,
        org_unit_id: targetDeptId,
        task_type_id: taskTypeId,
        category: "UNSTRUCTURED",
        priority: "MEDIUM",
        title: title.trim(),
        description: (description || "").trim(),
        credit_value: rate,
        creator_id: user.id,
        status: "OPEN",
        visibility_scope: isOrgWide ? "ORGANIZATION" : "ORG_UNIT",
        verification_mode: "MANUAL_REPORT",
        allow_nomination: false,
        custom_fields: {
          is_general_task_template: true,
          is_org_wide: isOrgWide,
          general_task_category: generalCategory,
          hourly_rate_credits: rate,
          min_duration_hours: parseFloat(String(minDurationHours)) || 0.5,
          max_duration_hours: parseFloat(String(maxDurationHours)) || 8.0,
          requires_time_log: true,
          created_by_role: creatorRole,
        },
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single()

    if (insertError) {
      console.error("[tasks/general/create] error:", insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      task: inserted,
      message: `General Task "${inserted.title}" created successfully at rate ${rate} WORK/hr.`,
    })
  } catch (error: any) {
    console.error("[tasks/general/create] uncaught:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
