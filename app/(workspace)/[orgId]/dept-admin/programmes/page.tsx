import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { ProgrammesClient } from "@/components/dept-admin/programmes-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminProgrammesPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // 1. Fetch user department
  const { data: userData } = await supabase
    .from("users")
    .select("org_unit_id")
    .eq("id", user.id)
    .single()

  const deptId = userData?.org_unit_id

  // 2. Fetch academic programmes
  const { data: programmes } = await supabase
    .from("academic_programs")
    .select("id, name, code, created_at")
    .eq("organization_id", orgId)
    .order("code", { ascending: true })

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <ProgrammesClient
        orgId={orgId}
        deptId={deptId || ""}
        initialProgrammes={programmes || []}
      />
    </div>
  )
}
