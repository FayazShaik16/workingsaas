import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!user.scopeLevels.includes("SYSTEM_ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Only SYSTEM_ADMIN can perform a data reset." }, { status: 403 })
    }

    const { confirmationPhrase, mode = "PREVIEW" } = await req.json()

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch current counts across all tables
    const tableList = [
      "organizations",
      "org_units",
      "users",
      "roles",
      "user_roles",
      "invitations",
      "tasks",
      "task_proofs",
      "nominations",
      "wallets",
      "token_transactions",
      "notifications",
      "academic_programs",
      "subjects",
      "academic_batches",
      "subject_assignments",
      "timetable_slots",
      "attendance_records",
      "leave_requests",
      "performance_snapshots",
      "work_cycles",
      "scheduled_work_templates",
      "scheduled_work_instances",
      "scheduled_work_completions",
      "credit_ledger_entries",
      "monthly_work_progress",
      "salary_requests",
      "blockchain_wallets",
      "blockchain_transactions",
    ]

    const counts: Record<string, number> = {}
    for (const t of tableList) {
      try {
        const { count } = await db.from(t).select("*", { count: "exact", head: true })
        counts[t] = count ?? 0
      } catch {
        counts[t] = 0
      }
    }

    const { data: authData } = await admin.auth.admin.listUsers()
    const authCount = authData?.users?.length || 0

    // If mode is PREVIEW, return table counts without performing deletion
    if (mode === "PREVIEW") {
      return NextResponse.json({
        mode: "PREVIEW",
        authUsersCount: authCount,
        tableCounts: counts,
        retainedAdminUser: { id: user.id, email: user.email },
      })
    }

    // 2. Validate confirmation phrase for EXECUTE mode
    if (confirmationPhrase !== "RESET WORKLEDGER DEMO DATA") {
      return NextResponse.json(
        { error: 'Invalid confirmation phrase. You must type exactly: "RESET WORKLEDGER DEMO DATA"' },
        { status: 400 }
      )
    }

    // 3. Foreign-Key Safe Deletion Order
    // A. Delete dependent transactional records
    await db.from("scheduled_work_completions").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await db.from("credit_ledger_entries").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await db.from("monthly_work_progress").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await db.from("salary_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await db.from("scheduled_work_instances").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await db.from("scheduled_work_templates").delete().neq("id", "00000000-0000-0000-0000-000000000000")
    await db.from("work_cycles").delete().neq("id", "00000000-0000-0000-0000-000000000000")

    // B. Delete legacy academic records
    await db.from("attendance_records").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("timetable_slots").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("subject_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("academic_batches").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("subjects").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("academic_programs").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("leave_requests").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("performance_snapshots").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})

    // C. Delete tasks, nominations, transactions, wallets
    await db.from("task_proofs").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("nominations").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("tasks").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("token_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("blockchain_transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("blockchain_wallets").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})
    await db.from("invitations").delete().neq("id", "00000000-0000-0000-0000-000000000000").catch(() => {})

    // D. Delete non-admin user roles and users
    await db.from("user_roles").delete().neq("user_id", user.id).catch(() => {})
    await db.from("wallets").delete().neq("owner_user_id", user.id).catch(() => {})
    await db.from("users").delete().neq("id", user.id).catch(() => {})

    // E. Delete demo Auth accounts except calling admin
    let deletedAuthUsersCount = 0
    if (authData?.users) {
      for (const aUser of authData.users) {
        if (aUser.id !== user.id) {
          try {
            await admin.auth.admin.deleteUser(aUser.id)
            deletedAuthUsersCount++
          } catch (delErr) {
            console.warn(`[reset-data] Failed to delete auth user ${aUser.id}:`, delErr)
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      mode: "EXECUTED",
      deletedAuthUsersCount,
      retainedAdminUser: { id: user.id, email: user.email },
      message: `Database reset completed successfully. Purged demo records and ${deletedAuthUsersCount} mock Auth accounts while retaining your active administrator identity.`,
    })
  } catch (error: any) {
    console.error("[api/admin/reset-data] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
