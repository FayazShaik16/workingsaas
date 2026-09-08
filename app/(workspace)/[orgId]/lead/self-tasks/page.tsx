import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDepartmentSelfTasks } from "@/lib/workledger/self-tasks"
import { HODSelfTasksView } from "@/components/lead/hod-self-tasks-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadSelfTasksPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

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

  const {
    pendingProposals,
    pendingVerifications,
    activeInProgress,
    completedTasks,
    allTasks,
  } = await getDepartmentSelfTasks(orgId, deptId || undefined)

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <HODSelfTasksView
        orgId={orgId}
        deptName={deptName}
        pendingProposals={pendingProposals}
        pendingVerifications={pendingVerifications}
        activeInProgress={activeInProgress}
        completedTasks={completedTasks}
        allTasks={allTasks}
      />
    </div>
  )
}
