import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const db = supabase as any

  try {
    const { invitationToken, authUserId, name } = await request.json()

    if (!invitationToken || !authUserId || !name) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Get invitation
    const { data: invitation, error: inviteError } = await db
      .from("invitations")
      .select("*")
      .eq("token", invitationToken)
      .eq("status", "PENDING")
      .single()

    if (inviteError || !invitation) {
      return NextResponse.json({ error: "Invalid or expired invitation" }, { status: 400 })
    }

    // Create user
    const { data: newUser, error: userError } = await db.from("users").insert({
      id: authUserId,
      organization_id: invitation.organization_id,
      org_unit_id: invitation.org_unit_id,
      email: invitation.email,
      name,
      status: "ACTIVE",
    })

    if (userError) throw userError

    // Create PERSONAL wallet
    const { error: walletError } = await db.from("wallets").insert({
      organization_id: invitation.organization_id,
      owner_user_id: authUserId,
      purpose: "PERSONAL",
      balance: 0,
    })

    if (walletError) throw walletError

    // Assign role if specified
    if (invitation.intended_role_id) {
      await db.from("user_roles").insert({
        user_id: authUserId,
        role_id: invitation.intended_role_id,
      })
    }

    // Mark invitation accepted
    await db.from("invitations").update({ status: "ACCEPTED" }).eq("id", invitation.id)

    return NextResponse.json({ success: true, user: newUser })
  } catch (error) {
    console.error("[accept-invite] failed:", error)
    const message = error instanceof Error ? error.message : "Failed to accept invitation"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
