import { requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { TimetableImportCenter } from "@/components/dept-admin/timetable-import-center"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminImportPage({ params }: PageProps) {
  const { orgId } = await params
  await requireScope("DEPT_ADMIN", "SYSTEM_ADMIN", "DIRECTOR", "ORG_UNIT_LEAD")
  const admin = createAdminClient()
  const db = admin as any

  // Fetch active work cycles
  const { data: workCycles } = await db
    .from("work_cycles")
    .select("id, name, status")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          Timetable Import Center
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Upload standardized .xlsx or .csv timetable files to generate recurring weekly work sessions for department faculty.
        </p>
      </div>

      <TimetableImportCenter orgId={orgId} workCycles={workCycles || []} />
    </div>
  )
}
