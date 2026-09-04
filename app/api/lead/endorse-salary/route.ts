import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { assertDepartmentScope } from "@/lib/workledger/permissions"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { requestId, memberIds, action, notes } = await req.json()

    const admin = createAdminClient()
    const db = admin as any
    const isEndorse = action === "ENDORSE"
    const nowIso = new Date().toISOString()

    if (requestId) {
      // 1. Fetch salary request
      const { data: salaryReq, error: reqErr } = await db
        .from("salary_requests")
        .select("id, user_id, organization_id, users(org_unit_id)")
        .eq("id", requestId)
        .single()

      if (reqErr || !salaryReq) {
        return NextResponse.json({ error: "Salary request not found." }, { status: 404 })
      }

      // 2. Enforce department isolation
      assertDepartmentScope(user, salaryReq.users?.org_unit_id)

      // 3. Update salary request status
      const newStatus = isEndorse ? "HOD_APPROVED" : "HOD_REJECTED"
      await db
        .from("salary_requests")
        .update({
          status: newStatus,
          reviewed_by: user.id,
          reviewed_at: nowIso,
          review_note: notes || (isEndorse ? "Endorsed by HOD" : "Returned for revision"),
          updated_at: nowIso,
        })
        .eq("id", requestId)

      return NextResponse.json({
        success: true,
        status: newStatus,
        message: isEndorse
          ? "Salary claim endorsed and routed to Finance for monthly release."
          : "Salary claim returned for faculty revision.",
      })
    }

    if (Array.isArray(memberIds) && memberIds.length > 0) {
      const newStatus = isEndorse ? "HOD_APPROVED" : "HOD_REJECTED"
      const monthStart = `${nowIso.slice(0, 7)}-01`

      for (const mId of memberIds) {
        const { data: u } = await db.from("users").select("org_unit_id").eq("id", mId).single()
        if (u) {
          assertDepartmentScope(user, u.org_unit_id)
          await db
            .from("salary_requests")
            .update({
              status: newStatus,
              reviewed_by: user.id,
              reviewed_at: nowIso,
              review_note: notes || (isEndorse ? "Endorsed by HOD" : "Returned for revision"),
              updated_at: nowIso,
            })
            .eq("organization_id", user.organizationId)
            .eq("user_id", mId)
            .eq("month_start", monthStart)
        }
      }

      return NextResponse.json({
        success: true,
        count: memberIds.length,
        message: `Processed ${memberIds.length} salary request(s).`,
      })
    }

    return NextResponse.json({ error: "No requestId or memberIds provided." }, { status: 400 })
  } catch (error: any) {
    console.error("[lead/endorse-salary] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.statusCode || 500 }
    )
  }
}
