import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDepartmentGeneralProductivity } from "@/lib/workledger/general-tasks"
import { GeneralTasksManagerView } from "@/components/general-tasks/general-tasks-manager-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadGeneralTasksPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch current user profile to determine department
  const { data: userProfile } = await db
    .from("users")
    .select("org_unit_id, org_units(id, name)")
    .eq("id", user.id)
    .single()

  const deptId = userProfile?.org_unit_id || user.orgUnitId
  const deptName = (userProfile?.org_units as any)?.name || "Academic Department"

  // 2. Fetch productivity, roster, and pending claims for this department
  const { summary, facultyRoster, pendingApprovals, templates } =
    await getDepartmentGeneralProductivity(orgId, deptId || undefined)

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <GeneralTasksManagerView
        orgId={orgId}
        roleTitle="Department Head (HOD)"
        scopeName={deptName}
        summary={summary}
        facultyRoster={facultyRoster}
        pendingApprovals={pendingApprovals}
        templates={templates}
        currentDeptId={deptId}
      />
    </div>
  )
}
