import { createAdminClient } from "@/lib/supabase/admin"

export interface GenerationResult {
  templatesProcessed: number
  instancesCreated: number
  targetMonth: string
  facultyUpdated: number
}

const DOW_MAP = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]

/**
 * Generate scheduled work instances for a given month from active recurring templates
 */
export async function generateInstancesForMonth(params: {
  organizationId: string
  workCycleId: string
  year: number
  month: number // 1-12
  facultyId?: string
}): Promise<GenerationResult> {
  const admin = createAdminClient()
  const db = admin as any

  const { organizationId, workCycleId, year, month, facultyId } = params

  // 1. Fetch active templates
  let query = db
    .from("scheduled_work_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("work_cycle_id", workCycleId)
    .eq("active", true)

  if (facultyId) {
    query = query.eq("assigned_to_id", facultyId)
  }

  const { data: templates, error: templateErr } = await query
  if (templateErr) throw new Error(`Failed to load templates: ${templateErr.message}`)
  if (!templates || templates.length === 0) {
    return { templatesProcessed: 0, instancesCreated: 0, targetMonth: `${year}-${String(month).padStart(2, "0")}`, facultyUpdated: 0 }
  }

  // 2. Compute date range for month
  const startDate = new Date(Date.UTC(year, month - 1, 1))
  const endDate = new Date(Date.UTC(year, month, 0)) // Last day of month
  const totalDays = endDate.getUTCDate()

  const instancesToInsert: any[] = []
  const facultyIds = new Set<string>()

  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(Date.UTC(year, month - 1, day))
    const dayOfWeek = DOW_MAP[currentDate.getUTCDay()]
    const dateString = currentDate.toISOString().split("T")[0]

    for (const tmpl of templates) {
      if (tmpl.weekly_day === dayOfWeek) {
        facultyIds.add(tmpl.assigned_to_id)

        // Parse start and end time strings (e.g. "09:15:00" or "09:15")
        const startParts = (tmpl.start_time || "09:00").split(":")
        const endParts = (tmpl.end_time || "10:00").split(":")

        const startTimeIso = new Date(
          Date.UTC(year, month - 1, day, Number(startParts[0]) || 9, Number(startParts[1]) || 0)
        ).toISOString()

        const endTimeIso = new Date(
          Date.UTC(year, month - 1, day, Number(endParts[0]) || 10, Number(endParts[1]) || 0)
        ).toISOString()

        instancesToInsert.push({
          organization_id: organizationId,
          template_id: tmpl.id,
          assigned_to_id: tmpl.assigned_to_id,
          work_cycle_id: workCycleId,
          work_date: dateString,
          scheduled_start: startTimeIso,
          scheduled_end: endTimeIso,
          credit_value: Number(tmpl.credit_value) || 1.0,
          status: "UPCOMING",
        })
      }
    }
  }

  // 3. Batch upsert instances with unique constraint deduplication
  let instancesCreated = 0
  if (instancesToInsert.length > 0) {
    // Insert in chunks of 100
    const chunkSize = 100
    for (let i = 0; i < instancesToInsert.length; i += chunkSize) {
      const chunk = instancesToInsert.slice(i, i + chunkSize)
      const { data: inserted, error: insErr } = await db
        .from("scheduled_work_instances")
        .upsert(chunk, { onConflict: "template_id,work_date" })
        .select("id")

      if (insErr) {
        console.error("[schedule-generator] Instance upsert error:", insErr)
      } else {
        instancesCreated += inserted?.length || chunk.length
      }
    }
  }

  // 4. Recompute monthly progress summary for all affected faculty
  const monthStartString = `${year}-${String(month).padStart(2, "0")}-01`
  for (const fId of facultyIds) {
    try {
      await db.rpc("recompute_monthly_work_progress", {
        p_user_id: fId,
        p_work_cycle_id: workCycleId,
        p_month_start: monthStartString,
      })
    } catch (e) {
      console.warn(`[schedule-generator] RPC recompute skipped for ${fId}:`, e)
    }
  }

  return {
    templatesProcessed: templates.length,
    instancesCreated,
    targetMonth: `${year}-${String(month).padStart(2, "0")}`,
    facultyUpdated: facultyIds.size,
  }
}
