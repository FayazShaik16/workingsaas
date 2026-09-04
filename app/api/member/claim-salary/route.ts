import { getSessionUser } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMemberMonthlyProgress } from "@/lib/workledger/progress"
import { getOrgCycleContext } from "@/lib/workledger/current-cycle"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const admin = createAdminClient()
    const db = admin as any

    const ctx = await getOrgCycleContext(user.organizationId)
    if (!ctx.activeWorkCycle) {
      return NextResponse.json(
        { error: "No active work cycle configured for this organization." },
        { status: 400 }
      )
    }

    // 1. Get live immutable progress from unified service layer
    const progress = await getMemberMonthlyProgress(user.organizationId, user.id, ctx.monthStart)

    if (!progress.configured || progress.totalTargetCredits <= 0) {
      return NextResponse.json(
        { error: "Your monthly work plan is not configured. Timetable templates must be allocated first." },
        { status: 400 }
      )
    }

    // Check 85% authorization threshold
    if (!progress.salaryEligible) {
      return NextResponse.json(
        {
          error: `Salary authorization threshold not met. Current progress is ${(progress.displayProgressPercentage || 0).toFixed(1)}% (requires ${progress.salaryThresholdPercentage || 85}%).`,
        },
        { status: 400 }
      )
    }

    // 2. Check open day rule (e.g. Day 26)
    const currentDay = new Date().getDate()
    const openDay = Number(ctx.activeWorkCycle.salary_request_opens_day ?? ctx.activeWorkCycle.salary_request_open_day ?? 26)
    if (currentDay < openDay) {
      return NextResponse.json(
        {
          error: `Salary claims open on Day ${openDay} of the month (today is Day ${currentDay}).`,
        },
        { status: 400 }
      )
    }

    // 3. Upsert salary request idempotently
    const { data: salaryReq, error: reqErr } = await db
      .from("salary_requests")
      .upsert(
        {
          organization_id: user.organizationId,
          work_cycle_id: ctx.activeWorkCycle.id,
          user_id: user.id,
          month_start: ctx.monthStart,
          requested_raw_credits: progress.rawEarnedCredits,
          requested_target_credits: progress.totalTargetCredits,
          threshold_percentage: progress.salaryThresholdPercentage || 85,
          status: "PENDING_HOD",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,user_id,work_cycle_id,month_start" }
      )
      .select("id, status, created_at")
      .single()

    if (reqErr) {
      console.error("[claim-salary] error:", reqErr)
      return NextResponse.json(
        { error: "Failed to record salary claim request." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      requestId: salaryReq?.id,
      earnedCredits: progress.rawEarnedCredits,
      targetCredits: progress.totalTargetCredits,
      progressPercentage: progress.displayProgressPercentage,
      status: "PENDING_HOD",
      message: `Salary claim for ${ctx.monthStart} (${progress.rawEarnedCredits.toFixed(1)} / ${progress.totalTargetCredits.toFixed(1)} credits, ${(progress.displayProgressPercentage || 0).toFixed(0)}%) successfully queued for HOD endorsement.`,
    })
  } catch (error: any) {
    console.error("[member/claim-salary] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
