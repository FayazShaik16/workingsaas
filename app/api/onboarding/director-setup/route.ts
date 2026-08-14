import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  try {
    // Get authenticated user
    const { data: authData, error: authError } = await supabase.auth.getUser()
    if (authError || !authData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { organizationId, orgUnits, roles } = await request.json()

    if (!organizationId || !orgUnits || !roles) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Verify user is SYSTEM_ADMIN of this org
    const { data: userRoles, error: roleError } = await supabase
      .from("user_roles")
      .select("roles(scope_level)")
      .eq("user_id", authData.user.id)

    if (roleError) throw roleError

    const isAdmin = userRoles?.some((ur: any) => ur.roles?.scope_level === "SYSTEM_ADMIN")
    if (!isAdmin) {
      return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 })
    }

    // Create org_units tree (flat list → root-level units)
    const createdUnits = []
    for (const unit of orgUnits) {
      const { data: orgUnit, error: unitError } = await supabase
        .from("org_units")
        .insert({
          organization_id: organizationId,
          parent_id: null,
          unit_type: unit.unitType || "DEPARTMENT",
          name: unit.name,
          path: null, // Will be computed by trigger
        })
        .select()
        .single()

      if (unitError) throw unitError
      createdUnits.push(orgUnit)
    }

    // Create roles
    const createdRoles = []
    for (const role of roles) {
      const { data: newRole, error: roleCreateError } = await supabase
        .from("roles")
        .insert({
          organization_id: organizationId,
          name: role.name,
          scope_level: role.scopeLevel,
          is_system_role: false,
        })
        .select()
        .single()

      if (roleCreateError) throw roleCreateError
      createdRoles.push(newRole)
    }

    return NextResponse.json({
      success: true,
      orgUnits: createdUnits,
      roles: createdRoles,
    })
  } catch (error) {
    console.error("[director-setup] failed:", error)
    const message = error instanceof Error ? error.message : "Setup failed"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
