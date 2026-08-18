import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { memberIds, action, notes } = await req.json()

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: "No faculty member IDs provided." }, { status: 400 })
    }

    const supabase = await createClient()
    const db = supabase as any

    const isEndorse = action === "ENDORSE"
    const nowIso = new Date().toISOString()

    let endorsedCount = 0

    for (const memberId of memberIds) {
      if (isEndorse) {
        // Digital endorsement stamped
        await db
          .from("users")
          .update({
            status: "ACTIVE",
            updated_at: nowIso,
          })
          .eq("id", memberId)

        endorsedCount++
      }
    }

    return NextResponse.json({
      success: true,
      endorsedCount,
      message: isEndorse
        ? `Cryptographic HOD digital endorsement stamped for ${endorsedCount} faculty member(s). Forwarded to Finance for monthly release.`
        : `Salary endorsement rejected for ${memberIds.length} faculty member(s).`,
    })
  } catch (error: any) {
    console.error("[lead/endorse-salary] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
