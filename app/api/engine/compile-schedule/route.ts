import { NextRequest, NextResponse } from "next/server"
import { compileMonthlyScheduleTasks, compileOrganizationScheduleTasks } from "@/lib/engine/timetable-compiler"
import { getSessionUser, hasScope } from "@/lib/auth/session"

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized: session required" }, { status: 401 })
    }

    const body = await req.json()
    const { organizationId, facultyId, year, month } = body

    if (!organizationId) {
      return NextResponse.json({ error: "Missing organizationId" }, { status: 400 })
    }

    // Strict multi-tenant isolation check: user cannot compile outside own organization
    if (user.organizationId !== organizationId) {
      return NextResponse.json({ error: "Forbidden: cross-tenant access prohibited" }, { status: 403 })
    }

    // Role scope check: DEPT_ADMIN, ORG_UNIT_LEAD, DIRECTOR, or SYSTEM_ADMIN required
    const allowedScopes = ["DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN"]
    const isAuthorized = allowedScopes.some((scope) => hasScope(user.scopeLevels, scope))
    if (!isAuthorized) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions to compile schedule" }, { status: 403 })
    }

    const compileYear = Number(year) || new Date().getFullYear()
    const compileMonth = Number(month) || new Date().getMonth() + 1

    if (compileYear < 2020 || compileYear > 2100 || compileMonth < 1 || compileMonth > 12) {
      return NextResponse.json({ error: "Invalid year or month parameters" }, { status: 400 })
    }

    if (facultyId) {
      const result = await compileMonthlyScheduleTasks(organizationId, facultyId, compileYear, compileMonth)
      return NextResponse.json(result)
    } else {
      const result = await compileOrganizationScheduleTasks(organizationId, compileYear, compileMonth)
      return NextResponse.json(result)
    }
  } catch (error: any) {
    console.error("[api/engine/compile-schedule] error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
