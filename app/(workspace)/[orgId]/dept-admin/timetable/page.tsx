import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { TimetableBuilderClient } from "@/components/dept-admin/timetable-builder-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminTimetablePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()

  // 1. Fetch user department & resolve fallback if unassigned
  const { data: userData } = await admin
    .from("users")
    .select("org_unit_id, org_units(id, name, display_name)")
    .eq("id", user.id)
    .maybeSingle()

  let deptId = userData?.org_unit_id || null
  let deptName =
    (userData?.org_units as any)?.display_name ||
    (userData?.org_units as any)?.name ||
    ""

  if (!deptId) {
    const { data: firstUnit } = await admin
      .from("org_units")
      .select("id, name, display_name")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle()

    if (firstUnit) {
      deptId = firstUnit.id
      deptName = firstUnit.display_name || firstUnit.name
    } else {
      deptName = "Academic Department"
    }
  }

  // 2. Fetch all academic programmes in the organization
  const { data: programmes } = await admin
    .from("academic_programs")
    .select("id, name, code, dept_id")
    .eq("organization_id", orgId)
    .order("code", { ascending: true })

  // 3. Fetch all curriculum subjects in the organization
  const { data: subjects } = await admin
    .from("subjects")
    .select("id, program_id, code, name, credits, subject_type, semester")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("code", { ascending: true })

  // 4. Fetch all academic batches in the organization (without nonexistent student_count)
  const { data: batches } = await admin
    .from("academic_batches")
    .select("id, program_id, year_of_study, section, current_semester, academic_year")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("year_of_study", { ascending: true })

  // 5. Fetch all faculty members in the organization
  const { data: faculty } = await admin
    .from("users")
    .select("id, name, email, designation, target_credits, org_unit_id")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  // 6. Fetch existing subject assignments with timetable slots
  const { data: assignments } = await admin
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
