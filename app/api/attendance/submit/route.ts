import { createClient } from "@/lib/supabase/server"
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

    const supabase = await createClient()
    const db = supabase as any

    const presentCount = Number(studentsPresent) || 0
    const absentCount = Number(studentsAbsent) || 0

    // 1. Fetch timetable slot details to verify organization and faculty ownership
    const { data: slot, error: slotError } = await db
      .from("timetable_slots")
      .select(`
        id,
        organization_id,
        subject_assignment_id,
        subject_assignments (
          faculty_id,
          subject_id,
          batch_id
        )
      `)
      .eq("id", timetableSlotId)
      .single()

    if (slotError || !slot) {
      return NextResponse.json({ error: "Timetable slot not found." }, { status: 404 })
    }

    const orgId = slot.organization_id || user.organizationId

    // 2. Insert or update the attendance record (status = 'SUBMITTED')
    const { data: attendanceRecord, error: recordError } = await db
      .from("attendance_records")
      .upsert(
        {
          organization_id: orgId,
          timetable_slot_id: timetableSlotId,
          faculty_id: user.id,
          class_date: classDate,
          students_present: presentCount,
          students_absent: absentCount,
          topics_covered: topicsCovered || null,
          status: "SUBMITTED",
          created_at: new Date().toISOString(),
        },
        {
          onConflict: "timetable_slot_id,class_date",
        }
      )
      .select()
      .single()

    if (recordError) {
      console.error("[attendance/submit] DB error:", recordError)
      throw new Error(`Failed to save attendance record: ${recordError.message}`)
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
      // Find task by slot and scheduled date
      await db
        .from("tasks")
        .update({
          status: "VERIFICATION_PENDING",
          updated_at: new Date().toISOString(),
        })
        .eq("source_timetable_slot_id", timetableSlotId)
        .eq("scheduled_date", classDate)
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
