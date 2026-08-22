import { requireAuth } from "@/lib/auth/protect"
import { getMemberDashboardData } from "@/lib/workledger/member-dashboard"
import { MinimalFacultyDashboard } from "@/components/member/minimal-faculty-dashboard"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()

  // Fetch unified dashboard data from single shared service layer
  const data = await getMemberDashboardData(orgId, user.id)

  return (
    <MinimalFacultyDashboard
      orgId={orgId}
      userId={user.id}
      userName={data.user.name}
      userDesignation={data.user.designation}
      departmentName={data.user.departmentName}
      progress={data.progress}
      todayInstances={data.todayInstances}
      nextUpcomingInstance={data.nextUpcomingInstance}
      assignedTasks={data.assignedTasks}
      recentActivity={data.recentActivity}
    />
  )
}
