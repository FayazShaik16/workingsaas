import { createClient } from "@/lib/supabase/server"

export interface CompileResult {
  success: boolean
  facultyId: string
  month: number
  year: number
  tasksCreated: number
  structuredCredits: number
  targetCredits: number
  error?: string
}

export interface BatchCompileResult {
  success: boolean
  organizationId: string
  facultyCount: number
  totalTasksCreated: number
  details: CompileResult[]
  error?: string
}

export interface SalaryEligibilityResult {
  eligible: boolean
  progressPct: number
  earned: number
  target: number
  structuredEarned: number
  unstructuredEarned: number
  hasVerifiedUnstructured: boolean
}

/**
 * Compiles weekly timetable slots into concrete recurring task instances for a faculty member.
 * Strictly idempotent: executing multiple times for the same month skips already generated slot instances.
 * Implements the 75/25 credit model (target = S / 0.75).
 */
export async function compileMonthlyScheduleTasks(
  organizationId: string,
  facultyId: string,
  year: number,
  month: number
): Promise<CompileResult> {
  const supabase = await createClient()
  const db = supabase as any

  try {
    // 1. Attempt server RPC compilation if available
    const { data: rpcData, error: rpcError } = await db.rpc("compile_cycle_tasks_for_faculty", {
      p_organization_id: organizationId,
      p_faculty_id: facultyId,
      p_year: year,
      p_month: month,
    })

    if (!rpcError && rpcData?.success) {
      return {
        success: true,
        facultyId,
        month,
        year,
        tasksCreated: rpcData.tasks_created ?? 0,
        structuredCredits: Number(rpcData.structured_credits ?? 0),
        targetCredits: Number(rpcData.target_credits ?? 0),
      }
    }

    // 2. TypeScript fallback compiler in case RPC is pending DB execution
    const startDate = new Date(Date.UTC(year, month - 1, 1))
    const endDate = new Date(Date.UTC(year, month, 0))

    // Fetch user org unit
    const { data: userRecord } = await db
      .from("users")
      .select("org_unit_id")
      .eq("id", facultyId)
      .single()

    const orgUnitId = userRecord?.org_unit_id

    // Fetch active assignments & timetable slots
    const { data: assignments, error: assignError } = await db
      .from("subject_assignments")
      .select(`
        id,
        batch_id,
        subject_id,
        subjects (id, name, code, subject_type),
        academic_batches (id, section, year_of_study),
        timetable_slots (
          id,
          day_of_week,
          period_number,
          start_time,
          end_time,
          room,
          task_type_code,
          is_active
        )
      `)
      .eq("organization_id", organizationId)
      .eq("faculty_id", facultyId)
      .eq("is_active", true)

    if (assignError) throw assignError

    // Fetch standalone slots (e.g. CLASS_PREP, TUTORIAL, etc.)
    const { data: standaloneSlots } = await db
      .from("timetable_slots")
      .select("id, day_of_week, period_number, start_time, end_time, room, task_type_code, is_active")
      .eq("organization_id", organizationId)
      .eq("faculty_id", facultyId)
      .is("subject_assignment_id", null)
      .eq("is_active", true)

    // Fetch rate card definitions
    const { data: taskTypes } = await db
      .from("task_type_definitions")
      .select("id, code, default_credit_value")
      .eq("organization_id", organizationId)

    const creditByCode = new Map<string, { id: string; credit: number }>()
    for (const tt of taskTypes || []) {
      if (tt.code) {
        creditByCode.set(tt.code, {
          id: tt.id,
          credit: Number(tt.default_credit_value || 1.0),
        })
      }
    }

    const defaultType = creditByCode.get("TEACHING_LECTURE") || {
      id: "00000000-0000-0000-0000-000000000001",
      credit: 1.0,
    }

    const dayMap = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
    let tasksCreatedCount = 0
    let totalStructuredCredits = 0

    const tasksToInsert: any[] = []

    // Iterate day-by-day through the month
    for (let d = new Date(startDate); d <= endDate; d.setUTCDate(d.getUTCDate() + 1)) {
      const dowString = dayMap[d.getUTCDay()]
      if (dowString === "SUN") continue

      const dateStr = d.toISOString().split("T")[0]

      // A. Subject Assignment Slots
      for (const assignment of assignments ?? []) {
        const subject = assignment.subjects as any
        const slots = (assignment.timetable_slots as any[]) ?? []

        for (const slot of slots) {
          if (!slot.is_active || slot.day_of_week !== dowString) continue

          const code = slot.task_type_code || (subject?.subject_type === "LAB" ? "TEACHING_LAB" : "TEACHING_LECTURE")
          const typeDef = creditByCode.get(code) || defaultType
          const slotCredit = typeDef.credit
          totalStructuredCredits += slotCredit

          tasksToInsert.push({
            organization_id: organizationId,
            org_unit_id: orgUnitId,
            task_type_id: typeDef.id,
            category: "STRUCTURED",
            visibility_scope: "ORG_UNIT",
            title: `${subject?.code || "SUB"} - ${subject?.name || "Lecture"} (Period ${slot.period_number})`,
            description: `Scheduled ${subject?.subject_type || "THEORY"} session on ${dateStr} in ${slot.room || "Classroom"}`,
            credit_value: slotCredit,
            creator_id: facultyId,
            assigned_to_id: facultyId,
            status: "ASSIGNED",
            source_timetable_slot_id: slot.id,
            scheduled_date: dateStr,
            academic_batch_id: assignment.batch_id,
            subject_id: assignment.subject_id,
            deadline: `${dateStr}T${slot.end_time || "17:00:00"}Z`,
          })
        }
      }

      // B. Standalone Structured Slots (Class Prep, Tutorials, Admin Assist)
      for (const slot of standaloneSlots ?? []) {
        if (!slot.is_active || slot.day_of_week !== dowString) continue

        const code = slot.task_type_code || "CLASS_PREP"
        const typeDef = creditByCode.get(code) || defaultType
        const slotCredit = typeDef.credit
        totalStructuredCredits += slotCredit

        tasksToInsert.push({
          organization_id: organizationId,
          org_unit_id: orgUnitId,
          task_type_id: typeDef.id,
          category: "STRUCTURED",
          visibility_scope: "ORG_UNIT",
          title: `${code.replace(/_/g, " ")} (Period ${slot.period_number})`,
          description: `Scheduled activity on ${dateStr} in ${slot.room || "Department"}`,
          credit_value: slotCredit,
          creator_id: facultyId,
          assigned_to_id: facultyId,
          status: "ASSIGNED",
          source_timetable_slot_id: slot.id,
          scheduled_date: dateStr,
          academic_batch_id: null,
          subject_id: null,
          deadline: `${dateStr}T${slot.end_time || "17:00:00"}Z`,
        })
      }
    }

    if (tasksToInsert.length > 0) {
      const { data: inserted, error: insertError } = await db
        .from("tasks")
        .upsert(tasksToInsert, {
          onConflict: "organization_id,source_timetable_slot_id,scheduled_date",
          ignoreDuplicates: true,
        })
        .select("id")

      if (!insertError) {
        tasksCreatedCount = inserted?.length || 0
      }
    }

    // 75/25 Model: Target = S / 0.75 (Structured is 75%, dynamic is 25%)
    let calculatedTarget = 50.0
    if (totalStructuredCredits > 0) {
      calculatedTarget = Math.round((totalStructuredCredits / 0.75) * 100) / 100
    } else {
      const { data: policy } = await db
        .from("compensation_policies")
        .select("monthly_target_credits")
        .eq("organization_id", organizationId)
        .eq("scope_type", "ORG_WIDE")
        .maybeSingle()
      calculatedTarget = Number(policy?.monthly_target_credits || 0)
    }

    await db
      .from("users")
      .update({ target_credits: calculatedTarget, updated_at: new Date().toISOString() })
      .eq("id", facultyId)

    return {
      success: true,
      facultyId,
      month,
      year,
      tasksCreated: tasksCreatedCount,
      structuredCredits: totalStructuredCredits,
      targetCredits: calculatedTarget,
    }
  } catch (error: any) {
    console.error("[timetable-compiler] failed for faculty:", facultyId, error)
    return {
      success: false,
      facultyId,
      month,
      year,
      tasksCreated: 0,
      structuredCredits: 0,
      targetCredits: 0,
      error: error?.message || "Failed to compile schedule",
    }
  }
}

/**
 * Check salary eligibility for a faculty member. Single source of truth.
 * Eligible <=> earned_credits >= 0.85 * target_credits AND at least one VERIFIED unstructured task.
 */
export async function checkSalaryEligibility(
  userId: string,
  year?: number,
  month?: number
): Promise<SalaryEligibilityResult> {
  const supabase = await createClient()
  const db = supabase as any

  const currentYear = year || new Date().getFullYear()
  const currentMonth = month || new Date().getMonth() + 1

  // 1. Try DB RPC first
  const { data: rpcData, error: rpcError } = await db.rpc("check_salary_eligibility", {
    p_user_id: userId,
    p_year: currentYear,
    p_month: currentMonth,
  })

  if (!rpcError && rpcData) {
    return {
      eligible: Boolean(rpcData.eligible),
      progressPct: Number(rpcData.progress_pct || 0),
      earned: Number(rpcData.earned || 0),
      target: Number(rpcData.target || 0),
      structuredEarned: Number(rpcData.structured_earned || 0),
      unstructuredEarned: Number(rpcData.unstructured_earned || 0),
      hasVerifiedUnstructured: Boolean(rpcData.has_verified_unstructured),
    }
  }

  // 2. TypeScript fallback
  const { data: user } = await db
    .from("users")
    .select("target_credits")
    .eq("id", userId)
    .single()

  const target = user?.target_credits !== null && user?.target_credits !== undefined ? Number(user.target_credits) : 0

  const { data: tasks } = await db
    .from("tasks")
    .select("category, credit_value, status")
    .eq("assigned_to_id", userId)
    .in("status", ["CLOSED", "LEAD_SIGNED", "VERIFIED"])

  let structuredEarned = 0
  let unstructuredEarned = 0
  let hasVerifiedUnstructured = false

  for (const t of tasks || []) {
    const val = Number(t.credit_value || 0)
    if (t.category === "STRUCTURED") {
      structuredEarned += val
    } else if (t.category === "UNSTRUCTURED") {
      unstructuredEarned += val
      hasVerifiedUnstructured = true
    }
  }

  const earned = structuredEarned + unstructuredEarned
  const progressPct = target > 0 ? Math.min(100, Math.round((earned / target) * 100)) : 0
  const eligible = target > 0 && earned >= 0.85 * target && hasVerifiedUnstructured

  return {
    eligible,
    progressPct,
    earned,
    target,
    structuredEarned,
    unstructuredEarned,
    hasVerifiedUnstructured,
  }
}

/**
 * Batch compiles recurring tasks for all active faculty in an organization.
 */
export async function compileOrganizationScheduleTasks(
  organizationId: string,
  year: number,
  month: number
): Promise<BatchCompileResult> {
  const supabase = await createClient()
  const db = supabase as any

  try {
    // 1. Try DB RPC first
    const { data: rpcData, error: rpcError } = await db.rpc("compile_cycle_tasks_for_all", {
      p_organization_id: organizationId,
      p_year: year,
      p_month: month,
    })

    if (!rpcError && rpcData?.success) {
      const details: CompileResult[] = (rpcData.details || []).map((d: any) => ({
        success: d.success,
        facultyId: d.faculty_id,
        month: d.month,
        year: d.year,
        tasksCreated: d.tasks_created,
        structuredCredits: Number(d.structured_credits),
        targetCredits: Number(d.target_credits),
      }))

      const totalTasks = details.reduce((acc, curr) => acc + curr.tasksCreated, 0)

      return {
        success: true,
        organizationId,
        facultyCount: rpcData.faculty_count || details.length,
        totalTasksCreated: totalTasks,
        details,
      }
    }

    // 2. Fallback: fetch distinct faculty with active assignments or slots
    const { data: assignments } = await db
      .from("subject_assignments")
      .select("faculty_id")
      .eq("organization_id", organizationId)
      .eq("is_active", true)

    const { data: slots } = await db
      .from("timetable_slots")
      .select("faculty_id")
      .eq("organization_id", organizationId)
      .not("faculty_id", "is", null)
      .eq("is_active", true)

    const facultyIds = Array.from(
      new Set(
        [
          ...(assignments || []).map((a: any) => a.faculty_id),
          ...(slots || []).map((s: any) => s.faculty_id),
        ].filter(Boolean)
      )
    )

    const results: CompileResult[] = []
    let totalTasks = 0

    for (const fId of facultyIds) {
      const res = await compileMonthlyScheduleTasks(organizationId, fId as string, year, month)
      results.push(res)
      totalTasks += res.tasksCreated
    }

    return {
      success: true,
      organizationId,
      facultyCount: facultyIds.length,
      totalTasksCreated: totalTasks,
      details: results,
    }
  } catch (error: any) {
    console.error("[timetable-compiler] organization batch compile failed:", error)
    return {
      success: false,
      organizationId,
      facultyCount: 0,
      totalTasksCreated: 0,
      details: [],
      error: error?.message || "Failed to batch compile organization schedule",
    }
  }
}
