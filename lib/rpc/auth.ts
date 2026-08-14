import { createClient } from "@/lib/supabase/server"

/**
 * RPC: handle_new_auth_user
 * Called via trigger when new auth.users row is created
 * Creates users row + PERSONAL wallet
 * Maps to organizations/users/wallets schema
 */
export async function createNewAuthUser(
  authUserId: string,
  email: string,
  name: string,
  organizationId: string
) {
  const supabase = await createClient()

  try {
    // Create users row
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        id: authUserId,
        organization_id: organizationId,
        email,
        name,
        employment_type: "FULL_TIME",
        status: "ACTIVE",
      })
      .select()
      .single()

    if (userError) throw userError

    // Create PERSONAL wallet
    const { data: wallet, error: walletError } = await supabase
      .from("wallets")
      .insert({
        organization_id: organizationId,
        owner_user_id: authUserId,
        purpose: "PERSONAL",
        balance: 0,
      })
      .select()
      .single()

    if (walletError) throw walletError

    return { user: newUser, wallet }
  } catch (error) {
    console.error("[auth] createNewAuthUser failed:", error)
    throw error
  }
}

/**
 * RPC: handle_invite_acceptance
 * Accept an invitation, create user, assign roles
 */
export async function acceptInvitation(
  invitationToken: string,
  authUserId: string,
  name: string
) {
  const supabase = await createClient()

  try {
    // Get invitation row
    const { data: invitation, error: inviteError } = await supabase
      .from("invitations")
      .select("*")
      .eq("token", invitationToken)
      .eq("status", "PENDING")
      .single()

    if (inviteError || !invitation) throw new Error("Invalid or expired invitation")

    // Create user
    const { data: newUser, error: userError } = await supabase
      .from("users")
      .insert({
        id: authUserId,
        organization_id: invitation.organization_id,
        org_unit_id: invitation.org_unit_id,
        email: invitation.email,
        name,
        status: "ACTIVE",
      })
      .select()
      .single()

    if (userError) throw userError

    // Create PERSONAL wallet
    await supabase.from("wallets").insert({
      organization_id: invitation.organization_id,
      owner_user_id: authUserId,
      purpose: "PERSONAL",
      balance: 0,
    })

    // Assign role if specified
    if (invitation.intended_role_id) {
      await supabase.from("user_roles").insert({
        user_id: authUserId,
        role_id: invitation.intended_role_id,
      })
    }

    // Mark invitation accepted
    await supabase
      .from("invitations")
      .update({ status: "ACCEPTED" })
      .eq("id", invitation.id)

    return newUser
  } catch (error) {
    console.error("[auth] acceptInvitation failed:", error)
    throw error
  }
}
