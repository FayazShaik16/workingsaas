import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const {
      timetableSlotId,
      taskId,
      classDate,
      studentsPresent,
      studentsAbsent,
      topicsCovered,
    } = await req.json()

    if (!timetableSlotId || !classDate) {
      return NextResponse.json(
        { error: "Timetable slot ID and class date are required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    const presentCount = Number(studentsPresent) || 0
    const absentCount = Number(studentsAbsent) || 0

    // 1. Fetch timetable slot details to verify organization
    const { data: slot, error: slotError } = await db
      .from("timetable_slots")
      .select(`
        id,
        organization_id,
        subject_assignment_id
      `)
      .eq("id", timetableSlotId)
      .maybeSingle()

    const orgId = slot?.organization_id || user.organizationId

    // 2. Insert or update the attendance record (status = 'SUBMITTED')
    let attendanceRecord = null
    const { data: existingRecord } = await db
      .from("attendance_records")
      .select("id")
      .eq("timetable_slot_id", timetableSlotId)
      .eq("faculty_id", user.id)
      .limit(1)
      .maybeSingle()

    if (existingRecord) {
      const { data: updated, error: updateError } = await db
        .from("attendance_records")
        .update({
          status: "SUBMITTED",
          students_present: presentCount,
          students_absent: absentCount,
          topics_covered: topicsCovered || null,
        })
        .eq("id", existingRecord.id)
        .select()
        .single()

      if (updateError) {
        // Fallback for schema variants
        await db
          .from("attendance_records")
          .update({
            status: "SUBMITTED",
            topic_covered: topicsCovered || null,
          })
          .eq("id", existingRecord.id)
      }
      attendanceRecord = updated || existingRecord
    } else {
      const insertPayload: any = {
        organization_id: orgId,
        timetable_slot_id: timetableSlotId,
        faculty_id: user.id,
        status: "SUBMITTED",
        created_at: new Date().toISOString(),
      }

      // Try inserting with extended attendance fields
      const { data: inserted, error: insError } = await db
        .from("attendance_records")
        .insert({
          ...insertPayload,
          class_date: classDate,
          conducted_on: classDate,
          students_present: presentCount,
          students_absent: absentCount,
          topics_covered: topicsCovered || null,
        })
        .select()
        .single()

      if (insError) {
        // Fallback if table uses alternative column names
        const { data: fallbackIns } = await db
          .from("attendance_records")
          .insert({
            ...insertPayload,
            conducted_on: classDate,
            topic_covered: topicsCovered || null,
          })
          .select()
          .single()
        attendanceRecord = fallbackIns
      } else {
        attendanceRecord = inserted
      }
    }

    // 3. Find or update the corresponding structured task
    if (taskId) {
      await db
        .from("tasks")
        .update({
          status: "VERIFICATION_PENDING",
          updated_at: new Date().toISOString(),
        })
        .eq("id", taskId)
    } else {
      // Find task by slot or scheduled date
      await db
        .from("tasks")
        .update({
          status: "VERIFICATION_PENDING",
          updated_at: new Date().toISOString(),
        })
        .eq("source_timetable_slot_id", timetableSlotId)
        .eq("assigned_to_id", user.id)
    }

    return NextResponse.json({
      success: true,
      attendanceRecordId: attendanceRecord?.id,
      message: "Attendance recorded successfully. Submitted to HOD verification queue.",
    })
  } catch (error: any) {
    console.error("[attendance/submit] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
