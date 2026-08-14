import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

/**
 * GET /api/auth/get-session
 * Returns current session user with org/role context
 * Safe to call from client during auth callbacks
 */
export async function GET() {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ user: null })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error("[/api/auth/get-session] failed:", error)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
