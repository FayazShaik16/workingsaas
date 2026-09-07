import { requireAuth, requireScope } from "@/lib/auth/protect"
import { getMemberDashboardData } from "@/lib/workledger/member-dashboard"
import { getDepartmentDashboardData } from "@/lib/workledger/department-dashboard"
import { LeadDashboardContainer } from "@/components/lead/lead-dashboard-container"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  // Fetch unified personal data for HOD
  const personalData = await getMemberDashboardData(orgId, user.id)

  // Fetch unified department data for HOD (auto-resolves from orgUnitId or lead_user_id)
  const departmentData = await getDepartmentDashboardData(orgId, user.orgUnitId ?? null, user.id)

  return (
    <LeadDashboardContainer
      orgId={orgId}
      personalData={personalData}
      departmentData={departmentData}
    />
  )
}
