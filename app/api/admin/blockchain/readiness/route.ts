import { getSessionUser } from "@/lib/auth/session"
import { checkBlockchainReadiness } from "@/lib/blockchain/work-token"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasAdminScope =
      user.scopeLevels.includes("SYSTEM_ADMIN") ||
      user.scopeLevels.includes("DIRECTOR") ||
      user.scopeLevels.includes("FINANCE_ADMIN")

    if (!hasAdminScope) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    const readiness = await checkBlockchainReadiness()
    return NextResponse.json(readiness)
  } catch (error: any) {
    console.error("[api/admin/blockchain/readiness] Error:", error)
    return NextResponse.json(
      { configured: false, rpcReachable: false, statusMessage: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
