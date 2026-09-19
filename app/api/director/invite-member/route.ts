import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"

export async function POST(request: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      organizationId,
      name,
      email,
      employeeId,
      designation,
      orgUnitId,
      roleId,
    } = body

    if (!organizationId || !email || !name) {
      return NextResponse.json(
        { error: "Organization ID, name, and email are required" },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const trimmedEmail = email.trim().toLowerCase()
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // 14 days

    // 0. Institutional Governance: Enforce only 1 Director per organization
    let isDirectorInvite = false
    if (roleId) {
      const { data: targetRole } = await (admin as any)
        .from("roles")
        .select("scope_level")
        .eq("id", roleId)
        .maybeSingle()

      if (targetRole?.scope_level === "DIRECTOR") {
        isDirectorInvite = true
        const { data: existingDirectorRoles } = await (admin as any)
          .from("user_roles")
          .select("user_id, roles!inner(scope_level, organization_id)")
          .eq("roles.organization_id", organizationId)
          .eq("roles.scope_level", "DIRECTOR")

        if (existingDirectorRoles && existingDirectorRoles.length > 0) {
          const { data: currentDir } = await (admin as any)
            .from("users")
            .select("name, email")
            .eq("organization_id", organizationId)
            .in("id", existingDirectorRoles.map((r: any) => r.user_id))
            .maybeSingle()

          if (currentDir && currentDir.email.toLowerCase() !== trimmedEmail) {
            return NextResponse.json(
              { error: `An organization can only have ONE Director. ${currentDir.name} (${currentDir.email}) is already the appointed Director of this institution.` },
              { status: 400 }
            )
          }
        }
      }
    }

    const finalOrgUnitId = isDirectorInvite ? null : (orgUnitId === "none" ? null : orgUnitId || null)

    // 1. Create or update PENDING invitation in database
    const { data: invite, error: inviteErr } = await (admin as any)
      .from("invitations")
      .insert({
        organization_id: organizationId,
        email: trimmedEmail,
        intended_role_id: roleId || null,
        org_unit_id: finalOrgUnitId,
        token,
        status: "PENDING",
        invited_by: sessionUser.id,
        expires_at: expiresAt,
      })
      .select()
      .single()

    if (inviteErr) {
      console.error("[Invite API] Error inserting invitation:", inviteErr)
      return NextResponse.json(
        { error: inviteErr.message || "Failed to create invitation record" },
        { status: 500 }
      )
    }

    // 2. Check if a user record already exists for this email
    const { data: existingUser } = await (admin as any)
      .from("users")
      .select("id")
      .eq("email", trimmedEmail)
      .maybeSingle()

    let userId = existingUser?.id
    if (!userId) {
      try {
        const { data: userList } = await admin.auth.admin.listUsers()
        const foundAuth = userList?.users?.find((u) => u.email?.toLowerCase() === trimmedEmail)
        if (foundAuth) {
          userId = foundAuth.id
        }
      } catch (e) {
        console.warn("[Invite API] Error querying auth users:", e)
      }
    }
    if (!userId) {
      userId = crypto.randomUUID()
    }

    // 3. Create or update placeholder member in public.users so they appear on the tree
    const { error: userErr } = await (admin as any)
      .from("users")
      .upsert(
        {
          id: userId,
          organization_id: organizationId,
          org_unit_id: finalOrgUnitId,
          email: trimmedEmail,
          name: name.trim(),
          employee_id: employeeId || null,
          designation: designation || null,
          status: existingUser ? "ACTIVE" : "ACTIVE",
          employment_type: "FULL_TIME",
        },
        { onConflict: "id" }
      )

    if (userErr) {
      console.warn("[Invite API] Non-fatal warning upserting placeholder user:", userErr)
    }

    // 4. Assign role
    if (roleId) {
      await (admin as any).from("user_roles").upsert(
        {
          user_id: userId,
          role_id: roleId,
        },
        { onConflict: "user_id,role_id" }
      )
    }

    // 5. Ensure personal wallet exists
    await (admin as any).from("wallets").upsert(
      {
        organization_id: organizationId,
        owner_user_id: userId,
        purpose: "PERSONAL",
        balance: 0,
      },
      { onConflict: "owner_user_id,purpose" }
    )

    // 6. Attempt to trigger Supabase Auth invite email (if enabled in project)
    let emailSent = false
    try {
      const origin = request.headers.get("origin") || request.nextUrl.origin
      const { error: authInviteErr } = await admin.auth.admin.inviteUserByEmail(trimmedEmail, {
        redirectTo: `${origin}/signup?invite=${token}`,
        data: {
          organization_id: organizationId,
          name: name.trim(),
        },
      })
      if (!authInviteErr) {
        emailSent = true
      }
    } catch (e) {
      console.log("[Invite API] Supabase auth direct email invite:", e)
    }

    const origin = request.headers.get("origin") || request.nextUrl.origin
    const inviteLink = `${origin}/signup?invite=${token}`

    return NextResponse.json({
      success: true,
      inviteId: invite.id,
      token,
      inviteLink,
      emailSent,
      message: `Invitation generated for ${trimmedEmail}`,
    })
  } catch (error: any) {
    console.error("[Invite API] Unexpected error:", error)
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
