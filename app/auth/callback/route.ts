import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { getRedirectPath } from "@/lib/auth/get-redirect"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const intent = searchParams.get("intent") ?? "login" // login | signup | invite

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=no_code", request.url))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error("[auth/callback] exchangeCodeForSession failed:", error)
    return NextResponse.redirect(new URL(`/login?error=${error.message}`, request.url))
  }

  // Get session to determine redirect destination
  const user = await getSessionUser()

  if (!user) {
    return NextResponse.redirect(new URL("/login?error=no_session", request.url))
  }

  // Compute destination based on intent
  let destination: string

  if (intent === "signup") {
    // After signup, go to onboarding OR dashboard if already provisioned
    destination = user.organizationId ? getRedirectPath(user) : "/onboarding/setup"
  } else if (intent === "invite") {
    // After accepting invite, go straight to dashboard
    destination = getRedirectPath(user)
  } else {
    // Regular login
    destination = getRedirectPath(user)
  }

  return NextResponse.redirect(new URL(destination, request.url))
}

