import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { assertDepartmentScope, AuthorizationError } from "@/lib/workledger/permissions"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      userId,
      baseSalary,
      currency = "INR",
      targetCredits = 20.0,
      thresholdPercentage = 85.0,
      notes = "",
    } = body

    if (!userId) {
      return NextResponse.json({ error: "userId is required." }, { status: 400 })
    }

    const numBaseSalary = Number(baseSalary)
    if (isNaN(numBaseSalary) || numBaseSalary < 0) {
      return NextResponse.json({ error: "A valid non-negative base salary amount is required." }, { status: 400 })
    }

    const numTargetCredits = Number(targetCredits)
    if (isNaN(numTargetCredits) || numTargetCredits <= 0) {
      return NextResponse.json({ error: "A valid positive token target is required (e.g. 20 WORK credits)." }, { status: 400 })
    }

    const numThreshold = Number(thresholdPercentage) || 85.0

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch target faculty/member
    const { data: targetUser, error: userErr } = await db
      .from("users")
      .select("id, name, email, designation, org_unit_id, organization_id, skills, target_credits")
      .eq("id", userId)
      .eq("organization_id", user.organizationId)
      .single()

    if (userErr || !targetUser) {
      return NextResponse.json({ error: "Faculty member not found in this organization." }, { status: 404 })
    }

    // 2. Validate role scope (Director/System Admin: Org-wide; HOD: Own department only)
    try {
      assertDepartmentScope(user, targetUser.org_unit_id, [
        "DIRECTOR",
        "SYSTEM_ADMIN",
        "ORG_UNIT_LEAD",
      ])
    } catch (authErr: any) {
      return NextResponse.json(
        {
          error:
            authErr instanceof AuthorizationError
              ? authErr.message
              : "Access denied. Only Directors and Department Leads can configure salary components.",
        },
        { status: 403 }
      )
    }

    // 3. Update user record with target_credits and salary_component metadata
    const currentSkills =
      targetUser.skills && typeof targetUser.skills === "object" && !Array.isArray(targetUser.skills)
        ? targetUser.skills
        : {}

    const updatedSkills = {
      ...currentSkills,
      salary_component: {
        base_salary: numBaseSalary,
        currency: currency || "INR",
        target_credits: numTargetCredits,
        threshold_percentage: numThreshold,
        notes: notes || "",
        updated_at: new Date().toISOString(),
        updated_by: user.id,
      },
    }

    const { error: updateErr } = await db
      .from("users")
      .update({
        target_credits: numTargetCredits,
        skills: updatedSkills,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (updateErr) {
      console.error("[set-salary-component] update users error:", updateErr)
      return NextResponse.json({ error: "Failed to update member salary settings." }, { status: 500 })
    }

    // 4. Update or Insert compensation_policy record
    const todayStr = new Date().toISOString().split("T")[0]
    const currentMonthStart = `${todayStr.slice(0, 7)}-01`

    try {
      const { data: existingPolicy } = await db
        .from("compensation_policies")
        .select("id")
        .eq("organization_id", user.organizationId)
        .eq("scope_type", "USER")
        .eq("scope_id", userId)
        .maybeSingle()

      if (existingPolicy?.id) {
        await db
          .from("compensation_policies")
          .update({
            monthly_target_credits: numTargetCredits,
            threshold_percentage: numThreshold,
            is_active: true,
          })
          .eq("id", existingPolicy.id)
      } else {
        await db.from("compensation_policies").insert({
          organization_id: user.organizationId,
          scope_type: "USER",
          scope_id: userId,
          monthly_target_credits: numTargetCredits,
          baseline_minimum_credits: 0,
          threshold_percentage: numThreshold,
          grace_period_days: 7,
          effective_from: currentMonthStart,
          is_active: true,
        })
      }
    } catch (policyErr: any) {
      console.warn("[set-salary-component] compensation_policies note:", policyErr?.message)
    }

    return NextResponse.json({
      success: true,
      message: `Salary component successfully configured for ${targetUser.name}: ${currency} ${numBaseSalary.toLocaleString()} (${numTargetCredits} WORK tokens).`,
      salaryComponent: {
        userId,
        userName: targetUser.name,
        baseSalary: numBaseSalary,
        currency,
        targetCredits: numTargetCredits,
        thresholdPercentage: numThreshold,
      },
    })
  } catch (error: any) {
    console.error("[set-salary-component] Server error:", error)
    return NextResponse.json({ error: error?.message || "Internal server error" }, { status: 500 })
  }
}
