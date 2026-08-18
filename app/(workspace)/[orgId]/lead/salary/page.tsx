import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
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

  // 1. Fetch department faculty members
  const { data: rawUsers } = await db
    .from("users")
    .select(`
      id,
      name,
      email,
      target_credits,
      progress_percentage,
      quality_score,
      status,
      org_units (name)
    `)
    .eq("organization_id", orgId)
    .order("progress_percentage", { ascending: false })

  // 2. Fetch personal wallet balances for each user
  const { data: wallets } = await db
    .from("wallets")
    .select("owner_user_id, balance")
    .eq("organization_id", orgId)
    .eq("purpose", "PERSONAL")

  const walletMap = new Map((wallets || []).map((w: any) => [w.owner_user_id, Number(w.balance || 0)]))

  // 3. Fetch attendance counts per faculty
  const { data: attendanceStats } = await db
    .from("attendance_records")
    .select("faculty_id, status")
    .eq("organization_id", orgId)
    .eq("status", "VERIFIED")

  const attendanceCountMap = new Map<string, number>()
  for (const a of attendanceStats || []) {
    attendanceCountMap.set(a.faculty_id, (attendanceCountMap.get(a.faculty_id) || 0) + 1)
  }

  // 4. Fetch approved leaves count
  const { data: leaveStats } = await db
    .from("leaves")
    .select("user_id, status")
    .eq("organization_id", orgId)
    .eq("status", "APPROVED")

  const leaveCountMap = new Map<string, number>()
  for (const l of leaveStats || []) {
    leaveCountMap.set(l.user_id, (leaveCountMap.get(l.user_id) || 0) + 1)
  }

  const formattedMembers: FacultySalaryProfile[] = (rawUsers || []).map((u: any) => {
    const targetCredits = Number(u.target_credits || 50.0)
    const earnedCredits = Number(walletMap.get(u.id) || 0)
    const calculatedProgress = targetCredits > 0 ? Math.round((earnedCredits / targetCredits) * 100) : 0

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      progress_percentage: calculatedProgress,
      earned_credits: earnedCredits,
      target_credits: targetCredits,
      quality_score: Number(u.quality_score || 4.8),
      attendance_logged_count: attendanceCountMap.get(u.id) || 0,
      approved_leaves_count: leaveCountMap.get(u.id) || 0,
      has_active_loan: false,
      org_unit_name: u.org_units?.name || "Department",
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
          Review employee monthly work progress against the 85% cryptographic verification threshold and apply digital signatures before Finance release.
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
