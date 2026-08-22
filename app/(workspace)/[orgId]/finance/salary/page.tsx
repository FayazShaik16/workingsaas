import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTeachingStaff } from "@/lib/queries/teaching-staff"
import { FinanceSalaryConsole, FinanceFacultyMember } from "@/components/finance/finance-salary-console"
import { DollarSign } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function FinanceSalaryPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("FINANCE_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch only teaching staff in this org
  const teachingStaff = await getTeachingStaff(admin, orgId)
  const staffIds = teachingStaff.map((s) => s.id)

  // 2. Fetch personal wallet balances
  const { data: wallets } = await db
    .from("wallets")
    .select("owner_user_id, balance")
    .eq("organization_id", orgId)
    .eq("purpose", "PERSONAL")
    .in("owner_user_id", staffIds.length > 0 ? staffIds : ["00000000-0000-0000-0000-000000000000"])

  const walletMap = new Map((wallets || []).map((w: any) => [w.owner_user_id, Number(w.balance || 0)]))

  // 3. Fetch SALARY_POOL balance (with honest 0 fallback)
  const { data: salaryPoolWallet } = await db
    .from("wallets")
    .select("balance")
    .eq("organization_id", orgId)
    .eq("purpose", "SALARY_POOL")
    .maybeSingle()

  const poolBalance = Number(salaryPoolWallet?.balance ?? 0)

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  // 4. Fetch org units for names & monthly work progress
  const [
    { data: units },
    { data: progressRecords },
  ] = await Promise.all([
    db.from("org_units").select("id, name").eq("organization_id", orgId),
    db.from("monthly_work_progress").select("user_id, display_progress_percentage, raw_earned_credits, total_target_credits, salary_eligible").eq("organization_id", orgId).eq("month_start", currentMonthStart),
  ])

  const unitMap = new Map<string, string>((units || []).map((u: any) => [u.id, String(u.name || "Department")]))
  const progressMap = new Map<string, any>((progressRecords || []).map((p: any) => [p.user_id, p]))

  const formattedMembers: FinanceFacultyMember[] = teachingStaff.map((u) => {
    const p = progressMap.get(u.id)
    const targetCredits = Number(p?.total_target_credits || 0)
    const earnedCredits = Number(p?.raw_earned_credits || 0)
    const progress = Number(p?.display_progress_percentage || 0)

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      progress_percentage: progress,
      target_credits: targetCredits,
      wallet_balance: earnedCredits,
      org_unit_name: u.org_unit_id ? unitMap.get(u.org_unit_id) || "Department" : "Department",
      status: u.status || "ACTIVE",
    }
  })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <DollarSign className="h-8 w-8 text-primary" />
          Finance Payroll Authorization & Batch Reversal Console
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Cryptographically verify faculty milestone achievement and execute atomic token batch reversals to the Director SALARY_POOL upon payroll disbursement.
        </p>
      </div>

      <FinanceSalaryConsole
        orgId={orgId}
        salaryPoolBalance={poolBalance}
        initialMembers={formattedMembers}
      />
    </div>
  )
}
