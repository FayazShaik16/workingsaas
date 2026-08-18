import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const db = supabase as any

    // 1. Verify user is logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please sign in first." }, { status: 401 })
    }

    // 2. Parse token
    const { token } = await request.json()
    if (!token) {
      return NextResponse.json({ error: "Invitation token is required." }, { status: 400 })
    }

    // 3. Fetch invitation details
    const { data: invitation, error: inviteError } = await db
      .from("invitations")
      .select("*")
      .eq("token", token)
      .eq("status", "PENDING")
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invalid or expired invitation token." }, { status: 400 })
    }

    // Check if invitation has expired
    if (new Date(invitation.expires_at) < new Date()) {
      return NextResponse.json({ error: "Invitation has expired." }, { status: 400 })
    }

    // Get current user details in public.users to check if they have an old org
    const { data: publicUser } = await db
      .from("users")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    const oldOrgId = publicUser?.organization_id

    // 4. Upsert (insert or update) the user record to link them to the organization
    const { error: userUpsertError } = await db
      .from("users")
      .upsert({
        id: user.id,
        organization_id: invitation.organization_id,
        org_unit_id: invitation.org_unit_id || null,
        email: user.email,
        name: user.user_metadata?.name || user.email?.split("@")[0] || "New User",
        status: "ACTIVE"
      }, {
        onConflict: "id"
      })

    if (userUpsertError) {
      console.error("User upsert error:", userUpsertError)
      throw new Error(`Failed to initialize user profile: ${userUpsertError.message}`)
    }

    // 5. Assign intended role
    if (invitation.intended_role_id) {
      const { error: roleError } = await db
        .from("user_roles")
        .insert({
          user_id: user.id,
          role_id: invitation.intended_role_id,
        })
      if (roleError && roleError.code !== "23505") { // Ignore duplicates
        console.error("Role assignment error:", roleError)
        throw roleError
      }
    }

    // 6. Create PERSONAL wallet in the new organization
    const { error: walletError } = await db
      .from("wallets")
      .insert({
        organization_id: invitation.organization_id,
        owner_user_id: user.id,
        purpose: "PERSONAL",
        balance: 0,
      })
    if (walletError && walletError.code !== "23505") { // Ignore duplicates
      console.error("Wallet creation error:", walletError)
      throw walletError
    }

    // 7. Update auth.users metadata so active session JWT updates
    await supabase.auth.updateUser({
      data: {
        organization_id: invitation.organization_id,
      },
    })

    // 8. Mark invitation as ACCEPTED
    await db
      .from("invitations")
      .update({ status: "ACCEPTED" })
      .eq("id", invitation.id)

    // 9. Optional cleanup: If the old organization was a placeholder created on raw signup, delete it
    if (oldOrgId && oldOrgId !== invitation.organization_id) {
      const { count } = await db
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", oldOrgId)
      
      if (count === 1) {
        await db.from("organizations").delete().eq("id", oldOrgId)
      }
    }

    // 10. Fetch updated session to calculate exact role destination
    const { getSessionUser } = await import("@/lib/auth/session")
    const { getRedirectPath } = await import("@/lib/auth/get-redirect")
    const updatedUser = await getSessionUser()
    const redirectPath = updatedUser ? getRedirectPath(updatedUser) : `/${invitation.organization_id}/director`

    return NextResponse.json({
      success: true,
      organizationId: invitation.organization_id,
      redirectPath,
    })
  } catch (err) {
    console.error("Accept invite API failed:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to accept invitation" },
      { status: 500 }
    )
  }
}
