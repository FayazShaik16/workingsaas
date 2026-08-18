import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const client = createClient(supabaseUrl, anonKey)

const logins = [
  { email: "director@mvgr.edu.in", pass: "DemoDirector@2026!", role: "Director" },
  { email: "hod.cse@mvgr.edu.in", pass: "DemoHod@2026!", role: "HOD" },
  { email: "faculty.cse1@mvgr.edu.in", pass: "DemoFaculty@2026!", role: "Faculty" },
  { email: "finance@mvgr.edu.in", pass: "DemoFinance@2026!", role: "Finance" },
]

async function testAllLogins() {
  console.log("=== TESTING LIVE SUPABASE AUTH LOGIN ===")
  for (const item of logins) {
    const { data, error } = await client.auth.signInWithPassword({
      email: item.email,
      password: item.pass,
    })

    if (error || !data.user) {
      console.error(`❌ LOGIN FAILED for ${item.role} (${item.email}):`, error?.message)
      process.exit(1)
    } else {
      console.log(`✅ LOGIN SUCCESS: ${item.role} (${item.email}) | User ID: ${data.user.id} | must_change_password: ${data.user.user_metadata?.must_change_password}`)
    }
  }
  console.log("\n🎯 ALL 4 ACCOUNTS AUTHENTICATED SUCCESSFULLY AGAINST SUPABASE!")
}

testAllLogins().catch(console.error)
