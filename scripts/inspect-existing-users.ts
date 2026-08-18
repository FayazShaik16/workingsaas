import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function inspect() {
  console.log("=== INSPECTING SUPABASE ORGANIZATIONS ===")
  const { data: orgs, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, type, created_at")
    .order("created_at", { ascending: false })

  if (orgErr) console.error("Org error:", orgErr)
  console.log("Organizations:", JSON.stringify(orgs, null, 2))

  console.log("\n=== INSPECTING AUTH USERS ===")
  const { data: authUsers, error: authErr } = await admin.auth.admin.listUsers({ perPage: 100 })
  if (authErr) console.error("Auth error:", authErr)
  console.log(`Found ${authUsers?.users?.length || 0} auth users:`)
  for (const u of authUsers?.users || []) {
    console.log(`- Auth ID: ${u.id} | Email: ${u.email} | Metadata:`, JSON.stringify(u.user_metadata))
  }

  console.log("\n=== INSPECTING PUBLIC USERS ===")
  const { data: pubUsers, error: pubErr } = await admin
    .from("users")
    .select("id, email, name, organization_id, designation, target_credits, progress_percentage")
    .order("created_at", { ascending: false })
  if (pubErr) console.error("Public users error:", pubErr)
  console.log(`Found ${pubUsers?.length || 0} public users:`)
  console.log(JSON.stringify(pubUsers, null, 2))
}

inspect().catch(console.error)
