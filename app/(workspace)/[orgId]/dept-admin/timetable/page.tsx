import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { TimetableBuilderClient } from "@/components/dept-admin/timetable-builder-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminTimetablePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // 1. Fetch user department
  const { data: userData } = await supabase
    .from("users")
    .select("org_unit_id, org_units(id, name, display_name)")
    .eq("id", user.id)
    .single()

  const deptId = userData?.org_unit_id
  const deptName = (userData?.org_units as any)?.display_name || (userData?.org_units as any)?.name || "Department"

  // 2. Fetch programmes under this department
  const { data: programmes } = await supabase
    .from("academic_programs")
    .select("id, name, code")
    .eq("dept_id", deptId || "")
    .order("code", { ascending: true })

  const programIds = (programmes || []).map((p: any) => p.id)

  // 3. Fetch subjects for these programmes
  const { data: subjects } = programIds.length > 0
    ? await supabase
        .from("subjects")
        .select("id, program_id, code, name, credits, subject_type, semester")
        .in("program_id", programIds)
        .eq("is_active", true)
        .order("code", { ascending: true })
    : { data: [] }

  // 4. Fetch academic batches
  const { data: batches } = programIds.length > 0
    ? await supabase
        .from("academic_batches")
        .select("id, program_id, year_of_study, section, current_semester, academic_year")
        .in("program_id", programIds)
        .eq("is_active", true)
        .order("year_of_study", { ascending: true })
    : { data: [] }

  // 5. Fetch department faculty members
  const { data: faculty } = await supabase
    .from("users")
    .select("id, name, email, designation, target_credits")
    .eq("organization_id", orgId)
    .eq("org_unit_id", deptId || "")
    .order("name", { ascending: true })

  // 6. Fetch existing subject assignments with timetable slots
  const { data: assignments } = await supabase
    .from("subject_assignments")
    .select(`
      id,
      faculty_id,
      subject_id,
      batch_id,
      academic_year,
      is_active,
      users (id, name, email),
      subjects (id, name, code, subject_type),
      academic_batches (id, section, year_of_study, current_semester, academic_programs(code, name)),
      timetable_slots (
        id,
        day_of_week,
        period_number,
        start_time,
        end_time,
        room,
        is_active
      )
    `)
    .eq("organization_id", orgId)
    .eq("is_active", true)

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{deptName} — Timetable Matrix</h1>
          <p className="text-muted-foreground mt-1">
            Weekly class schedules, period assignments, and deterministic monthly structured task compilation.
          </p>
        </div>
      </div>

      <TimetableBuilderClient
        orgId={orgId}
        deptId={deptId || ""}
        deptName={deptName}
        programmes={programmes || []}
        subjects={subjects || []}
        batches={batches || []}
        faculty={faculty || []}
        initialAssignments={assignments || []}
      />
    </div>
  )
}
