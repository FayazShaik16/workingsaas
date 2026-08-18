import { createClient } from "@supabase/supabase-js"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("FATAL: Missing NEXT_PUBLIC_SUPABASE_URL or secret key in .env.local")
  process.exit(1)
}

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

interface AccountTarget {
  roleTitle: string
  targetEmail: string
  searchName: string
  searchEmailPrefix: string
  envPasswordVar: string
  defaultPassword: string
  mustChangePassword: boolean
}

const TARGET_ACCOUNTS: AccountTarget[] = [
  {
    roleTitle: "Director & Principal",
    targetEmail: "director@mvgr.edu.in",
    searchName: "Dr. K. V. L. Raju (Director)",
    searchEmailPrefix: "director",
    envPasswordVar: "DEMO_DIRECTOR_PASSWORD",
    defaultPassword: process.env.DEMO_DIRECTOR_PASSWORD || "DemoDirector@2026!",
    mustChangePassword: false,
  },
  {
    roleTitle: "CSE Department HOD",
    targetEmail: "hod.cse@mvgr.edu.in",
    searchName: "Dr. R. Ravikanth",
    searchEmailPrefix: "hod.cse",
    envPasswordVar: "DEMO_HOD_PASSWORD",
    defaultPassword: process.env.DEMO_HOD_PASSWORD || "DemoHod@2026!",
    mustChangePassword: false,
  },
  {
    roleTitle: "CSE Teaching Faculty",
    targetEmail: "faculty.cse1@mvgr.edu.in",
    searchName: "Dr. P. Satyanarayana",
    searchEmailPrefix: "faculty.cse1",
    envPasswordVar: "DEMO_FACULTY_PASSWORD",
    defaultPassword: process.env.DEMO_FACULTY_PASSWORD || "DemoFaculty@2026!",
    mustChangePassword: false,
  },
  {
    roleTitle: "Finance Administrator",
    targetEmail: "finance@mvgr.edu.in",
    searchName: "Mr. B. Accounts Officer",
    searchEmailPrefix: "finance",
    envPasswordVar: "DEMO_FINANCE_PASSWORD",
    defaultPassword: process.env.DEMO_FINANCE_PASSWORD || "DemoFinance@2026!",
    mustChangePassword: false,
  },
]

async function restoreDemoAccess() {
  console.log("=================================================================")
  console.log(" WORKLEDGER DEMO CREDENTIAL RECOVERY & ACCESS RESTORATION")
  console.log(` Supabase Instance: ${supabaseUrl}`)
  console.log("=================================================================\n")

  // 1. Locate the active demo organization
  const { data: orgs, error: orgErr } = await admin
    .from("organizations")
    .select("id, name, created_at")
    .order("created_at", { ascending: false })
    .limit(10)

  if (orgErr || !orgs || orgs.length === 0) {
    console.error("FATAL: No organizations found in Supabase database.", orgErr)
    process.exit(1)
  }

  // Find the latest MVGR Demo organization containing our compiled data
  let targetOrg = orgs[0]
  for (const org of orgs) {
    const { data: usersCount } = await admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org.id)

    if ((usersCount as any) >= 4 || org.name.includes("MVGR")) {
      targetOrg = org
      break
    }
  }

  console.log(`[TARGET ORGANIZATION] "${targetOrg.name}" (ID: ${targetOrg.id})\n`)

  // 2. Fetch all public users in this organization
  const { data: orgUsers, error: usersErr } = await admin
    .from("users")
    .select(`
      id,
      email,
      name,
      designation,
      organization_id,
      org_unit_id,
      org_units!users_org_unit_id_fkey (id, name, unit_type),
      user_roles (
        role_id,
        roles (name, scope_level)
      )
    `)
    .eq("organization_id", targetOrg.id)

  if (usersErr || !orgUsers || orgUsers.length === 0) {
    console.error(`FATAL: Could not fetch users for org ${targetOrg.id}:`, usersErr)
    process.exit(1)
  }

  // 3. Fetch all auth users to correlate
  const { data: authData, error: authErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (authErr || !authData) {
    console.error("FATAL: Failed to list Supabase Auth users:", authErr)
    process.exit(1)
  }

  const authMap = new Map<string, any>()
  for (const u of authData.users) {
    authMap.set(u.id, u)
    if (u.email) authMap.set(u.email.toLowerCase(), u)
  }

  const updatedTable: any[] = []
  const missingAccounts: string[] = []

  for (const target of TARGET_ACCOUNTS) {
    // Find matching public user in target organization
    let userRecord = orgUsers.find(
      (u) =>
        u.email.toLowerCase() === target.targetEmail.toLowerCase() ||
        u.email.toLowerCase().startsWith(target.searchEmailPrefix) ||
        u.name.toLowerCase().includes(target.searchName.toLowerCase()) ||
        (target.roleTitle.includes("Director") && u.designation?.includes("Director"))
    )

    if (!userRecord) {
      console.error(`❌ REQUIRED ACCOUNT MISSING: ${target.roleTitle} (${target.targetEmail})`)
      missingAccounts.push(target.targetEmail)
      continue
    }

    const authUser = authMap.get(userRecord.id) || authMap.get(userRecord.email.toLowerCase())
    if (!authUser) {
      console.error(`❌ SUPABASE AUTH USER MISSING for: ${userRecord.email} (ID: ${userRecord.id})`)
      missingAccounts.push(target.targetEmail)
      continue
    }

    const authId = authUser.id

    // Check personal wallet
    const { data: wallet } = await admin
      .from("wallets")
      .select("id, balance, purpose")
      .eq("owner_user_id", userRecord.id)
      .eq("purpose", "PERSONAL")
      .maybeSingle()

    // 4. Reset password and update Auth metadata
    const updatedMetadata = {
      ...(authUser.user_metadata || {}),
      name: userRecord.name,
      organization_id: targetOrg.id,
      must_change_password: target.mustChangePassword,
    }

    const { error: updateAuthErr } = await admin.auth.admin.updateUserById(authId, {
      email: target.targetEmail,
      password: target.defaultPassword,
      email_confirm: true,
      user_metadata: updatedMetadata,
    })

    if (updateAuthErr) {
      console.error(`❌ Failed to update auth record for ${target.targetEmail}:`, updateAuthErr)
      missingAccounts.push(target.targetEmail)
      continue
    }

    // 5. Update public.users email to match canonical target email
    if (userRecord.email !== target.targetEmail) {
      await admin
        .from("users")
        .update({ email: target.targetEmail })
        .eq("id", userRecord.id)
    }

    // Extract role names and scopes
    const rolesList = (userRecord.user_roles || [])
      .map((ur: any) => `${ur.roles?.name} (${ur.roles?.scope_level})`)
      .join(", ")

    const deptName = (userRecord.org_units as any)?.name || "Central Administration"

    updatedTable.push({
      Role: target.roleTitle,
      Email: target.targetEmail,
      PasswordStatus: "Updated & Confirmed",
      AuthID: authId,
      PublicUserID: userRecord.id,
      OrgID: targetOrg.id,
      Department: deptName,
      Roles: rolesList || "MEMBER",
      PersonalWallet: wallet ? `YES (Bal: ${wallet.balance})` : "NO",
      MustChangePassword: "false (Direct Workspace Access)",
    })
  }

  if (missingAccounts.length > 0) {
    console.error(`\n❌ RESTORATION FAILED. Missing required accounts: ${missingAccounts.join(", ")}`)
    process.exit(1)
  }

  console.log("=================================================================")
  console.log(" ✅ ALL 4 DEMO PRESENTER ACCOUNTS SUCCESSFULLY RESTORED")
  console.log("=================================================================\n")
  console.table(
    updatedTable.map((row) => ({
      Role: row.Role,
      Email: row.Email,
      Department: row.Department,
      Roles: row.Roles,
      PersonalWallet: row.PersonalWallet,
      AuthID: row.AuthID,
    }))
  )

  console.log("\n--- READY-TO-USE DEMO LOGIN CREDENTIALS ---")
  console.log("Organization ID:", targetOrg.id)
  console.log("Base Login URL:  http://localhost:3000/login\n")
  for (const acc of TARGET_ACCOUNTS) {
    console.log(`• [${acc.roleTitle}]`)
    console.log(`  Email:    ${acc.targetEmail}`)
    console.log(`  Password: [CONFIGURED IN SUPABASE AUTH]`)
    console.log(`  Landing:  http://localhost:3000/${targetOrg.id}/${acc.roleTitle.toLowerCase().includes("director") ? "director" : acc.roleTitle.toLowerCase().includes("hod") ? "lead" : acc.roleTitle.toLowerCase().includes("finance") ? "finance/salary" : "member"}\n`)
  }
}

restoreDemoAccess().catch((err) => {
  console.error("FATAL UNCAUGHT ERROR:", err)
  process.exit(1)
})
