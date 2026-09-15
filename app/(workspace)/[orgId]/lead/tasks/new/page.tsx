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

  // Resolve department for HOD / Dept Admin: strictly scoped to own department
  let userDeptId = user.orgUnitId
  if (!userDeptId) {
    const { data: leadUnit } = await db
      .from("org_units")
      .select("id")
      .eq("organization_id", orgId)
      .eq("lead_user_id", user.id)
      .maybeSingle()
    if (leadUnit) {
      userDeptId = leadUnit.id
    }
  }

  // Dept admin / HOD should NOT have scope to create tasks for other departments
  let orgUnitsQuery = db
    .from("org_units")
    .select("id, name")
    .eq("organization_id", orgId)

  if (userDeptId) {
    orgUnitsQuery = orgUnitsQuery.eq("id", userDeptId)
  }

  const { data: orgUnits } = await orgUnitsQuery.order("name", { ascending: true })

  // Fetch teaching staff strictly for this department
  let facultyMembersQuery = db
    .from("users")
    .select("id, name, email")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  if (userDeptId) {
    facultyMembersQuery = facultyMembersQuery.eq("org_unit_id", userDeptId)
  }

  const { data: facultyMembers } = await facultyMembersQuery

  return (
    <div className="p-6 md:p-8">
      <TaskCreatorWizard
        orgId={orgId}
        role="LEAD"
        orgUnits={orgUnits || []}
        defaultOrgUnitId={userDeptId || undefined}
        facultyMembers={facultyMembers || []}
      />
    </div>
  )
}
