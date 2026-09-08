import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user || !hasScope(user.scopeLevels, "SYSTEM_ADMIN")) {
      return NextResponse.json({ error: "Unauthorized. System Admin role required." }, { status: 403 })
    }

    const body = await req.json().catch(() => ({}))
    const targetUserId = body.targetUserId || user.id
    const action = body.action || "toggle" // "grant" | "revoke" | "toggle"

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // 1. Get or create DIRECTOR role
    let { data: directorRole } = await db
      .from("roles")
      .select("id")
      .eq("organization_id", orgId)
      .eq("scope_level", "DIRECTOR")
      .maybeSingle()

    if (!directorRole) {
      const { data: newRole, error: createErr } = await db
        .from("roles")
        .insert({
          organization_id: orgId,
          name: "Director",
          scope_level: "DIRECTOR",
          is_system_role: true,
        })
        .select("id")
        .single()
      if (createErr) throw createErr
      directorRole = newRole
    }

    // 2. Check if target user currently has DIRECTOR role
    const { data: existingRole } = await db
      .from("user_roles")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("role_id", directorRole.id)
      .maybeSingle()

    const shouldGrant = action === "grant" || (action === "toggle" && !existingRole)

    if (shouldGrant) {
      await db.from("user_roles").upsert(
        { user_id: targetUserId, role_id: directorRole.id },
        { onConflict: "user_id,role_id" }
      )

      // Ensure Director wallets exist
      const wallets = ["SALARY_POOL", "LOAN_POOL", "PERSONAL"]
      for (const purpose of wallets) {
        await db.from("wallets").upsert(
          { organization_id: orgId, owner_user_id: targetUserId, purpose, balance: 0 },
          { onConflict: "owner_user_id,purpose" }
        )
      }

      return NextResponse.json({
        success: true,
        hasDirectorRole: true,
        message: targetUserId === user.id
          ? "Director role successfully assigned to your account. You can now access both System Admin and Director workspaces."
          : "Director role granted successfully.",
      })
    } else {
      await db
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role_id", directorRole.id)

      return NextResponse.json({
        success: true,
        hasDirectorRole: false,
        message: targetUserId === user.id
          ? "Director role removed from your account. You remain in the System Administrator role."
          : "Director role removed successfully.",
      })
    }
  } catch (error: any) {
    console.error("[assign-director-role] Error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
