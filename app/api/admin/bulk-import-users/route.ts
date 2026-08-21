import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

interface FacultyImportRow {
  faculty_id?: string
  faculty_name?: string
  faculty_email?: string
  department?: string
  designation?: string
  role?: string
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const hasAdminScope =
      user.scopeLevels.includes("SYSTEM_ADMIN") ||
      user.scopeLevels.includes("DIRECTOR")

    if (!hasAdminScope) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 })
    }

    const { rows, dryRun = true } = await req.json()

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No faculty rows provided." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // 1. Fetch existing org units and roles
    const [{ data: orgUnits }, { data: roles }] = await Promise.all([
      db.from("org_units").select("id, name").eq("organization_id", orgId),
      db.from("roles").select("id, name, scope_level").eq("organization_id", orgId),
    ])

    const unitByName = new Map<string, string>()
    for (const u of orgUnits || []) {
      unitByName.set(u.name.toLowerCase().trim(), u.id)
    }

    const roleByScope = new Map<string, string>()
    for (const r of roles || []) {
      roleByScope.set(r.scope_level, r.id)
    }

    // 2. Validate rows
    const validRows: any[] = []
    const rejectedRows: Array<{ rowNumber: number; row: FacultyImportRow; reason: string }> = []

    const defaultPassword = process.env.BULK_IMPORT_DEFAULT_PASSWORD || "Welcome@WorkLedger2026!"

    for (let i = 0; i < rows.length; i++) {
      const row: FacultyImportRow = rows[i]
      const rowNum = i + 1

      const email = (row.faculty_email || "").trim().toLowerCase()
      const name = (row.faculty_name || "").trim()
      const employeeId = (row.faculty_id || "").trim()
      const deptName = (row.department || "").trim()
      const designation = (row.designation || "Faculty Member").trim()
      const roleStr = (row.role || "MEMBER").trim().toUpperCase()

      if (!email || !email.includes("@")) {
        rejectedRows.push({ rowNumber: rowNum, row, reason: `Invalid email address: "${row.faculty_email}"` })
        continue
      }

      if (!name) {
        rejectedRows.push({ rowNumber: rowNum, row, reason: "Faculty name is required." })
        continue
      }

      const scopeLevel = roleStr.includes("HOD") || roleStr.includes("LEAD")
        ? "ORG_UNIT_LEAD"
        : roleStr.includes("DEPT_ADMIN")
        ? "DEPT_ADMIN"
        : roleStr.includes("DIRECTOR")
        ? "DIRECTOR"
        : "MEMBER"

      validRows.push({
        rowNum,
        email,
        name,
        employeeId,
        deptName,
        designation,
        scopeLevel,
      })
    }

    // 3. Dry Run Preview Response
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalRows: rows.length,
        validCount: validRows.length,
        rejectedCount: rejectedRows.length,
        validRowsPreview: validRows.slice(0, 15),
        rejectedRows,
      })
    }

    // 4. Actual Provisioning
    const createdUsers: any[] = []
    for (const item of validRows) {
      // Find or create org unit
      let unitId = item.deptName ? unitByName.get(item.deptName.toLowerCase()) : null
      if (!unitId && item.deptName) {
        const { data: newUnit } = await db
          .from("org_units")
          .insert({
            organization_id: orgId,
            name: item.deptName,
            unit_type: "DEPARTMENT",
          })
          .select("id")
          .single()

        if (newUnit?.id && item.deptName) {
          unitId = newUnit.id
          unitByName.set(item.deptName.toLowerCase(), newUnit.id)
        }
      }

      // Check if Auth user exists
      let authUserId: string | null = null
      const { data: authCreate, error: authErr } = await admin.auth.admin.createUser({
        email: item.email,
        password: defaultPassword,
        email_confirm: true,
        user_metadata: { name: item.name, organization_id: orgId },
      })

      if (authCreate?.user) {
        authUserId = authCreate.user.id
      } else if (authErr?.message?.includes("already registered")) {
        // Find existing user id
        const { data: existingUser } = await db
          .from("users")
          .select("id")
          .eq("email", item.email)
          .maybeSingle()
        authUserId = existingUser?.id || null
      }

      if (authUserId) {
        // Upsert into public.users
        await db.from("users").upsert({
          id: authUserId,
          organization_id: orgId,
          org_unit_id: unitId,
          email: item.email,
          name: item.name,
          employee_id: item.employeeId || null,
          designation: item.designation,
          status: "ACTIVE",
          employment_type: "FULL_TIME",
          must_reset_password: true,
        })

        // Assign Role
        const roleId = roleByScope.get(item.scopeLevel)
        if (roleId) {
          await db.from("user_roles").upsert(
            { user_id: authUserId, role_id: roleId },
            { onConflict: "user_id,role_id" }
          )
        }

        // Create Personal internal wallet if missing
        await db.from("wallets").upsert(
          {
            organization_id: orgId,
            owner_user_id: authUserId,
            purpose: "PERSONAL",
            balance: 0,
          },
          { onConflict: "owner_user_id,purpose" }
        ).catch(() => {})

        createdUsers.push({ id: authUserId, email: item.email, name: item.name })
      }
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      totalRows: rows.length,
      importedCount: createdUsers.length,
      rejectedCount: rejectedRows.length,
      rejectedRows,
      message: `Successfully imported and provisioned ${createdUsers.length} faculty accounts with password reset required.`,
    })
  } catch (error: any) {
    console.error("[api/admin/bulk-import-users] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
