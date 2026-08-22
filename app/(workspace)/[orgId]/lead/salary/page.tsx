import { requireAuth, requireScope } from "@/lib/auth/protect"
import { getDepartmentDashboardData } from "@/lib/workledger/department-dashboard"
import { HODSalaryApprovalConsole, DepartmentSalaryRequestItem } from "@/components/lead/hod-salary-approval-console"
import { Card, CardContent } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadSalaryApprovePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const deptData = await getDepartmentDashboardData(orgId, user.orgUnitId ?? null)

  if (!deptData.department) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="font-semibold text-foreground text-sm">Department Assignment Required</p>
            <p className="text-muted-foreground">
              Your account must be assigned to an active department to review salary claims.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const requests: DepartmentSalaryRequestItem[] = deptData.salaryRequestsList.map((r) => ({
    id: r.requestId,
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail,
    designation: "Faculty Member",
    earnedCredits: r.earnedCredits,
    targetCredits: r.targetCredits,
    progressPercentage: r.progressPercentage,
    isEligible: r.progressPercentage >= 85,
    status: r.status,
    requestedAt: r.requestedAt,
  }))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Department Salary Approvals
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Review and endorse monthly salary claims for {deptData.department.name} faculty members.
        </p>
      </div>

      <HODSalaryApprovalConsole
        orgId={orgId}
        deptName={deptData.department.name}
        requests={requests}
      />
    </div>
  )
}
