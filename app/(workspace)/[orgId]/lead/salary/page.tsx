import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTeachingStaff } from "@/lib/queries/teaching-staff"
import { HODSalaryApprovalConsole, FacultySalaryProfile } from "@/components/lead/hod-salary-approval-console"
import { CreditCard } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadSalaryApprovePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch current user profile to determine department
  const { data: userProfile } = await db
    .from("users")
    .select("org_unit_id")
    .eq("id", user.id)
    .single()

  const deptId = userProfile?.org_unit_id || user.orgUnitId

  // 2. Fetch canonical teaching staff (scoped to this department if lead)
  const teachingStaff = await getTeachingStaff(admin, orgId, deptId || undefined)
  const staffIds = teachingStaff.map((s) => s.id)

  // 3. Fetch personal wallet balances for each teaching staff member
  const { data: wallets } = await db
    .from("wallets")
    .select("owner_user_id, balance")
    .eq("organization_id", orgId)
    .eq("purpose", "PERSONAL")
    .in("owner_user_id", staffIds.length > 0 ? staffIds : ["00000000-0000-0000-0000-000000000000"])

  const walletMap = new Map((wallets || []).map((w: any) => [w.owner_user_id, Number(w.balance || 0)]))

  // 4. Fetch attendance records count per faculty
  const { data: attendanceStats } = await db
    .from("attendance_records")
    .select("faculty_id, status")
    .eq("organization_id", orgId)
    .in("status", ["VERIFIED", "CONDUCTED"])
    .in("faculty_id", staffIds.length > 0 ? staffIds : ["00000000-0000-0000-0000-000000000000"])

  const attendanceCountMap = new Map<string, number>()
  for (const a of attendanceStats || []) {
    attendanceCountMap.set(a.faculty_id, (attendanceCountMap.get(a.faculty_id) || 0) + 1)
  }

  // 5. Fetch approved leaves count
  const { data: leaveStats } = await db
    .from("leaves")
    .select("user_id, status")
    .eq("organization_id", orgId)
    .eq("status", "APPROVED")
    .in("user_id", staffIds.length > 0 ? staffIds : ["00000000-0000-0000-0000-000000000000"])

  const leaveCountMap = new Map<string, number>()
  for (const l of leaveStats || []) {
    leaveCountMap.set(l.user_id, (leaveCountMap.get(l.user_id) || 0) + 1)
  }

  // 6. Fetch active loans to determine debt state
  const { data: activeLoans } = await db
    .from("loans")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .in("user_id", staffIds.length > 0 ? staffIds : ["00000000-0000-0000-0000-000000000000"])

  const activeLoanUserSet = new Set((activeLoans || []).map((l: any) => l.user_id))

  // 7. Fetch org units for names
  const { data: units } = await db
    .from("org_units")
    .select("id, name")
    .eq("organization_id", orgId)

  const unitMap = new Map<string, string>((units || []).map((u: any) => [u.id, String(u.name || "Department")]))

  const formattedMembers: FacultySalaryProfile[] = teachingStaff.map((u) => {
    const targetCredits = u.target_credits !== null && u.target_credits !== undefined ? Number(u.target_credits) : 0
    const earnedCredits = Number(walletMap.get(u.id) || 0)
    const calculatedProgress = targetCredits > 0 ? Math.round((earnedCredits / targetCredits) * 100) : 0

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      progress_percentage: calculatedProgress,
      earned_credits: earnedCredits,
      target_credits: targetCredits,
      quality_score: Number(u.quality_score || 5.0),
      attendance_logged_count: attendanceCountMap.get(u.id) || 0,
      approved_leaves_count: leaveCountMap.get(u.id) || 0,
      has_active_loan: activeLoanUserSet.has(u.id),
      org_unit_name: u.org_unit_id ? unitMap.get(u.org_unit_id) || "Department" : "Department",
      status: u.status || "ACTIVE",
    }
  })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          Department Salary Release Approval Queue
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Review teaching faculty monthly work progress against the 85% cryptographic verification threshold and apply digital signatures before Finance release.
        </p>
      </div>

      <HODSalaryApprovalConsole
        orgId={orgId}
        leadUserId={user.id}
        members={formattedMembers}
      />
    </div>
  )
}
