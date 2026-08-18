import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { compileMonthlyScheduleTasks } from "@/lib/engine/timetable-compiler"
import { NextResponse } from "next/server"

interface ImportTimetableSlot {
  facultyEmail: string
  day: string
  periodNumber: number
  startTime: string
  endTime: string
  activityType: string
  subjectCode?: string
  subjectName?: string
  program?: string
  batchSection?: string
  room?: string
}

export async function POST(req: Request) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const isAuthorized =
      hasScope(sessionUser.scopeLevels, "DIRECTOR") ||
      hasScope(sessionUser.scopeLevels, "SYSTEM_ADMIN") ||
      hasScope(sessionUser.scopeLevels, "DEPT_ADMIN") ||
      hasScope(sessionUser.scopeLevels, "ORG_UNIT_LEAD")

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: Insufficient privileges to import timetable." },
        { status: 403 }
      )
    }

    const { orgId, deptId, slots } = (await req.json()) as {
      orgId: string
      deptId?: string
      slots: ImportTimetableSlot[]
    }

    if (!orgId || !Array.isArray(slots) || slots.length === 0) {
      return NextResponse.json(
        { error: "Invalid payload: orgId and slots array are required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    const targetDeptId = deptId || sessionUser.orgUnitId

    // 1. Fetch faculty lookup map by email
    const { data: users } = await db
      .from("users")
      .select("id, email, name, org_unit_id")
      .eq("organization_id", orgId)

    const facultyMap = new Map<string, { id: string; name: string; orgUnitId: string | null }>()
    for (const u of users || []) {
      facultyMap.set(u.email.toLowerCase().trim(), {
        id: u.id,
        name: u.name,
        orgUnitId: u.org_unit_id,
      })
    }

    // 2. Fetch or create academic programs lookup map
    const { data: existingPrograms } = await db
      .from("academic_programs")
      .select("id, code, name")
      .eq("organization_id", orgId)

    const programMap = new Map<string, string>()
    for (const p of existingPrograms || []) {
      programMap.set(p.code.toUpperCase().trim(), p.id)
    }

    // 3. Fetch or create subjects lookup map
    const { data: existingSubjects } = await db
      .from("subjects")
      .select("id, code, name, program_id")
      .eq("organization_id", orgId)

    const subjectMap = new Map<string, string>()
    for (const s of existingSubjects || []) {
      subjectMap.set(s.code.toUpperCase().trim(), s.id)
    }

    // 4. Fetch or create academic batches lookup map
    const { data: existingBatches } = await db
      .from("academic_batches")
      .select("id, section, year_of_study, program_id")
      .eq("organization_id", orgId)

    const batchMap = new Map<string, string>()
    for (const b of existingBatches || []) {
      batchMap.set(`${b.program_id}_${b.section.toUpperCase().trim()}`, b.id)
    }

    const affectedFacultyIds = new Set<string>()
    let importedCount = 0
    const errors: Array<{ row: number; email: string; message: string }> = []

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i]
      const email = slot.facultyEmail?.toLowerCase().trim()
      const faculty = facultyMap.get(email)

      if (!faculty) {
        errors.push({
          row: i + 1,
          email: slot.facultyEmail || "unknown",
          message: `Faculty with email '${slot.facultyEmail}' not found. Please import faculty first.`,
        })
        continue
      }

      affectedFacultyIds.add(faculty.id)

      // Normalize Day of Week
      let dow = (slot.day || "MON").toUpperCase().trim().slice(0, 3)
      if (!["MON", "TUE", "WED", "THU", "FRI", "SAT"].includes(dow)) {
        dow = "MON"
      }

      const periodNumber = Number(slot.periodNumber || 1)
      const startTime = slot.startTime || "09:00:00"
      const endTime = slot.endTime || "10:00:00"
      const room = slot.room || "Classroom"
      const activityType = (slot.activityType || "TEACHING_LECTURE").toUpperCase().trim()

      const hasTeachingSubject = Boolean(slot.subjectCode && slot.subjectCode.trim().length > 0)

      let subjectAssignmentId: string | null = null

      if (hasTeachingSubject) {
        const progCode = (slot.program || "BTECH-CSE").toUpperCase().trim()
        let programId = programMap.get(progCode)

        if (!programId) {
          const { data: newProg } = await db
            .from("academic_programs")
            .insert({
              organization_id: orgId,
              dept_id: targetDeptId || faculty.orgUnitId || null,
              name: slot.program || "Bachelor of Technology",
              code: progCode,
            })
            .select("id")
            .single()

          if (newProg) {
            programId = newProg.id
            programMap.set(progCode, newProg.id)
          }
        }

        // Resolve or create Batch
        const sectionName = (slot.batchSection || "Sec-A").toUpperCase().trim()
        const batchKey = `${programId}_${sectionName}`
        let batchId = batchMap.get(batchKey)

        if (!batchId && programId) {
          const { data: newBatch } = await db
            .from("academic_batches")
            .insert({
              organization_id: orgId,
              program_id: programId,
              year_of_study: 3,
              current_semester: 5,
              section: sectionName,
              academic_year: "2025-2026",
              is_active: true,
            })
            .select("id")
            .single()

          if (newBatch) {
            batchId = newBatch.id
            batchMap.set(batchKey, newBatch.id)
          }
        }

        // Resolve or create Subject
        const subCode = slot.subjectCode!.toUpperCase().trim()
        let subjectId = subjectMap.get(subCode)

        if (!subjectId && programId) {
          const { data: newSub } = await db
            .from("subjects")
            .insert({
              organization_id: orgId,
              program_id: programId,
              code: subCode,
              name: slot.subjectName?.trim() || subCode,
              credits: 3,
              semester: 5,
              subject_type: activityType.includes("LAB") ? "LAB" : "THEORY",
              is_active: true,
            })
            .select("id")
            .single()

          if (newSub) {
            subjectId = newSub.id
            subjectMap.set(subCode, newSub.id)
          }
        }

        // Resolve or create Subject Assignment
        if (subjectId && batchId) {
          const { data: existingAssignment } = await db
            .from("subject_assignments")
            .select("id")
            .eq("faculty_id", faculty.id)
            .eq("subject_id", subjectId)
            .eq("batch_id", batchId)
            .limit(1)
            .maybeSingle()

          if (existingAssignment) {
            subjectAssignmentId = existingAssignment.id
          } else {
            const { data: newAssignment } = await db
              .from("subject_assignments")
              .insert({
                organization_id: orgId,
                faculty_id: faculty.id,
                subject_id: subjectId,
                batch_id: batchId,
                academic_year: "2025-2026",
                is_active: true,
              })
              .select("id")
              .single()

            if (newAssignment) {
              subjectAssignmentId = newAssignment.id
            }
          }
        }
      }

      // Upsert timetable slot
      const { error: slotError } = await db
        .from("timetable_slots")
        .insert({
          organization_id: orgId,
          subject_assignment_id: subjectAssignmentId,
          faculty_id: faculty.id,
          task_type_code: activityType,
          day_of_week: dow,
          period_number: periodNumber,
          start_time: startTime,
          end_time: endTime,
          room,
          is_active: true,
          effective_from: new Date().toISOString().slice(0, 10),
        })

      if (!slotError) {
        importedCount++
      } else {
        console.error(`[import-timetable] error inserting slot:`, slotError)
      }
    }

    // Automatically compile current month tasks for all affected faculty!
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth() + 1
    const compileResults = []

    for (const fId of affectedFacultyIds) {
      const res = await compileMonthlyScheduleTasks(orgId, fId, currentYear, currentMonth)
      compileResults.push(res)
    }

    return NextResponse.json({
      success: true,
      importedSlotsCount: importedCount,
      facultyCompiledCount: compileResults.length,
      errors,
      compileResults,
    })
  } catch (error: any) {
    console.error("[import-timetable] unhandled error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
