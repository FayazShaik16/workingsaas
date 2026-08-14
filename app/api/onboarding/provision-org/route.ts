import { getSessionUser } from "@/lib/auth/session"
import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
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
    const { data: org, error: orgError } = await supabase
      .from("organizations")
      .insert({
        name: organizationName,
        type: organizationType || "EDUCATIONAL_INSTITUTION",
        created_by: user.id,
      })
      .select("id")
      .single()

    if (orgError) throw orgError
    const orgId = org.id

    // 2. Create root organization unit (department)
    const { data: rootUnit, error: unitError } = await supabase
      .from("org_units")
      .insert({
        organization_id: orgId,
        name: "Root",
        type: "DEPARTMENT",
        parent_unit_id: null,
      })
      .select("id")
      .single()

    if (unitError) throw unitError

    // 3. Get or create DIRECTOR role
    const { data: directorRole } = await supabase
      .from("roles")
      .select("id")
      .eq("scope_level", "DIRECTOR")
      .single()

    if (!directorRole) throw new Error("DIRECTOR role not found - database not seeded")

    // 4. Link user to organization
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({
        organization_id: orgId,
        org_unit_id: rootUnit.id,
      })
      .eq("id", user.id)

    if (userUpdateError) throw userUpdateError

    // 5. Assign DIRECTOR role to user
    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: user.id,
        role_id: directorRole.id,
      })

    if (roleError && !roleError.message.includes("duplicate")) throw roleError

    // 6. Create Director's three wallets: SALARY_POOL, LOAN_POOL, PERSONAL
    const wallets = ["SALARY_POOL", "LOAN_POOL", "PERSONAL"]
    for (const purpose of wallets) {
      const { error: walletError } = await supabase
        .from("wallets")
        .insert({
          organization_id: orgId,
          owner_user_id: user.id,
          purpose: purpose as any,
          balance: purpose === "SALARY_POOL" ? 0 : purpose === "LOAN_POOL" ? 0 : 0,
        })

      if (walletError && !walletError.message.includes("duplicate")) throw walletError
    }

    return NextResponse.json({
      success: true,
      organizationId: orgId,
      unitId: rootUnit.id,
    })
  } catch (error) {
    console.error("[provision-org] Error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to provision organization" },
      { status: 500 }
    )
  }
}
