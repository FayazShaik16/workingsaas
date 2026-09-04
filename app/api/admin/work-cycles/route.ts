import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || (!hasScope(user.scopeLevels, "SYSTEM_ADMIN") && !hasScope(user.scopeLevels, "DIRECTOR") && !hasScope(user.scopeLevels, "DEPT_ADMIN"))) {
      return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    const { data: cycles, error } = await db
      .from("work_cycles")
      .select("*")
      .eq("organization_id", orgId)
      .order("starts_on", { ascending: false })

    if (error) {
      console.error("[admin/work-cycles] GET error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cycles: cycles || [],
    })
  } catch (error: any) {
    console.error("[admin/work-cycles] GET unexpected error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || (!hasScope(user.scopeLevels, "SYSTEM_ADMIN") && !hasScope(user.scopeLevels, "DIRECTOR"))) {
      return NextResponse.json({ error: "Unauthorized. System Admin or Director role required." }, { status: 403 })
    }

    const {
      name,
      starts_on,
      ends_on,
      scheduled_weight_percentage = 75,
      salary_threshold_percentage = 85,
      salary_request_opens_day = 26,
      status = "ACTIVE",
    } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Cycle name is required." }, { status: 400 })
    }
    if (!starts_on || !ends_on) {
      return NextResponse.json({ error: "Start date and End date are required." }, { status: 400 })
    }
    if (new Date(ends_on) < new Date(starts_on)) {
      return NextResponse.json({ error: "End date must be greater than or equal to start date." }, { status: 400 })
    }

    const schedWeight = Number(scheduled_weight_percentage)
    const salaryThresh = Number(salary_threshold_percentage)
    const opensDay = Number(salary_request_opens_day)

    if (isNaN(schedWeight) || schedWeight <= 0 || schedWeight >= 100) {
      return NextResponse.json({ error: "Scheduled weight must be between 1% and 99%." }, { status: 400 })
    }
    if (isNaN(salaryThresh) || salaryThresh < 0 || salaryThresh > 100) {
      return NextResponse.json({ error: "Salary threshold must be between 0% and 100%." }, { status: 400 })
    }
    if (isNaN(opensDay) || opensDay < 1 || opensDay > 31) {
      return NextResponse.json({ error: "Salary request open day must be between 1 and 31." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // If new cycle is ACTIVE, mark other active cycles as CLOSED
    if (status === "ACTIVE") {
      await db
        .from("work_cycles")
        .update({ status: "CLOSED", updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("status", "ACTIVE")
    }

    const newId = crypto.randomUUID()
    const { data: newCycle, error: insertErr } = await db
      .from("work_cycles")
      .insert({
        id: newId,
        organization_id: orgId,
        name: name.trim(),
        starts_on,
        ends_on,
        scheduled_weight_percentage: schedWeight,
        salary_threshold_percentage: salaryThresh,
        salary_request_opens_day: opensDay,
        status,
        created_by: user.id,
      })
      .select()
      .single()

    if (insertErr || !newCycle) {
      console.error("[admin/work-cycles] Insert error:", insertErr)
      return NextResponse.json({ error: `Failed to create work cycle: ${insertErr?.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cycle: newCycle,
      message: `Work cycle "${newCycle.name}" created successfully.`,
    })
  } catch (error: any) {
    console.error("[admin/work-cycles] POST unexpected error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || (!hasScope(user.scopeLevels, "SYSTEM_ADMIN") && !hasScope(user.scopeLevels, "DIRECTOR"))) {
      return NextResponse.json({ error: "Unauthorized. System Admin or Director role required." }, { status: 403 })
    }

    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: "Cycle ID is required for update." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // If setting status to ACTIVE, de-activate others first
    if (updates.status === "ACTIVE") {
      await db
        .from("work_cycles")
        .update({ status: "CLOSED", updated_at: new Date().toISOString() })
        .eq("organization_id", orgId)
        .eq("status", "ACTIVE")
        .neq("id", id)
    }

    const payload: any = { updated_at: new Date().toISOString() }

    if (updates.name !== undefined) payload.name = updates.name.trim()
    if (updates.starts_on !== undefined) payload.starts_on = updates.starts_on
    if (updates.ends_on !== undefined) payload.ends_on = updates.ends_on
    if (updates.scheduled_weight_percentage !== undefined) {
      payload.scheduled_weight_percentage = Number(updates.scheduled_weight_percentage)
    }
    if (updates.salary_threshold_percentage !== undefined) {
      payload.salary_threshold_percentage = Number(updates.salary_threshold_percentage)
    }
    if (updates.salary_request_opens_day !== undefined) {
      payload.salary_request_opens_day = Number(updates.salary_request_opens_day)
    }
    if (updates.status !== undefined) payload.status = updates.status

    const { data: updatedCycle, error: updateErr } = await db
      .from("work_cycles")
      .update(payload)
      .eq("id", id)
      .eq("organization_id", orgId)
      .select()
      .single()

    if (updateErr || !updatedCycle) {
      console.error("[admin/work-cycles] Update error:", updateErr)
      return NextResponse.json({ error: `Failed to update work cycle: ${updateErr?.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      cycle: updatedCycle,
      message: `Work cycle "${updatedCycle.name}" updated successfully.`,
    })
  } catch (error: any) {
    console.error("[admin/work-cycles] PATCH unexpected error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || (!hasScope(user.scopeLevels, "SYSTEM_ADMIN") && !hasScope(user.scopeLevels, "DIRECTOR"))) {
      return NextResponse.json({ error: "Unauthorized. System Admin or Director role required." }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Cycle ID is required for deletion." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    const { error: deleteErr } = await db
      .from("work_cycles")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId)

    if (deleteErr) {
      console.error("[admin/work-cycles] Delete error:", deleteErr)
      return NextResponse.json({ error: `Cannot delete work cycle: ${deleteErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Work cycle deleted successfully.",
    })
  } catch (error: any) {
    console.error("[admin/work-cycles] DELETE unexpected error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
