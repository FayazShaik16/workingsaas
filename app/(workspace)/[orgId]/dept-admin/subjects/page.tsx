import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { SubjectsClient } from "@/components/dept-admin/subjects-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminSubjectsPage({ params }: PageProps) {
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

  // 2. Fetch subjects with academic program details
  const { data: subjects } = await admin
    .from("subjects")
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
    .eq("organization_id", orgId)
    .order("code", { ascending: true })

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <SubjectsClient
        orgId={orgId}
        programmes={(programmes as any) || []}
        initialSubjects={(subjects as any) || []}
      />
    </div>
  )
}
