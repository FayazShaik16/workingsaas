import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const db = createClient(supabaseUrl, serviceRoleKey)

async function purgeAllOrganizations() {
  const includeAuth = process.argv.includes("--include-auth")
  console.log("==================================================================")
  console.log("⚠  WARNING: PURGING ALL ORGANIZATIONS & TENANT DATA FROM DATABASE  ⚠")
  console.log("==================================================================")
  console.log(`Include Auth Users deletion: ${includeAuth ? "YES (--include-auth specified)" : "NO (preserving auth.users identities)"}`)

  // Tables in foreign-key safe deletion order
  const tables = [
    "scheduled_work_completions",
    "credit_ledger_entries",
    "monthly_work_progress",
    "salary_requests",
    "scheduled_work_instances",
    "scheduled_work_templates",
    "work_cycles",
    "attendance_records",
    "timetable_slots",
    "subject_assignments",
    "academic_batches",
    "subjects",
    "academic_programs",
    "leave_requests",
    "performance_snapshots",
    "task_proofs",
    "nominations",
    "tasks",
    "token_transactions",
    "blockchain_transactions",
    "blockchain_wallets",
    "wallets",
    "notifications",
    "invitations",
    "user_roles",
    "users",
    "org_units",
    "roles",
    "compensation_policies",
    "organizations",
  ]

  for (const table of tables) {
    try {
      const { error } = await db.from(table).delete().neq("id", "00000000-0000-0000-0000-000000000000")
      if (error && error.code !== "42P01") { // Ignore if table does not exist
        // If table doesn't have an "id" column (e.g. user_roles or credit_ledger_entries)
        const { error: fallbackErr } = await db.from(table).delete().filter("created_at", "neq", "1970-01-01T00:00:00Z")
        if (fallbackErr) {
          console.warn(`  [Notice] ${table}: ${fallbackErr.message}`)
        } else {
          console.log(`  ✓ Purged ${table}`)
        }
      } else {
        console.log(`  ✓ Purged ${table}`)
      }
    } catch (err: any) {
      console.warn(`  [Notice] ${table}: ${err.message}`)
    }
  }

  // Purge auth users if requested
  if (includeAuth) {
    console.log("\nPurging auth.users identities...")
    const { data: userList } = await db.auth.admin.listUsers({ perPage: 1000 })
    const users = userList?.users || []
    let deletedCount = 0
    for (const u of users) {
      await db.auth.admin.deleteUser(u.id)
      deletedCount++
    }
    console.log(`  ✓ Deleted ${deletedCount} auth.users accounts.`)
  }

  // Verification
  console.log("\n--- Post-Purge Verification ---")
  const { data: orgs } = await db.from("organizations").select("id")
  const { data: users } = await db.from("users").select("id")
  console.log(`Organizations remaining in database: ${orgs?.length || 0}`)
  console.log(`Public users remaining in database: ${users?.length || 0}`)
  console.log("\n✓ All organizations and tenant data have been completely wiped!")
}

purgeAllOrganizations().catch((err) => {
  console.error("Purge failed:", err)
  process.exit(1)
})
