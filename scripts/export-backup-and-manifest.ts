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

async function generateBackupAndManifest() {
  console.log("=== EXPORTING PUBLIC TABLES BACKUP & GENERATING MANIFEST ===")

  const backupDir = path.join(process.cwd(), "docs", "backup_pre_reset")
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const tables = [
    "organizations",
    "org_units",
    "users",
    "roles",
    "user_roles",
    "invitations",
    "tasks",
    "task_type_definitions",
    "wallets",
    "token_transactions",
    "notifications",
    "academic_programs",
    "subjects",
    "academic_batches",
    "subject_assignments",
    "timetable_slots",
    "attendance_records",
  ]

  const summary: Record<string, number> = {}

  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("*")
    if (error) {
      console.log(`Failed to export ${t}:`, error.message)
      summary[t] = 0
    } else {
      summary[t] = data?.length || 0
      const filePath = path.join(backupDir, `${t}.json`)
      fs.writeFileSync(filePath, JSON.stringify(data || [], null, 2), "utf-8")
      console.log(`Exported ${data?.length || 0} rows from [${t}] to ${filePath}`)
    }
  }

  // Get Auth users count
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  const authCount = authUsers?.users?.length || 0
  if (authUsers?.users) {
    fs.writeFileSync(
      path.join(backupDir, "auth_users.json"),
      JSON.stringify(
        authUsers.users.map((u) => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          user_metadata: u.user_metadata,
        })),
        null,
        2
      ),
      "utf-8"
    )
  }

  // Write docs/DATA_RESET_PREVIEW.md
  const manifest = `# WorkLedger: Data Reset Preview & Backup Manifest
**Generated:** ${new Date().toISOString()}  
**Supabase Project Ref:** \`bzgqvwqzbjqpfunnyfwe\`  
**Backup Directory:** \`docs/backup_pre_reset/\`  

---

## 1. Table Counts Breakdown (Pre-Reset)

| Entity / Table | Existing Count | Target Action Upon Reset Confirmation |
|---|---|---|
| **Auth Users** (\`auth.users\`) | ${authCount} | Delete demo/mock accounts via Supabase Admin API (retaining active System Admin) |
| **Organizations** (\`organizations\`) | ${summary["organizations"] || 0} | Remove legacy test organizations |
| **Organization Units** (\`org_units\`) | ${summary["org_units"] || 0} | Remove legacy departments |
| **Users** (\`public.users\`) | ${summary["users"] || 0} | Clean mock faculty/student profiles |
| **Roles** (\`roles\`) | ${summary["roles"] || 0} | Clean duplicates; seed standard system roles |
| **User Roles** (\`user_roles\`) | ${summary["user_roles"] || 0} | Clear mock role assignments |
| **Wallets** (\`wallets\`) | ${summary["wallets"] || 0} | Clear demo wallets |
| **Token Transactions** (\`token_transactions\`) | ${summary["token_transactions"] || 0} | Clear mock ledger entries |
| **Tasks** (\`tasks\`) | ${summary["tasks"] || 0} | Clear legacy test tasks |
| **Task Type Definitions** (\`task_type_definitions\`) | ${summary["task_type_definitions"] || 0} | Retain/refresh system standard types |
| **Invitations** (\`invitations\`) | ${summary["invitations"] || 0} | Clear stale demo invitations |
| **Notifications** (\`notifications\`) | ${summary["notifications"] || 0} | Clear demo notifications |
| **Academic Programs** (\`academic_programs\`) | ${summary["academic_programs"] || 0} | Clear legacy academic entities |
| **Subjects** (\`subjects\`) | ${summary["subjects"] || 0} | Clear legacy subjects |
| **Academic Batches** (\`academic_batches\`) | ${summary["academic_batches"] || 0} | Clear legacy batches |
| **Subject Assignments** (\`subject_assignments\`) | ${summary["subject_assignments"] || 0} | Clear legacy assignments |
| **Timetable Slots** (\`timetable_slots\`) | ${summary["timetable_slots"] || 0} | Clear legacy attendance slots |
| **Attendance Records** (\`attendance_records\`) | ${summary["attendance_records"] || 0} | Clear legacy attendance records |

---

## 2. Safety & Verification Controls
- Full JSON backup created in \`docs/backup_pre_reset/\`.
- Destructive reset is gated behind:
  1. Authenticated **\`SYSTEM_ADMIN\`** session.
  2. Typed confirmation phrase: **\`RESET WORKLEDGER DEMO DATA\`**.
  3. Second explicit modal confirmation button.
- The currently authenticated **\`SYSTEM_ADMIN\`** account is retained so administrative session is preserved.
`
  fs.writeFileSync(path.join(process.cwd(), "docs", "DATA_RESET_PREVIEW.md"), manifest, "utf-8")
  console.log("Wrote docs/DATA_RESET_PREVIEW.md successfully.")
}

generateBackupAndManifest()
