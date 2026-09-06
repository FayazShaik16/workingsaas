import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    const { data: depts, error } = await db
      .from("org_units")
      .select("id, name, unit_type, lead_user_id, created_at")
      .eq("organization_id", orgId)
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data: allUsers } = await db
      .from("users")
      .select("id, name, org_unit_id")
      .eq("organization_id", orgId)

    const formatted = (depts || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.name.slice(0, 4).toUpperCase(),
      leadUserId: d.lead_user_id,
      leadName: (allUsers || []).find((u: any) => u.id === d.lead_user_id)?.name || "Unassigned",
      memberCount: (allUsers || []).filter((u: any) => u.org_unit_id === d.id).length,
      createdAt: d.created_at,
    }))

    return NextResponse.json({ departments: formatted })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || !hasScope(user.scopeLevels, "SYSTEM_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. System Admin role required." }, { status: 403 })
    }

    const { name, code, leadUserId } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Department name is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // Check unique name within organization
    const { data: existing } = await db
      .from("org_units")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", name.trim())
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ error: "A department with this name already exists." }, { status: 400 })
    }

    const newId = crypto.randomUUID()
    const pathSlug = `n${newId.replace(/-/g, "_")}`

    const { data: newUnit, error: insertErr } = await db
      .from("org_units")
      .insert({
        id: newId,
        organization_id: orgId,
        name: name.trim(),
        unit_type: "ACADEMIC_DEPARTMENT",
        parent_id: null,
        path: pathSlug,
        lead_user_id: leadUserId || null,
      })
      .select("id, name, unit_type, lead_user_id, created_at")
      .single()

    if (insertErr || !newUnit) {
      console.error("[admin/departments] Insert error:", insertErr)
      return NextResponse.json({ error: `Failed to create department: ${insertErr?.message}` }, { status: 500 })
    }

    // If leadUserId provided, ensure user has ORG_UNIT_LEAD role and org_unit_id set
    if (leadUserId) {
      await db
        .from("users")
        .update({ org_unit_id: newUnit.id })
        .eq("id", leadUserId)

      // Ensure ORG_UNIT_LEAD role
      const { data: leadRole } = await db
        .from("roles")
        .select("id")
        .eq("organization_id", orgId)
        .eq("scope_level", "ORG_UNIT_LEAD")
        .maybeSingle()

      if (leadRole) {
        await db.from("user_roles").upsert(
          { user_id: leadUserId, role_id: leadRole.id },
          { onConflict: "user_id,role_id" }
        )
      }
    }

    try {
      revalidatePath(`/${orgId}/config/departments`)
      revalidatePath(`/${orgId}/config/people`)
    } catch {}

    return NextResponse.json({
      success: true,
      department: newUnit,
      message: `Department "${newUnit.name}" created successfully.`,
    })
  } catch (error: any) {
    console.error("[admin/departments] Error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
