import { getSessionUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const db = supabase as any
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
    }

    if (user.organizationId) {
      return NextResponse.json({ error: "Organization already created" }, { status: 400 })
    }

    const { organizationName, organizationType } = await request.json()

    if (!organizationName?.trim()) {
      return NextResponse.json({ error: "Organization name required" }, { status: 400 })
    }

    // 1. Create organization
    const { data: org, error: orgError } = await db
      .from("organizations")
      .insert({
        name: organizationName,
        type: organizationType || "EDUCATIONAL_INSTITUTION",
      })
      .select("id")
      .single()

    if (orgError) throw orgError
    const orgId = org.id

    // 2. Create root organization unit (department)
    const { data: rootUnit, error: unitError } = await db
      .from("org_units")
      .insert({
        organization_id: orgId,
        name: "Root",
        unit_type: "DEPARTMENT",
        parent_id: null,
      })
      .select("id")
      .single()

    if (unitError) throw unitError

    // 3. Get or create DIRECTOR role
    const { data: directorRole } = await db
      .from("roles")
      .select("id")
      .eq("scope_level", "DIRECTOR")
      .limit(1)
      .maybeSingle()

    let roleId = directorRole?.id

    if (!roleId) {
      const { data: newRole } = await db
        .from("roles")
        .insert({
          organization_id: orgId,
          name: "Director",
          scope_level: "DIRECTOR",
          is_system_role: true,
        })
        .select("id")
        .single()

      roleId = newRole?.id
    }

    // 4. Link user to organization
    await db
      .from("users")
      .update({
        organization_id: orgId,
        org_unit_id: rootUnit?.id || null,
      })
      .eq("id", user.id)

    // 5. Assign DIRECTOR role to user
    if (roleId) {
      await db
        .from("user_roles")
        .insert({
          user_id: user.id,
          role_id: roleId,
        })
    }

    // 6. Create Director's three wallets: SALARY_POOL, LOAN_POOL, PERSONAL
    const wallets = ["SALARY_POOL", "LOAN_POOL", "PERSONAL"]
    for (const purpose of wallets) {
      await db
        .from("wallets")
        .insert({
          organization_id: orgId,
          owner_user_id: user.id,
          purpose: purpose,
          balance: 0,
        })
    }

    return NextResponse.json({
      success: true,
      organizationId: orgId,
      unitId: rootUnit?.id,
    })
  } catch (error) {
    console.error("[provision-org] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to provision organization" },
      { status: 500 }
    )
  }
}
