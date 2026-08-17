import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { ImportClient } from "@/components/dept-admin/import-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminImportPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // 1. Fetch department faculty
  const { data: faculty } = await supabase
    .from("users")
    .select("id, email, name")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  // 2. Fetch subjects
  const { data: subjects } = await supabase
    .from("subjects")
    .select("id, code, name")
    .eq("organization_id", orgId)
    .order("code", { ascending: true })

  // 3. Fetch academic batches
  const { data: batches } = await supabase
    .from("academic_batches")
    .select("id, section, year_of_study")
    .eq("organization_id", orgId)
    .order("year_of_study", { ascending: true })

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <ImportClient
        orgId={orgId}
        faculty={faculty || []}
        subjects={subjects || []}
        batches={batches || []}
      />
    </div>
  )
}
