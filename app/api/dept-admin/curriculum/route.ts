import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const { action, payload } = await req.json()
    const orgId = payload?.orgId || user.organizationId

    const admin = createAdminClient()
    const db = admin as any

    if (action === "CREATE_PROGRAM") {
      const { name, code, deptId } = payload
      if (!name || !code) {
        return NextResponse.json({ error: "Programme name and code are required." }, { status: 400 })
      }

      // If deptId is null or empty, find or fallback to first org_unit
      let effectiveDeptId = deptId || user.orgUnitId || null
      if (!effectiveDeptId) {
        const { data: defaultUnit } = await db
          .from("org_units")
          .select("id")
          .eq("organization_id", orgId)
          .limit(1)
          .maybeSingle()
        effectiveDeptId = defaultUnit?.id || null
      }

      const { data, error } = await db
        .from("academic_programs")
        .insert({
          organization_id: orgId,
          dept_id: effectiveDeptId,
          name: name.trim(),
          code: code.trim().toUpperCase(),
        })
        .select()
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === "CREATE_SUBJECT") {
      const { code, name, credits = 3, subjectType = "THEORY", semester = 1 } = payload
      let { programId } = payload

      if (!code || !name) {
        return NextResponse.json({ error: "Subject code and name are required." }, { status: 400 })
      }

      // Ensure a valid program_id exists
      if (!programId) {
        let { data: defaultProg } = await db
          .from("academic_programs")
          .select("id")
          .eq("organization_id", orgId)
          .limit(1)
          .maybeSingle()

        if (!defaultProg) {
          const { data: newProg } = await db
            .from("academic_programs")
            .insert({
              organization_id: orgId,
              name: "General Engineering & Applied Sciences",
              code: "ENG-GEN",
            })
            .select("id")
            .single()
          defaultProg = newProg
        }
        programId = defaultProg?.id
      }

      const { data, error } = await db
        .from("subjects")
        .insert({
          organization_id: orgId,
          program_id: programId,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          credits: Number(credits) || 3,
          subject_type: subjectType,
          semester: Number(semester) || 1,
          is_active: true,
        })
        .select(`
          id,
          code,
          name,
          credits,
          subject_type,
          semester,
          program_id,
          academic_programs (id, name, code)
        `)
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === "CREATE_BATCH") {
      const {
        yearOfStudy = 1,
        semester = 1,
        section = "A",
        studentCount = 60,
        academicYear = "2025-2026",
      } = payload
      let { programId } = payload

      if (!section) {
        return NextResponse.json({ error: "Section is required." }, { status: 400 })
      }

      // Ensure a valid program_id exists
      if (!programId) {
        let { data: defaultProg } = await db
          .from("academic_programs")
          .select("id")
          .eq("organization_id", orgId)
          .limit(1)
          .maybeSingle()

        if (!defaultProg) {
          const { data: newProg } = await db
            .from("academic_programs")
            .insert({
              organization_id: orgId,
              name: "General Engineering & Applied Sciences",
              code: "ENG-GEN",
            })
            .select("id")
            .single()
          defaultProg = newProg
        }
        programId = defaultProg?.id
      }

      const { data, error } = await db
        .from("academic_batches")
        .insert({
          organization_id: orgId,
          program_id: programId,
          year_of_study: Number(yearOfStudy) || 1,
          current_semester: Number(semester) || 1,
          section: section.trim().toUpperCase(),
          student_count: Number(studentCount) || 60,
          academic_year: academicYear,
          is_active: true,
        })
        .select(`
          id,
          year_of_study,
          current_semester,
          section,
          student_count,
          academic_year,
          program_id,
          academic_programs (id, name, code)
        `)
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, data })
    }

    if (action === "CREATE_SLOT") {
      const {
        facultyId,
        subjectId,
        batchId,
        dayOfWeek,
        periodNumber,
        room = "LH-101",
        startTime = "09:00:00",
        endTime = "09:50:00",
        academicYear = "2025-2026",
      } = payload

      if (!facultyId || !subjectId || !batchId || !dayOfWeek || !periodNumber) {
        return NextResponse.json(
          { error: "Faculty, subject, batch, day, and period number are required." },
          { status: 400 }
        )
      }

      // 1. Find or create subject_assignment
      let assignmentId = ""
      const { data: existingAssignment } = await db
        .from("subject_assignments")
        .select("id")
        .eq("organization_id", orgId)
        .eq("faculty_id", facultyId)
        .eq("subject_id", subjectId)
        .eq("batch_id", batchId)
        .limit(1)
        .maybeSingle()

      if (existingAssignment) {
        assignmentId = existingAssignment.id
      } else {
        const { data: newAssignment, error: aError } = await db
          .from("subject_assignments")
          .insert({
            organization_id: orgId,
            faculty_id: facultyId,
            subject_id: subjectId,
            batch_id: batchId,
            academic_year: academicYear,
            is_active: true,
          })
          .select("id")
          .single()

        if (aError) throw aError
        assignmentId = newAssignment.id
      }

      // 2. Insert timetable_slot
      const { data: newSlot, error: slotError } = await db
        .from("timetable_slots")
        .insert({
          organization_id: orgId,
          subject_assignment_id: assignmentId,
          day_of_week: dayOfWeek,
          period_number: Number(periodNumber),
          start_time: startTime,
          end_time: endTime,
          room: room || "Classroom",
          is_active: true,
          effective_from: new Date().toISOString().split("T")[0],
        })
        .select()
        .single()

      if (slotError) throw slotError
      return NextResponse.json({ success: true, slot: newSlot })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (error: any) {
    console.error("[api/dept-admin/curriculum] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Operation failed" },
      { status: 500 }
    )
  }
}
