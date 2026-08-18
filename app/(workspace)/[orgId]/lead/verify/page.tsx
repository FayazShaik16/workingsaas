import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { HODVerificationConsole, AttendanceRecordItem, UnstructuredTaskItem } from "@/components/lead/hod-verification-console"
import { CheckSquare } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadVerifyQueuePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch pending attendance records for this organization
  const { data: rawAttendance } = await db
    .from("attendance_records")
    .select(`
      id,
      class_date,
      students_present,
      students_absent,
      topics_covered,
      status,
      created_at,
      faculty:faculty_id (
        id,
        name,
        email,
        designation
      ),
      timetable_slots (
        id,
        day_of_week,
        period_number,
        start_time,
        end_time,
        room,
        subject_assignments (
          subjects (id, code, name, credits),
          academic_batches (id, section, year_of_study, current_semester, academic_programs (code))
        )
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  const formattedAttendance: AttendanceRecordItem[] = (rawAttendance || []).map((r: any) => {
    const slot = r.timetable_slots
    const assignment = slot?.subject_assignments
    const subject = assignment?.subjects
    const batch = assignment?.academic_batches
    const program = batch?.academic_programs

    return {
      id: r.id,
      class_date: r.class_date,
      students_present: r.students_present,
      students_absent: r.students_absent,
      topics_covered: r.topics_covered,
      status: r.status,
      created_at: r.created_at,
      faculty: r.faculty ? {
        id: r.faculty.id,
        name: r.faculty.name,
        email: r.faculty.email,
        designation: r.faculty.designation,
      } : null,
      slot: slot ? {
        id: slot.id,
        day_of_week: slot.day_of_week,
        period_number: slot.period_number,
        start_time: slot.start_time,
        end_time: slot.end_time,
        room: slot.room,
      } : null,
      subject: subject ? {
        id: subject.id,
        code: subject.code,
        name: subject.name,
        credits: subject.credits,
      } : null,
      batch: batch ? {
        id: batch.id,
        section: batch.section,
        year_of_study: batch.year_of_study,
        current_semester: batch.current_semester,
        program_code: program?.code || "CSE",
      } : null,
    }
  })

  // 2. Fetch unstructured tasks submitted for verification in this org
  const { data: rawTasks } = await db
    .from("tasks")
    .select(`
      id,
      title,
      token_value,
      status,
      created_at,
      category,
      assigned_to:assigned_to_id (
        id,
        name,
        email
      ),
      org_units (name)
    `)
    .eq("organization_id", orgId)
    .eq("category", "UNSTRUCTURED")
    .in("status", ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"])
    .order("created_at", { ascending: false })

  const formattedTasks: UnstructuredTaskItem[] = (rawTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    token_value: Number(t.token_value || 0),
    status: t.status,
    created_at: t.created_at,
    assigned_to: t.assigned_to ? {
      id: t.assigned_to.id,
      name: t.assigned_to.name,
      email: t.assigned_to.email,
    } : null,
    org_unit_name: (t.org_units as any)?.name || "General",
  }))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <CheckSquare className="h-8 w-8 text-primary" />
          HOD Monday Approval & Verification Queue
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Triage daily teaching attendance logs, inspect deliverable proofs, and authorize automated WORK token liquidity release.
        </p>
      </div>

      <HODVerificationConsole
        orgId={orgId}
        leadUserId={user.id}
        initialAttendanceRecords={formattedAttendance}
        initialUnstructuredTasks={formattedTasks}
      />
    </div>
  )
}
