import fs from "fs"
import path from "path"
import { createClient } from "@supabase/supabase-js"
import { ethers } from "ethers"

// Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local")
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8")
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [k, ...v] = trimmed.split("=")
      process.env[k.trim()] = v.join("=").trim()
    }
  }
}

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bzgqvwqzbjqpfunnyfwe.supabase.co"
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey)
const db = supabase as any

const CANONICAL_ROLES = [
  "SYSTEM_ADMIN",
  "DIRECTOR",
  "ORG_UNIT_LEAD",
  "DEPT_ADMIN",
  "MEMBER",
  "FINANCE_ADMIN",
]

async function runDemoReadinessCheck() {
  console.log("\n=======================================================")
  console.log("🔍 WORKLEDGER DEMO READINESS SYSTEM DIAGNOSTIC")
  console.log("=======================================================\n")

  let passedChecks = 0
  let totalChecks = 0
  const blockers: string[] = []

  // Helper check
  const check = (label: string, passed: boolean, details?: string, blockerMsg?: string) => {
    totalChecks++
    if (passed) {
      passedChecks++
      console.log(`✅ [PASS] ${label} ${details ? `(${details})` : ""}`)
    } else {
      console.log(`❌ [FAIL] ${label} ${details ? `(${details})` : ""}`)
      if (blockerMsg) blockers.push(blockerMsg)
    }
  }

  // 1. Active Organization
  const { data: orgs, error: orgErr } = await db.from("organizations").select("id, name, slug").limit(5)
  check(
    "1. Active Organization Exists",
    !orgErr && orgs && orgs.length > 0,
    orgs ? `Found ${orgs.length} orgs: ${orgs.map((o: any) => o.name).join(", ")}` : "No orgs found",
    "No organization found. Sign up or create an organization first."
  )

  const activeOrg = orgs?.[0]
  if (!activeOrg) {
    console.log("\n🚫 Cannot continue without an active organization.")
    process.exit(1)
  }

  const orgId = activeOrg.id

  // 2. Departments
  const { data: depts, error: deptErr } = await db
    .from("org_units")
    .select("id, name, unit_type")
    .eq("organization_id", orgId)

  check(
    "2. Real Departments Exist",
    !deptErr && depts && depts.length > 0,
    depts ? `${depts.length} department(s): ${depts.map((d: any) => d.name).join(", ")}` : "0 departments",
    "No departments found. Create at least one department (e.g. CSE) from /config/departments."
  )

  // 3. Canonical Roles Seeded
  const { data: roles, error: rolesErr } = await db
    .from("roles")
    .select("id, name, scope_level")
    .eq("organization_id", orgId)

  const seededScopes = new Set((roles || []).map((r: any) => r.scope_level))
  const missingScopes = CANONICAL_ROLES.filter((s) => !seededScopes.has(s))

  check(
    "3. Canonical Tenant-Scoped Roles",
    missingScopes.length === 0,
    missingScopes.length === 0 ? `All 6 roles present (${roles?.length} records)` : `Missing: ${missingScopes.join(", ")}`,
    `Missing canonical roles: ${missingScopes.join(", ")}.`
  )

  // 4. System Admin & Director Accounts
  const { data: users, error: usersErr } = await db
    .from("users")
    .select(`
      id,
      name,
      email,
      org_unit_id,
      user_roles(
        roles(name, scope_level)
      )
    `)
    .eq("organization_id", orgId)

  const usersWithScopes = (users || []).map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    orgUnitId: u.org_unit_id,
    scopes: (u.user_roles || []).map((ur: any) => ur.roles?.scope_level).filter(Boolean),
  }))

  const sysAdmin = usersWithScopes.find((u: any) => u.scopes.includes("SYSTEM_ADMIN"))
  const director = usersWithScopes.find((u: any) => u.scopes.includes("DIRECTOR"))
  const hod = usersWithScopes.find((u: any) => u.scopes.includes("ORG_UNIT_LEAD"))
  const deptAdmin = usersWithScopes.find((u: any) => u.scopes.includes("DEPT_ADMIN"))
  const faculty = usersWithScopes.filter((u: any) => u.scopes.includes("MEMBER"))
  const finance = usersWithScopes.find((u: any) => u.scopes.includes("FINANCE_ADMIN"))

  check("4a. System Admin Exists", Boolean(sysAdmin), sysAdmin?.email, "No SYSTEM_ADMIN user found.")
  check("4b. Director Exists", Boolean(director), director?.email, "No DIRECTOR user found.")
  check("4c. HOD (ORG_UNIT_LEAD) Exists", Boolean(hod), hod?.email, "No HOD user found.")
  check("4d. Dept Admin Exists", Boolean(deptAdmin), deptAdmin?.email, "No DEPT_ADMIN user found.")
  check("4e. Member/Faculty Exists", faculty.length > 0, `${faculty.length} faculty members`, "No MEMBER/faculty user found.")
  check("4f. Finance Admin Exists", Boolean(finance), finance?.email, "No FINANCE_ADMIN user found.")

  // 5. Active Work Cycle
  const { data: cycles, error: cycleErr } = await db
    .from("work_cycles")
    .select("id, name, status, scheduled_weight_percentage, salary_threshold_percentage")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")

  const activeCycle = cycles?.[0]
  check(
    "5. Active Work Cycle Configured",
    Boolean(activeCycle),
    activeCycle
      ? `${activeCycle.name} (Scheduled Weight: ${activeCycle.scheduled_weight_percentage}%, Threshold: ${activeCycle.salary_threshold_percentage}%)`
      : "No active cycle",
    "No active work cycle found in database."
  )

  // 6. Timetable Templates & Instances
  const { data: templates } = await db
    .from("scheduled_work_templates")
    .select("id, title, weekly_day, credit_value")
    .eq("organization_id", orgId)
    .eq("active", true)

  const { data: instances } = await db
    .from("scheduled_work_instances")
    .select("id, title, work_date, status, credit_value")
    .eq("organization_id", orgId)

  check(
    "6a. Scheduled Work Templates",
    Boolean(templates && templates.length > 0),
    `${templates?.length || 0} recurring template(s)`,
    "No scheduled work templates found. Import faculty schedule from Dept Admin portal."
  )

  check(
    "6b. Scheduled Work Instances",
    Boolean(instances && instances.length > 0),
    `${instances?.length || 0} active instance(s)`,
    "No scheduled work instances found for the active cycle."
  )

  // 7. Default Task Type
  const { data: taskTypes } = await db
    .from("task_types")
    .select("id, name, category")
    .eq("organization_id", orgId)

  check(
    "7. Default Task Type Configured",
    Boolean(taskTypes && taskTypes.length > 0),
    `${taskTypes?.length || 0} task type(s)`,
    "No task types found. Ensure UNSTRUCTURED default task type is seeded."
  )

  // 8. Blockchain Readiness Check (Sepolia)
  const rpcUrl = process.env.SEPOLIA_RPC_URL
  const tokenAddress = process.env.WORK_TOKEN_ADDRESS
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY

  if (rpcUrl && tokenAddress && treasuryKey && ethers.isAddress(tokenAddress)) {
    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl)
      const network = await provider.getNetwork()
      const chainId = Number(network.chainId)
      const code = await provider.getCode(tokenAddress)
      const codeExists = code && code !== "0x"

      const treasuryWallet = new ethers.Wallet(treasuryKey, provider)
      const ethBalanceWei = await provider.getBalance(treasuryWallet.address)

      check(
        "8a. Sepolia Network Chain ID",
        chainId === 11155111,
        `Chain ID: ${chainId}`,
        `Expected Chain ID 11155111 (Sepolia), got ${chainId}`
      )

      check(
        "8b. WORK Token Contract Bytecode Verified",
        Boolean(codeExists),
        codeExists ? `Deployed at ${tokenAddress}` : `Address ${tokenAddress} has 0x code`,
        "WORK Token contract bytecode not found at WORK_TOKEN_ADDRESS on Sepolia."
      )

      check(
        "8c. Treasury ETH Balance for Gas",
        ethBalanceWei > BigInt(0),
        `Treasury (${treasuryWallet.address.slice(0, 8)}...): ${ethers.formatEther(ethBalanceWei)} ETH`,
        "Treasury wallet has 0 Sepolia ETH. Fund it with testnet Sepolia ETH."
      )
    } catch (bcErr: any) {
      check("8. Blockchain Readiness", false, bcErr?.message, "Sepolia RPC connection failed.")
    }
  } else {
    check(
      "8. Blockchain Environment Configured",
      false,
      "Missing SEPOLIA_RPC_URL, WORK_TOKEN_ADDRESS, or TREASURY_PRIVATE_KEY",
      "Configure SEPOLIA_RPC_URL, WORK_TOKEN_ADDRESS, and TREASURY_PRIVATE_KEY in .env.local"
    )
  }

  console.log("\n=======================================================")
  console.log(`📊 READINESS SCORE: ${passedChecks}/${totalChecks} CHECKS PASSED`)
  console.log("=======================================================\n")

  if (blockers.length === 0) {
    console.log("🎉 ALL CORE WORKFLOW COMPONENTS ARE DEMO READY FOR TOMORROW!\n")
  } else {
    console.log("⚠️ BLOCKERS & ACTION ITEMS IDENTIFIED:")
    blockers.forEach((b, idx) => console.log(`   ${idx + 1}. ${b}`))
    console.log("")
  }
}

runDemoReadinessCheck().catch((err) => {
  console.error("Diagnostic error:", err)
  process.exit(1)
})
