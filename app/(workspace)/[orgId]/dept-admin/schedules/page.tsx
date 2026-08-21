import { requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { TrustedScheduleManager } from "@/components/dept-admin/trusted-schedule-manager"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminSchedulesPage({ params }: PageProps) {
  const { orgId } = await params
  await requireScope("DEPT_ADMIN", "SYSTEM_ADMIN", "DIRECTOR", "ORG_UNIT_LEAD")
  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch department faculty members
  const { data: facultyMembers } = await db
    .from("users")
    .select("id, name, email, employee_id, designation")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .order("name", { ascending: true })

  // 2. Fetch work cycles
  const { data: workCycles } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  // 3. Fetch scheduled work templates
  const { data: templates } = await db
    .from("scheduled_work_templates")
    .select("*, users!assigned_to_id(name, email)")
    .eq("organization_id", orgId)
    .order("weekly_day", { ascending: true })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          Schedules & Work Templates
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Define recurring weekly sessions for faculty members and generate dated monthly work instances.
        </p>
      </div>

      <TrustedScheduleManager
        orgId={orgId}
        facultyMembers={facultyMembers || []}
        workCycles={workCycles || []}
        initialTemplates={templates || []}
      />
    </div>
  )
}
