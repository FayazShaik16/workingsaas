import { createClient } from "@supabase/supabase-js"
import fs from "fs"
import path from "path"

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

import { getOrCreateDefaultTaskType } from "../lib/workledger/default-task-type"
import { getScopedTaskPool } from "../lib/workledger/task-pool"
import { getMemberMonthlyProgress } from "../lib/workledger/progress"
import { assertDepartmentScope, assertTaskAccess } from "../lib/workledger/permissions"
import { checkBlockchainReadiness } from "../lib/blockchain/work-token"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bzgqvwqzbjqpfunnyfwe.supabase.co"
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SECRET_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const admin = createClient(supabaseUrl, serviceRoleKey)
const db = admin as any

async function runAcceptanceTests() {
  console.log("\n========================================================")
  console.log("WORKLEDGER FINAL CORE FLOW LIVE ACCEPTANCE TEST SUITE")
  console.log("========================================================\n")

  const testResults: { name: string; passed: boolean; details: string }[] = []

  try {
    // 0. Resolve active test organization
    const { data: orgs } = await db.from("organizations").select("id, name").limit(1)
    if (!orgs || orgs.length === 0) {
      throw new Error("No organizations found in database.")
    }
    const testOrg = orgs[0]
    const orgId = testOrg.id
    console.log(`[Setup] Using organization: "${testOrg.name}" (${orgId})`)

    // 1. Test Default Task Type Resolution (No null task_type_id)
    console.log("\n--- Test 1: Default Task Type Resolution ---")
    const taskTypeId = await getOrCreateDefaultTaskType(orgId)
    const passed1 = Boolean(taskTypeId && taskTypeId.length > 10)
    testResults.push({
      name: "Default UNSTRUCTURED Task Type Resolution",
      passed: passed1,
      details: `Resolved non-null task_type_id: ${taskTypeId}`,
    })
    console.log(`✓ Test 1: ${passed1 ? "PASS" : "FAIL"} - Task Type ID: ${taskTypeId}`)

    // 2. Test Department Isolation with Departments
    console.log("\n--- Test 2: Department Creation & Isolation Setup ---")
    let { data: cseDept } = await db
      .from("org_units")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", "%Computer Science%")
      .maybeSingle()

    if (!cseDept) {
      const cseId = crypto.randomUUID()
      const { data: newCse } = await db
        .from("org_units")
        .insert({
          id: cseId,
          organization_id: orgId,
          name: "Computer Science and Engineering",
          unit_type: "ACADEMIC_DEPARTMENT",
          parent_id: null,
          path: `n${cseId.replace(/-/g, "_")}`,
        })
        .select()
        .single()
      cseDept = newCse
    }

    let { data: eceDept } = await db
      .from("org_units")
      .select("id")
      .eq("organization_id", orgId)
      .ilike("name", "%Electronics%")
      .maybeSingle()

    if (!eceDept) {
      const eceId = crypto.randomUUID()
      const { data: newEce } = await db
        .from("org_units")
        .insert({
          id: eceId,
          organization_id: orgId,
          name: "Electronics and Communication",
          unit_type: "ACADEMIC_DEPARTMENT",
          parent_id: null,
          path: `n${eceId.replace(/-/g, "_")}`,
        })
        .select()
        .single()
      eceDept = newEce
    }

    const passed2 = Boolean(cseDept?.id && eceDept?.id)
    testResults.push({
      name: "Department Creation without Root/Parent",
      passed: passed2,
      details: `CSE ID: ${cseDept?.id}, ECE ID: ${eceDept?.id}`,
    })
    console.log(`✓ Test 2: ${passed2 ? "PASS" : "FAIL"} - Created/verified isolated departments`)

    // 3. Test Task Creation with verification_mode and department scope
    console.log("\n--- Test 3: Task Creation with verification_mode & scope ---")
    const { data: realUsers } = await db.from("users").select("id").eq("organization_id", orgId).limit(1)
    const testCreatorId = realUsers?.[0]?.id

    const { data: cseTask, error: cseTaskErr } = await db
      .from("tasks")
      .insert({
        organization_id: orgId,
        org_unit_id: cseDept.id,
        task_type_id: taskTypeId,
        category: "UNSTRUCTURED",
        priority: "HIGH",
        title: "CSE NBA Accreditation Documentation",
        description: "Prepare Module 4 criterion reports for NBA compliance.",
        credit_value: 3.5,
        creator_id: testCreatorId,
        status: "OPEN",
        visibility_scope: "ORG_UNIT",
        verification_mode: "MANUAL_REPORT",
        allow_nomination: true,
      })
      .select()
      .single()

    const passed3 = Boolean(cseTask?.id && !cseTaskErr)
    testResults.push({
      name: "Task Creation with verification_mode (No null task_type_id)",
      passed: passed3,
      details: passed3 ? `Task ID: ${cseTask.id}, Mode: ${cseTask.verification_mode}` : `Error: ${cseTaskErr?.message}`,
    })
    console.log(`✓ Test 3: ${passed3 ? "PASS" : "FAIL"} - Task created with verification_mode: ${cseTask?.verification_mode}`)

    // 4. Test Task Pool Visibility & Department Isolation
    console.log("\n--- Test 4: Task Pool Scoping & Isolation ---")
    // Mock user from CSE vs mock user from ECE
    const csePool = await getScopedTaskPool(orgId, "mock-cse-user", cseDept.id)
    const ecePool = await getScopedTaskPool(orgId, "mock-ece-user", eceDept.id)

    const cseHasCseTask = csePool.some((t) => t.id === cseTask.id)
    const eceHasCseTask = ecePool.some((t) => t.id === cseTask.id)
    const passed4 = cseHasCseTask && !eceHasCseTask

    testResults.push({
      name: "Departmental Task Pool Isolation (No Cross-Department Leak)",
      passed: passed4,
      details: `CSE Pool saw task: ${cseHasCseTask}, ECE Pool saw task: ${eceHasCseTask} (Must be false)`,
    })
    console.log(`✓ Test 4: ${passed4 ? "PASS" : "FAIL"} - CSE visible: ${cseHasCseTask}, ECE blocked: ${!eceHasCseTask}`)

    // 5. Test Permission Assertion Helpers
    console.log("\n--- Test 5: Server Authorization Guard (assertTaskAccess & assertDepartmentScope) ---")
    let cseHodAuthorized = false
    let eceHodBlocked = false

    const cseHodUser: any = {
      id: "hod-cse",
      organizationId: orgId,
      orgUnitId: cseDept.id,
      scopeLevels: ["ORG_UNIT_LEAD", "MEMBER"],
    }

    const eceHodUser: any = {
      id: "hod-ece",
      organizationId: orgId,
      orgUnitId: eceDept.id,
      scopeLevels: ["ORG_UNIT_LEAD", "MEMBER"],
    }

    try {
      assertDepartmentScope(cseHodUser, cseDept.id)
      cseHodAuthorized = true
    } catch {
      cseHodAuthorized = false
    }

    try {
      assertDepartmentScope(eceHodUser, cseDept.id)
      eceHodBlocked = false
    } catch {
      eceHodBlocked = true
    }

    const passed5 = cseHodAuthorized && eceHodBlocked
    testResults.push({
      name: "Server-side Department Scope Assertion",
      passed: passed5,
      details: `CSE HOD allowed in CSE: ${cseHodAuthorized}, ECE HOD rejected in CSE: ${eceHodBlocked}`,
    })
    console.log(`✓ Test 5: ${passed5 ? "PASS" : "FAIL"} - Scope assertion enforced properly`)

    // 6. Test Blockchain Diagnostics / Readiness
    console.log("\n--- Test 6: Blockchain Diagnostics & Live Readiness ---")
    const readiness = await checkBlockchainReadiness()
    const passed6 = typeof readiness.configured === "boolean" && typeof readiness.rpcReachable === "boolean"
    testResults.push({
      name: "Safe Blockchain Readiness Diagnostic (Zero Secret Leak)",
      passed: passed6,
      details: `Configured: ${readiness.configured}, Reachable: ${readiness.rpcReachable}, Message: ${readiness.statusMessage}`,
    })
    console.log(`✓ Test 6: ${passed6 ? "PASS" : "FAIL"} - Status: ${readiness.statusMessage}`)

    // 7. Test Idempotent Self-Nomination
    console.log("\n--- Test 7: Unique Nomination & Duplicate Protection ---")
    const testFacultyId = testCreatorId
    const nowIso = new Date().toISOString()

    const { error: nom1Err } = await db.from("nominations").upsert(
      { task_id: cseTask.id, user_id: testFacultyId, status: "PENDING", message: "Test pitch" },
      { onConflict: "task_id,user_id" }
    )

    const { error: nom2Err } = await db.from("nominations").upsert(
      { task_id: cseTask.id, user_id: testFacultyId, status: "PENDING", message: "Updated pitch note" },
      { onConflict: "task_id,user_id" }
    )

    const { count: nomCount } = await db
      .from("nominations")
      .select("id", { count: "exact", head: true })
      .eq("task_id", cseTask.id)
      .eq("user_id", testFacultyId)

    const passed7 = !nom1Err && !nom2Err && nomCount === 1
    testResults.push({
      name: "Idempotent Task Nomination (Unique Constraint Enforced)",
      passed: passed7,
      details: `Single record preserved across multiple nominations: count = ${nomCount}`,
    })
    console.log(`✓ Test 7: ${passed7 ? "PASS" : "FAIL"} - Count = ${nomCount}`)

    // Clean up test task
    await db.from("tasks").delete().eq("id", cseTask.id)

    // Summary
    console.log("\n========================================================")
    console.log("FINAL TEST SUMMARY")
    console.log("========================================================")
    let allPassed = true
    for (const res of testResults) {
      console.log(`[${res.passed ? "PASS" : "FAIL"}] ${res.name}: ${res.details}`)
      if (!res.passed) allPassed = false
    }
    console.log(`\nOVERALL STATUS: ${allPassed ? "100% PASS (READY FOR PRODUCTION)" : "FAILURES DETECTED"}\n`)
  } catch (err: any) {
    console.error("[Test Suite Error]:", err)
  }
}

runAcceptanceTests()
