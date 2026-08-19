import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { NextResponse } from "next/server"

interface ImportUserRow {
  email: string
  name?: string
  role?: string
  department?: string
  designation?: string
  employeeId?: string
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAuthorized =
      hasScope(sessionUser.scopeLevels, "DIRECTOR") ||
      hasScope(sessionUser.scopeLevels, "SYSTEM_ADMIN") ||
      hasScope(sessionUser.scopeLevels, "DEPT_ADMIN")

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to import users." },
        { status: 403 }
      )
    }

    const { orgId, users } = (await req.json()) as {
      orgId: string
      users: ImportUserRow[]
    }

    if (!orgId || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: orgId and users array are required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    const defaultPassword =
      process.env.BULK_IMPORT_DEFAULT_PASSWORD || "Welcome@WorkLedger1"

    // 1. Fetch or create root org unit for this organization
    let { data: rootUnit } = await db
      .from("org_units")
      .select("id, path")
      .eq("organization_id", orgId)
      .is("parent_id", null)
      .limit(1)
      .maybeSingle()

    if (!rootUnit) {
      const { data: firstUnit } = await db
        .from("org_units")
        .select("id, path")
        .eq("organization_id", orgId)
        .limit(1)
        .maybeSingle()
      rootUnit = firstUnit
    }

    // 2. Fetch existing departments in this org
    const { data: existingUnits } = await db
      .from("org_units")
      .select("id, name, path")
      .eq("organization_id", orgId)

    const deptMap = new Map<string, string>()
    for (const u of existingUnits || []) {
      deptMap.set(u.name.trim().toLowerCase(), u.id)
    }

    // Upsert any missing departments
    const distinctDepts = Array.from(
      new Set(
        users
          .map((u) => u.department?.trim())
          .filter((d): d is string => Boolean(d && d.length > 0))
      )
    )

    for (const deptName of distinctDepts) {
      const normalized = deptName.toLowerCase()
      if (!deptMap.has(normalized)) {
        const { data: newUnit, error: unitError } = await db
          .from("org_units")
          .insert({
            organization_id: orgId,
            name: deptName,
            unit_type: "DEPARTMENT",
            parent_id: rootUnit?.id || null,
          })
          .select("id")
          .single()

        if (!unitError && newUnit) {
          deptMap.set(normalized, newUnit.id)
        }
      }
    }

    // 3. Fetch canonical roles for this org
    const { data: roles } = await db
      .from("roles")
      .select("id, name, scope_level")
      .eq("organization_id", orgId)

    const roleByScope = new Map<string, string>()
    for (const r of roles || []) {
      roleByScope.set(r.scope_level, r.id)
    }

    const memberRoleId = roleByScope.get("MEMBER")
    const leadRoleId = roleByScope.get("ORG_UNIT_LEAD")
    const financeRoleId = roleByScope.get("FINANCE_ADMIN")
    const deptAdminRoleId = roleByScope.get("DEPT_ADMIN")
    const directorRoleId = roleByScope.get("DIRECTOR")

    const results: Array<{
      email: string
      name: string
      status: "created" | "linked" | "skipped" | "error"
      warnings: string[]
      error?: string
    }> = []

    // 4. Process each user row
    for (const row of users) {
      const email = row.email?.trim().toLowerCase()
      const name = row.name?.trim() || email.split("@")[0]
      const warnings: string[] = []

      if (!email || !email.includes("@")) {
        results.push({
          email: email || "unknown",
          name,
          status: "error",
          warnings: ["Invalid email address format."],
        })
        continue
      }

      // Resolve department
      let orgUnitId: string | null = null
      if (row.department?.trim()) {
        orgUnitId = deptMap.get(row.department.trim().toLowerCase()) || null
      }

      // Resolve designation & role string
      const rawRole = (row.role || "").trim().toLowerCase()
      const rawDesig = (row.designation || "").trim()
      let roleScope = "MEMBER"
      let finalDesignation = rawDesig || "Assistant Professor"

      if (rawRole.includes("hod") || rawRole.includes("head")) {
        roleScope = "ORG_UNIT_LEAD"
        if (!rawDesig) finalDesignation = "Professor & Head of Department"
      } else if (rawRole.includes("finance")) {
        roleScope = "FINANCE_ADMIN"
        if (!rawDesig) finalDesignation = "Finance Administrator"
      } else if (rawRole.includes("dept") && rawRole.includes("admin")) {
        roleScope = "DEPT_ADMIN"
        if (!rawDesig) finalDesignation = "Department Academic Coordinator"
      } else if (rawRole.includes("director")) {
        roleScope = "DIRECTOR"
        if (!rawDesig) finalDesignation = "Director"
      } else if (
        rawRole.includes("professor") ||
        rawRole.includes("faculty") ||
        rawRole.includes("lecturer")
      ) {
        roleScope = "MEMBER"
        if (!rawDesig) finalDesignation = row.role!.trim()
      }

      try {
        let authUserId: string | null = null
        let isNewAuth = false

        // A. Attempt to create Supabase Auth user
        const { data: createData, error: createError } =
          await admin.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              full_name: name,
              name,
              must_change_password: true,
              provisioned_org_id: orgId,
            },
          })

        if (createData?.user) {
          authUserId = createData.user.id
          isNewAuth = true
        } else if (createError) {
          // If already exists, search existing auth user
          const { data: listData } = await admin.auth.admin.listUsers()
          const existingAuth = listData?.users?.find(
            (u) => u.email?.toLowerCase() === email
          )
          if (existingAuth) {
            authUserId = existingAuth.id
          } else {
            throw new Error(`Auth creation failed: ${createError.message}`)
          }
        }

        if (!authUserId) {
          throw new Error("Unable to establish auth user identity.")
        }

        // B. Upsert into public.users
        const { error: userUpsertError } = await db
          .from("users")
          .upsert(
            {
              id: authUserId,
              organization_id: orgId,
              org_unit_id: orgUnitId,
              email,
              name,
              designation: finalDesignation,
              employee_id: row.employeeId?.trim() || null,
              status: "ACTIVE",
              target_credits: 0.0,
              progress_percentage: 0.0,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          )

        if (userUpsertError) {
          console.error(`[bulk-import] user upsert error for ${email}:`, userUpsertError)
          warnings.push(`User record notice: ${userUpsertError.message}`)
        }

        // C. Assign Roles
        const rolesToAssign: string[] = []
        if (roleScope === "ORG_UNIT_LEAD") {
          if (leadRoleId) rolesToAssign.push(leadRoleId)
          if (memberRoleId) rolesToAssign.push(memberRoleId) // HODs teach!
        } else if (roleScope === "FINANCE_ADMIN" && financeRoleId) {
          rolesToAssign.push(financeRoleId)
        } else if (roleScope === "DEPT_ADMIN" && deptAdminRoleId) {
          rolesToAssign.push(deptAdminRoleId)
        } else if (roleScope === "DIRECTOR" && directorRoleId) {
          rolesToAssign.push(directorRoleId)
        } else if (memberRoleId) {
          rolesToAssign.push(memberRoleId)
        }

        for (const roleId of rolesToAssign) {
          await db
            .from("user_roles")
            .upsert({ user_id: authUserId, role_id: roleId }, { onConflict: "user_id, role_id" })
        }

        // D. If HOD, assign as lead of the department if not set
        if (roleScope === "ORG_UNIT_LEAD" && orgUnitId) {
          await db
            .from("org_units")
            .update({ lead_user_id: authUserId })
            .eq("id", orgUnitId)
        }

        // E. Ensure PERSONAL wallet exists
        await db
          .from("wallets")
          .insert({
            organization_id: orgId,
            owner_user_id: authUserId,
            purpose: "PERSONAL",
            balance: 0,
            created_at: new Date().toISOString(),
          })
          .select()
          .maybeSingle()

        results.push({
          email,
          name,
          status: isNewAuth ? "created" : "linked",
          warnings,
        })
      } catch (err: any) {
        console.error(`[bulk-import] error for ${email}:`, err)
        results.push({
          email,
          name,
          status: "error",
          warnings: [],
          error: err?.message || "Failed to process user.",
        })
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: users.length,
      createdCount: results.filter((r) => r.status === "created").length,
      linkedCount: results.filter((r) => r.status === "linked").length,
      errorCount: results.filter((r) => r.status === "error").length,
      results,
    })
  } catch (error: any) {
    console.error("[bulk-import-users] unhandled error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
