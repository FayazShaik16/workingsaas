import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || !hasScope(user.scopeLevels, "SYSTEM_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. System Admin role required." }, { status: 403 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // 1. Query artificial units
    const { data: units, error: fetchErr } = await db
      .from("org_units")
      .select("id, name, unit_type")
      .eq("organization_id", orgId)

    if (fetchErr) {
      return NextResponse.json({ error: `Failed to query units: ${fetchErr.message}` }, { status: 500 })
    }

    const artificialCandidates = (units || []).filter((u: any) =>
      ["main", "root", "general", "main department", "root department"].includes(u.name.trim().toLowerCase())
    )

    if (artificialCandidates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No artificial legacy units found in this organization.",
        deletedUnits: [],
      })
    }

    const deletedUnits: string[] = []
    const skippedUnits: { name: string; reason: string }[] = []

    for (const unit of artificialCandidates) {
      // Check linked users
      const { count: userCount } = await db
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("org_unit_id", unit.id)

      // Check linked tasks
      const { count: taskCount } = await db
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("org_unit_id", unit.id)

      // Check linked templates
      const { count: tmplCount } = await db
        .from("scheduled_work_templates")
        .select("id", { count: "exact", head: true })
        .eq("org_unit_id", unit.id)

      if ((userCount || 0) > 0 || (taskCount || 0) > 0 || (tmplCount || 0) > 0) {
        skippedUnits.push({
          name: unit.name,
          reason: `Contains ${userCount || 0} active users, ${taskCount || 0} tasks, ${tmplCount || 0} schedule templates. Cannot auto-delete.`,
        })
        continue
      }

      // Safe to delete
      const { error: delErr } = await db.from("org_units").delete().eq("id", unit.id)
      if (delErr) {
        skippedUnits.push({ name: unit.name, reason: delErr.message })
      } else {
        deletedUnits.push(unit.name)
      }
    }

    return NextResponse.json({
      success: true,
      deletedUnits,
      skippedUnits,
      message: `Cleaned up ${deletedUnits.length} artificial legacy unit(s).`,
    })
  } catch (error: any) {
    console.error("[cleanup-legacy-units] Error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
