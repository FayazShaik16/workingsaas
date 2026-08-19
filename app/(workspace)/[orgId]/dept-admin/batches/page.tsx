import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { BatchesClient } from "@/components/dept-admin/batches-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminBatchesPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()

  // 1. Fetch academic programmes
  const { data: programmes } = await admin
    .from("academic_programs")
    .select("id, name, code")
    .eq("organization_id", orgId)
    .order("code", { ascending: true })

  // 2. Fetch academic batches with program details (without nonexistent student_count)
  const { data: batches } = await admin
    .from("academic_batches")
    .select(`
      id,
      year_of_study,
      current_semester,
      section,
      academic_year,
      program_id,
      academic_programs (id, name, code)
    `)
    .eq("organization_id", orgId)
    .order("year_of_study", { ascending: true })

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <BatchesClient
        orgId={orgId}
        programmes={(programmes as any) || []}
        initialBatches={(batches as any) || []}
      />
    </div>
  )
}
