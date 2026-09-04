import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { generateInstancesForMonth } from "@/lib/engine/schedule-generator"
import { NextResponse } from "next/server"

interface TimetableRow {
  faculty_id?: string
  faculty_name?: string
  faculty_email?: string
  day?: string
  start_time?: string
  end_time?: string
  task_name?: string
  credits?: string | number
  description?: string
}

const VALID_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
const DAY_NORMALIZATION: Record<string, string> = {
  MONDAY: "MON",
  TUESDAY: "TUE",
  WEDNESDAY: "WED",
  THURSDAY: "THU",
  FRIDAY: "FRI",
  SATURDAY: "SAT",
  MON: "MON",
  TUE: "TUE",
  WED: "WED",
  THU: "THU",
  FRI: "FRI",
  SAT: "SAT",
}

function normalizeTime(val: any): string | null {
  if (!val) return null
  const str = String(val).trim().toUpperCase()

  // Matches "09:15", "9:15", "09:15:00"
  const match24 = str.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/)
  if (match24) {
    const hh = String(Number(match24[1])).padStart(2, "0")
    const mm = match24[2]
    return `${hh}:${mm}:00`
  }

  // Matches "9:15 AM", "01:30 PM"
  const match12 = str.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/)
  if (match12) {
    let hh = Number(match12[1])
    const mm = match12[2]
    const ampm = match12[3]
    if (ampm === "PM" && hh < 12) hh += 12
    if (ampm === "AM" && hh === 12) hh = 0
    return `${String(hh).padStart(2, "0")}:${mm}:00`
  }

  return null
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { rows = [], workCycleId, dryRun = true, autoGenerateMonth = false } = await req.json()

    if (!workCycleId) {
      return NextResponse.json({ error: "Active work cycle ID is required." }, { status: 400 })
    }

    // If no rows provided but autoGenerateMonth requested, directly run instance generation for existing templates
    if ((!Array.isArray(rows) || rows.length === 0) && autoGenerateMonth) {
      const now = new Date()
      const genRes = await generateInstancesForMonth({
        organizationId: user.organizationId,
        workCycleId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      })
      return NextResponse.json({
        success: true,
        dryRun: false,
        totalRows: 0,
        templatesCreated: 0,
        instancesGenerated: genRes.instancesCreated,
        message: `Successfully generated ${genRes.instancesCreated} active monthly work instances for this cycle.`,
      })
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: "No timetable rows provided." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // 1. Fetch organization users for matching
    const { data: orgUsers } = await db
      .from("users")
      .select("id, email, name, employee_id")
      .eq("organization_id", orgId)

    const userByEmail = new Map<string, any>()
    const userById = new Map<string, any>()
    const userByEmpId = new Map<string, any>()

    for (const u of orgUsers || []) {
      if (u.email) userByEmail.set(u.email.toLowerCase(), u)
      if (u.id) userById.set(u.id, u)
      if (u.employee_id) userByEmpId.set(u.employee_id.toLowerCase(), u)
    }

    // 1b. Fetch active templates in this work cycle for slot conflict validation
    const { data: allCycleTemplates } = await db
      .from("scheduled_work_templates")
      .select("id, assigned_to_id, weekly_day, start_time, end_time, title")
      .eq("organization_id", orgId)
      .eq("work_cycle_id", workCycleId)
      .eq("active", true)

    // 2. Validate rows
    const validTemplates: any[] = []
    const rejectedRows: Array<{ rowNumber: number; row: TimetableRow; reason: string }> = []
    const conflictWarnings: Array<{ rowNumber: number; reason: string }> = []

    for (let i = 0; i < rows.length; i++) {
      const row: TimetableRow = rows[i]
      const rowNum = i + 1

      // A. Match faculty
      let matchedUser = null
      if (row.faculty_email) {
        matchedUser = userByEmail.get(row.faculty_email.trim().toLowerCase())
      }
      if (!matchedUser && row.faculty_id) {
        matchedUser =
          userById.get(row.faculty_id.trim()) || userByEmpId.get(row.faculty_id.trim().toLowerCase())
      }

      if (!matchedUser) {
        rejectedRows.push({
          rowNumber: rowNum,
          row,
          reason: `Faculty not found in organization (Email: ${row.faculty_email || "N/A"}, ID: ${row.faculty_id || "N/A"})`,
        })
        continue
      }

      // B. Validate Day
      const dayRaw = (row.day || "").toUpperCase().trim()
      const normalizedDay = DAY_NORMALIZATION[dayRaw]
      if (!normalizedDay) {
        rejectedRows.push({
          rowNumber: rowNum,
          row,
          reason: `Invalid weekday "${row.day}". Must be MON, TUE, WED, THU, FRI, or SAT.`,
        })
        continue
      }

      // C. Validate Times
      const startTime = normalizeTime(row.start_time)
      const endTime = normalizeTime(row.end_time)

      if (!startTime || !endTime) {
        rejectedRows.push({
          rowNumber: rowNum,
          row,
          reason: `Invalid time format (Start: ${row.start_time || "N/A"}, End: ${row.end_time || "N/A"}). Expected HH:MM or HH:MM AM/PM.`,
        })
        continue
      }

      if (startTime >= endTime) {
        rejectedRows.push({
          rowNumber: rowNum,
          row,
          reason: `Invalid time interval: End time (${endTime.slice(0, 5)}) must be strictly after start time (${startTime.slice(0, 5)}).`,
        })
        continue
      }

      // D. Check for time slot collision for this faculty
      const existingConflict = (allCycleTemplates || []).find((ext: any) => {
        if (ext.assigned_to_id !== matchedUser.id || ext.weekly_day !== normalizedDay) return false
        const extStart = (ext.start_time || "").slice(0, 8)
        const extEnd = (ext.end_time || "").slice(0, 8)
        return extStart < endTime && startTime < extEnd
      })

      const batchConflict = validTemplates.find((vt: any) => {
        if (vt.assigned_to_id !== matchedUser.id || vt.weekly_day !== normalizedDay) return false
        return vt.start_time < endTime && startTime < vt.end_time
      })

      const conflict = existingConflict || batchConflict
      if (conflict) {
        rejectedRows.push({
          rowNumber: rowNum,
          row,
          reason: `Time slot conflict: Faculty ${matchedUser.name} already has a task/session ('${conflict.title}') assigned on ${normalizedDay} from ${(conflict.start_time || "").slice(0, 5)} to ${(conflict.end_time || "").slice(0, 5)}. Multiple tasks cannot be assigned to the same faculty at the same time slot.`,
        })
        continue
      }

      // E. Validate Task Name
      const taskName = (row.task_name || "").trim()
      if (!taskName) {
        rejectedRows.push({
          rowNumber: rowNum,
          row,
          reason: "Task name / Session title is required.",
        })
        continue
      }

      // F. Validate Credits
      const credits = Number(row.credits)
      if (isNaN(credits) || credits <= 0) {
        rejectedRows.push({
          rowNumber: rowNum,
          row,
          reason: `Invalid credit value "${row.credits}". Must be a positive number.`,
        })
        continue
      }

      validTemplates.push({
        organization_id: orgId,
        assigned_to_id: matchedUser.id,
        work_cycle_id: workCycleId,
        title: taskName,
        description: row.description?.trim() || null,
        weekly_day: normalizedDay,
        start_time: startTime,
        end_time: endTime,
        credit_value: credits,
        active: true,
        source: "XLSX_IMPORT",
        source_reference: `Imported by ${user.name} on ${new Date().toISOString().split("T")[0]}`,
        created_by: user.id,
        _facultyName: matchedUser.name,
        _facultyEmail: matchedUser.email,
      })
    }

    // 3. Dry Run Preview Response
    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        totalRows: rows.length,
        validCount: validTemplates.length,
        rejectedCount: rejectedRows.length,
        validTemplatesPreview: validTemplates.slice(0, 15),
        rejectedRows,
        conflictWarnings,
      })
    }

    if (validTemplates.length === 0 && rejectedRows.length > 0) {
      return NextResponse.json(
        {
          error: rejectedRows[0].reason,
          rejectedRows,
        },
        { status: 400 }
      )
    }

    // 4. Actual Database Insertion
    const insertedTemplates: any[] = []
    for (const t of validTemplates) {
      const { _facultyName, _facultyEmail, ...templatePayload } = t
      const { data: inserted, error: insertErr } = await db
        .from("scheduled_work_templates")
        .upsert(templatePayload, {
          onConflict: "organization_id,assigned_to_id,work_cycle_id,weekly_day,start_time,end_time,title",
        })
        .select()
        .single()

      if (insertErr) {
        console.error("[import-schedule] Insert error:", insertErr)
      } else {
        insertedTemplates.push(inserted)
      }
    }

    // 5. Auto-generate instances for current month if requested
    let generatedInstancesCount = 0
    if (autoGenerateMonth) {
      const now = new Date()
      const genRes = await generateInstancesForMonth({
        organizationId: orgId,
        workCycleId,
        year: now.getFullYear(),
        month: now.getMonth() + 1,
      })
      generatedInstancesCount = genRes.instancesCreated
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      totalRows: rows.length,
      templatesCreated: insertedTemplates.length,
      insertedTemplates,
      rejectedCount: rejectedRows.length,
      rejectedRows,
      instancesGenerated: generatedInstancesCount,
      message: `Successfully imported ${insertedTemplates.length} scheduled work templates and generated ${generatedInstancesCount} active instances.`,
    })
  } catch (error: any) {
    console.error("[api/dept-admin/import-schedule] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
