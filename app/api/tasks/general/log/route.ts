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
      templateTaskId,
      durationHours,
      sessionDate,
      notes,
      proofUrl,
    } = await req.json()

    if (!templateTaskId) {
      return NextResponse.json({ error: "General task template is required." }, { status: 400 })
    }

    const parsedDuration = parseFloat(String(durationHours))
    if (isNaN(parsedDuration) || parsedDuration <= 0) {
      return NextResponse.json({ error: "Please enter a valid positive duration in hours." }, { status: 400 })
    }

    if (!notes?.trim()) {
      return NextResponse.json(
        { error: "Please provide a summary or description of the activity/session completed." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId
    const nowIso = new Date().toISOString()
    const validSessionDate = sessionDate ? sessionDate.slice(0, 10) : nowIso.slice(0, 10)

    // 1. Fetch template task to get hourly rate and category
    const { data: template, error: tplErr } = await db
      .from("tasks")
      .select("id, title, description, credit_value, org_unit_id, custom_fields")
      .eq("id", templateTaskId)
      .single()

    if (tplErr || !template) {
      return NextResponse.json({ error: "General task template not found." }, { status: 404 })
    }

    const cf = template.custom_fields || {}
    const hourlyRate = Number(cf.hourly_rate_credits || template.credit_value || 0.5)
    const category = cf.general_task_category || "OTHER"

    // Calculate time-proportional reward
    const calculatedCredits = Number((parsedDuration * hourlyRate).toFixed(2))

    const taskTypeId = await getOrCreateDefaultTaskType(orgId)

    let logDeptId = template.org_unit_id || user.orgUnitId || null
    if (!logDeptId) {
      const { data: fallbackUnits } = await db
        .from("org_units")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
      logDeptId = fallbackUnits?.[0]?.id
    }

    // 2. Insert logged task record
    const { data: insertedLog, error: logErr } = await db
      .from("tasks")
      .insert({
        organization_id: orgId,
        org_unit_id: logDeptId,
        task_type_id: taskTypeId,
        category: "UNSTRUCTURED",
        priority: "MEDIUM",
        title: `[General Task: ${category}] ${template.title}`,
        description: notes.trim(),
        credit_value: calculatedCredits,
        creator_id: user.id,
        assigned_to_id: user.id,
        status: "VERIFICATION_PENDING",
        visibility_scope: "ORG_UNIT",
        verification_mode: "MANUAL_REPORT",
        allow_nomination: false,
        custom_fields: {
          is_general_task_log: true,
          parent_template_id: template.id,
          parent_template_title: template.title,
          general_task_category: category,
          duration_hours: parsedDuration,
          hourly_rate_credits: hourlyRate,
          session_date: validSessionDate,
          faculty_notes: notes.trim(),
        },
        deadline: `${validSessionDate}T23:59:59.999Z`,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select()
      .single()

    if (logErr) {
      console.error("[tasks/general/log] error:", logErr)
      return NextResponse.json({ error: `Failed to log session: ${logErr.message}` }, { status: 500 })
    }

    // 3. Insert deliverable proof
    await db.from("task_proofs").insert({
      task_id: insertedLog.id,
      user_id: user.id,
      storage_provider: "SUPABASE",
      file_url: proofUrl || null,
      description: `Completed ${parsedDuration} hr session on ${validSessionDate}. ${notes.trim()}`,
      submitted_at: nowIso,
    })

    return NextResponse.json({
      success: true,
      log: insertedLog,
      calculatedCredits,
      durationHours: parsedDuration,
      message: `Successfully logged ${parsedDuration} hrs for "${template.title}". Expected reward: +${calculatedCredits} WORK tokens pending HOD approval.`,
    })
  } catch (error: any) {
    console.error("[tasks/general/log] uncaught:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
