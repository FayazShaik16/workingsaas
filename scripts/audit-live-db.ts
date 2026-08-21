import { createClient } from "@supabase/supabase-js"
import * as fs from "fs"
import * as path from "path"

const envPath = path.join(process.cwd(), ".env.local")
const envContent = fs.readFileSync(envPath, "utf-8")
const env: Record<string, string> = {}
for (const line of envContent.split("\n")) {
  const match = line.trim().match(/^([^=]+)=(.*)$/)
  if (match) {
    env[match[1].trim()] = match[2].trim()
  }
}

const supabaseUrl = env["NEXT_PUBLIC_SUPABASE_URL"]!
const serviceRoleKey =
  env["SUPABASE_SERVICE_ROLE_KEY"] ||
  env["NEXT_PUBLIC_SUPABASE_SECRET_KEY"] ||
  env["NEXT_PUBLIC_SUPABASE_ANON_KEY"]!

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function runComprehensiveAudit() {
  console.log("=== COMPREHENSIVE LIVE DATABASE AUDIT ===")

  // Check auth users count
  const { data: authUsers, error: authErr } = await supabase.auth.admin.listUsers()
  if (authErr) {
    console.log("Auth Users Count Error:", authErr.message)
  } else {
    console.log(`Auth Users Count: ${authUsers.users.length}`)
  }

  const allPossibleTables = [
    "organizations",
    "org_units",
    "users",
    "roles",
    "user_roles",
    "invitations",
    "tasks",
    "task_type_definitions",
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
    "compensation_policies",
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

  const tableSummary: Record<string, { exists: boolean; count: number; error?: string }> = {}

  for (const t of allPossibleTables) {
    const { count, error } = await supabase.from(t).select("*", { count: "exact", head: true })
    if (error) {
      tableSummary[t] = { exists: false, count: 0, error: error.message }
    } else {
      tableSummary[t] = { exists: true, count: count ?? 0 }
    }
  }

  console.log(JSON.stringify(tableSummary, null, 2))
}

runComprehensiveAudit()
