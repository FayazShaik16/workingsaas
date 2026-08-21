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

async function inspectColumns() {
  console.log("=== Inspecting Sample Rows ===")
  const checkTables = ["users", "roles", "user_roles", "tasks", "wallets", "token_transactions"]
  for (const t of checkTables) {
    const { data, error } = await supabase.from(t).select("*").limit(1)
    if (error) {
      console.log(`Error on ${t}:`, error.message)
    } else if (data && data.length > 0) {
      console.log(`Columns in ${t}:`, Object.keys(data[0]))
    } else {
      console.log(`Table ${t} is empty.`)
    }
  }
}

inspectColumns()
