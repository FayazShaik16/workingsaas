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

  // 4. Fetch org units for names
  const { data: units } = await db
    .from("org_units")
    .select("id, name")
    .eq("organization_id", orgId)

  const unitMap = new Map((units || []).map((u: any) => [u.id, u.name]))

  const formattedMembers: FinanceFacultyMember[] = teachingStaff.map((u) => {
    const targetCredits = Number(u.target_credits || 50.0)
    const walletBalance = Number(walletMap.get(u.id) || 0)
    const progress = targetCredits > 0 ? Math.round((walletBalance / targetCredits) * 100) : 0

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      progress_percentage: progress,
      target_credits: targetCredits,
      wallet_balance: walletBalance,
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
