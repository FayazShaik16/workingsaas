import { createAdminClient } from "@/lib/supabase/admin"

export interface MonthlyProgressView {
  configured: boolean
  workCycleId: string | null
  workCycleName: string | null
  monthStart: string | null
  scheduledTargetCredits: number
  totalTargetCredits: number
  scheduledEarnedCredits: number
  unscheduledEarnedCredits: number
  rawEarnedCredits: number
  displayProgressPercentage: number | null // capped 0..100
  aboveTargetCredits: number
  salaryThresholdPercentage: number | null
  creditsToThreshold: number | null
  salaryEligible: boolean
  salaryRequestOpenDate: string | null
  salaryRequestStatus: string | null
}

export async function getMemberMonthlyProgress(
  organizationId: string,
  userId: string,
  monthStartParam?: string
): Promise<MonthlyProgressView> {
  const admin = createAdminClient()
  const db = admin as any

  const today = new Date()
  const todayStr = today.toISOString().split("T")[0]
  const monthStart = monthStartParam || `${todayStr.slice(0, 7)}-01`

  // 1. Fetch active work cycle
  const { data: activeCycle } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!activeCycle) {
    return {
      configured: false,
      workCycleId: null,
      workCycleName: null,
      monthStart,
      scheduledTargetCredits: 0,
      totalTargetCredits: 0,
      scheduledEarnedCredits: 0,
      unscheduledEarnedCredits: 0,
      rawEarnedCredits: 0,
      displayProgressPercentage: null,
      aboveTargetCredits: 0,
      salaryThresholdPercentage: null,
      creditsToThreshold: null,
      salaryEligible: false,
      salaryRequestOpenDate: null,
      salaryRequestStatus: null,
    }
  }

  // 2. Compute scheduled target credits for this user in this month
  const { data: scheduledInstances } = await db
    .from("scheduled_work_instances")
    .select("credit_value")
    .eq("organization_id", organizationId)
    .eq("assigned_to_id", userId)
    .gte("work_date", monthStart)
    .neq("status", "CANCELLED")

  const scheduledTargetCredits = (scheduledInstances || []).reduce(
    (sum: number, inst: any) => sum + Number(inst.credit_value || 0),
    0
  )

  if (scheduledTargetCredits <= 0) {
    return {
      configured: false,
      workCycleId: activeCycle.id,
      workCycleName: activeCycle.name,
      monthStart,
      scheduledTargetCredits: 0,
      totalTargetCredits: 0,
      scheduledEarnedCredits: 0,
      unscheduledEarnedCredits: 0,
      rawEarnedCredits: 0,
      displayProgressPercentage: null,
      aboveTargetCredits: 0,
      salaryThresholdPercentage: Number(activeCycle.salary_authorization_threshold_percentage),
      creditsToThreshold: null,
      salaryEligible: false,
      salaryRequestOpenDate: null,
      salaryRequestStatus: null,
    }
  }

  // 3. Compute total target based on scheduled work weight percentage (e.g. 75%)
  const scheduledWeight = Number(activeCycle.scheduled_work_weight_percentage || 75.0)
  const totalTargetCredits = Math.round((scheduledTargetCredits / (scheduledWeight / 100)) * 100) / 100

  // 4. Query credit ledger entries for this month
  const { data: ledgerEntries } = await db
    .from("credit_ledger_entries")
    .select("credit_type, credit_amount")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .gte("occurred_at", `${monthStart}T00:00:00Z`)

  let scheduledEarned = 0
  let unscheduledEarned = 0

  for (const entry of ledgerEntries || []) {
    const amt = Number(entry.credit_amount || 0)
    if (entry.credit_type === "STRUCTURED_SELF_COMPLETION") {
      scheduledEarned += amt
    } else {
      unscheduledEarned += amt
    }
  }

  const rawEarnedCredits = Math.round((scheduledEarned + unscheduledEarned) * 100) / 100
  const displayProgressPercentage = totalTargetCredits > 0
    ? Math.min(100, Math.round((rawEarnedCredits / totalTargetCredits) * 10000) / 100)
    : 0

  const aboveTargetCredits = Math.max(0, Math.round((rawEarnedCredits - totalTargetCredits) * 100) / 100)

  // 5. Salary Authorization Threshold (e.g. 85%)
  const thresholdPct = Number(activeCycle.salary_authorization_threshold_percentage || 85.0)
  const thresholdRequirement = Math.round(((totalTargetCredits * thresholdPct) / 100) * 100) / 100
  const creditsToThreshold = Math.max(0, Math.round((thresholdRequirement - rawEarnedCredits) * 100) / 100)
  const isSalaryEligible = rawEarnedCredits >= thresholdRequirement

  // 6. Check existing salary request
  const { data: salaryReq } = await db
    .from("salary_requests")
    .select("status, created_at")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .eq("month_start", monthStart)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  const openDay = Number(activeCycle.salary_request_open_day || 26)
  const openDateStr = `${monthStart.slice(0, 7)}-${String(openDay).padStart(2, "0")}`

  // 7. Persist or update cached row in monthly_work_progress idempotently
  await db.from("monthly_work_progress").upsert(
    {
      organization_id: organizationId,
      work_cycle_id: activeCycle.id,
      user_id: userId,
      month_start: monthStart,
      scheduled_target_credits: scheduledTargetCredits,
      total_target_credits: totalTargetCredits,
      scheduled_earned_credits: scheduledEarned,
      unscheduled_earned_credits: unscheduledEarned,
      raw_earned_credits: rawEarnedCredits,
      display_progress_percentage: displayProgressPercentage,
      salary_eligible: isSalaryEligible,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id,month_start" }
  )

  return {
    configured: true,
    workCycleId: activeCycle.id,
    workCycleName: activeCycle.name,
    monthStart,
    scheduledTargetCredits,
    totalTargetCredits,
    scheduledEarnedCredits: scheduledEarned,
    unscheduledEarnedCredits: unscheduledEarned,
    rawEarnedCredits,
    displayProgressPercentage,
    aboveTargetCredits,
    salaryThresholdPercentage: thresholdPct,
    creditsToThreshold,
    salaryEligible: isSalaryEligible,
    salaryRequestOpenDate: openDateStr,
    salaryRequestStatus: salaryReq?.status || null,
  }
}
