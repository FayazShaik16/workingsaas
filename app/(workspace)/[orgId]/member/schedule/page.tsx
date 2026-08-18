import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { FacultyScheduleView, SlotEntry } from "@/components/member/faculty-schedule-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberSchedulePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  const supabase = await createClient()
  const db = supabase as any

  // 1. Fetch this faculty's timetable assignments
  const { data: assignments } = await db
    .from("subject_assignments")
    .select(`
      id,
      academic_year,
      subjects (id, code, name, credits, subject_type),
      academic_batches (id, section, year_of_study, current_semester, student_count, academic_programs (name, code)),
      timetable_slots (id, day_of_week, period_number, start_time, end_time, room, is_active)
    `)
    .eq("faculty_id", user.id)
    .eq("is_active", true)

  // 2. Fetch recent attendance records for this faculty member (last 30 days)
  const { data: attendanceRecords } = await db
    .from("attendance_records")
    .select("id, timetable_slot_id, class_date, students_present, students_absent, status")
    .eq("faculty_id", user.id)
    .order("class_date", { ascending: false })

  const recentRecordsMap: Record<
    string,
    { id: string; status: string; class_date: string; students_present: number }
  > = {}

  for (const r of attendanceRecords || []) {
    const key = `${r.timetable_slot_id}_${r.class_date}`
    recentRecordsMap[key] = {
      id: r.id,
      status: r.status,
      class_date: r.class_date,
      students_present: r.students_present,
    }
  }

  // 3. Build a day -> slots map
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const schedule: Record<string, SlotEntry[]> = {}
  days.forEach((d) => (schedule[d] = []))

  for (const assignment of assignments ?? []) {
    for (const slot of (assignment.timetable_slots as any[]) ?? []) {
      if (!slot.is_active) continue
      const subject = assignment.subjects as any
      const batch = assignment.academic_batches as any
      const program = batch?.academic_programs as any

      schedule[slot.day_of_week]?.push({
        slotId: slot.id,
        assignmentId: assignment.id,
        period: slot.period_number,
        startTime: slot.start_time?.slice(0, 5) || "09:00",
        endTime: slot.end_time?.slice(0, 5) || "09:50",
        room: slot.room,
        subjectCode: subject?.code ?? "",
        subjectName: subject?.name ?? "",
        batch: `${program?.code ?? ""} ${batch?.year_of_study ?? ""}Y-${batch?.section ?? ""}`,
        batchId: batch?.id,
        studentCount: batch?.student_count || 60,
        semester: batch?.current_semester ?? 0,
        programme: program?.name ?? "",
        dayOfWeek: slot.day_of_week,
      })
    }
  }

  // Sort each day by period number
  days.forEach((d) => schedule[d].sort((a, b) => a.period - b.period))

  const totalSlots = Object.values(schedule).flat().length

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          My Teaching Schedule & Attendance
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Weekly timetable matrix — log daily class attendance for HOD verification and automatic token credit.
        </p>
      </div>

      <FacultyScheduleView
        orgId={orgId}
        userId={user.id}
        schedule={schedule}
        recentAttendanceRecords={recentRecordsMap}
      />
    </div>
  )
}
