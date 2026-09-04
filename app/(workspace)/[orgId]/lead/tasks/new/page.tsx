import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { TaskCreatorWizard } from "@/components/marketplace/task-creator-wizard"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadNewTaskPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const supabase = await createClient()
  const db = supabase as any

  // Fetch departments in this organization
  const { data: orgUnits } = await db
    .from("org_units")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  // Fetch teaching staff for this department
  let facultyMembersQuery = db
    .from("users")
    .select("id, name, email")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  if (user.orgUnitId) {
    facultyMembersQuery = facultyMembersQuery.eq("org_unit_id", user.orgUnitId)
  }

  const { data: facultyMembers } = await facultyMembersQuery

  return (
    <div className="p-6 md:p-8">
      <TaskCreatorWizard
        orgId={orgId}
        role="LEAD"
        orgUnits={orgUnits || []}
        defaultOrgUnitId={user.orgUnitId || undefined}
        facultyMembers={facultyMembers || []}
      />
    </div>
  )
}
