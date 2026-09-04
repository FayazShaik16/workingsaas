import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { DirectorLoanDesk, LoanRequestItem } from "@/components/director/director-loan-desk"
import { CreditCard } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorLoansPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  // 1. Fetch loans and progress in parallel
  const [
    { data: rawRequests, error: reqErr },
    { data: loanWallet },
    { data: progressRecords },
  ] = await Promise.all([
    db
      .from("loans")
      .select(`
        id,
        amount,
        remaining,
        reason,
        status,
        created_at,
        borrower:user_id (
          id,
          name,
          email,
          org_units (name)
        )
      `)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false }),
    db
      .from("wallets")
      .select("balance")
      .eq("organization_id", orgId)
      .eq("purpose", "LOAN_POOL")
      .maybeSingle(),
    db
      .from("monthly_work_progress")
      .select("user_id, display_progress_percentage")
      .eq("organization_id", orgId)
      .eq("month_start", currentMonthStart),
  ])

  if (reqErr) {
    console.warn("[director/loans] query error:", reqErr.message)
  }

  const poolBalance = Number(loanWallet?.balance ?? 0)
  const progressMap = new Map((progressRecords || []).map((p: any) => [p.user_id, Number(p.display_progress_percentage || 0)]))

  const formattedRequests: LoanRequestItem[] = (rawRequests || []).map((r: any) => ({
    id: r.id,
    amount: Number(r.amount || 0),
    reason: r.reason || "Deficit bridge",
    status: r.status || "PENDING",
    created_at: r.created_at,
    applicant: r.borrower ? {
      id: r.borrower.id,
      name: r.borrower.name,
      email: r.borrower.email,
      progress_percentage: Number(progressMap.get(r.borrower.id) || 0),
      org_unit_name: r.borrower.org_units?.name || "General",
    } : null,
  }))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          Executive Work-Loan & Credit Authorization Desk
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Authorize emergency work-debt token disbursements from the LOAN_POOL to clear faculty monthly salary claims.
        </p>
      </div>

      <DirectorLoanDesk
        orgId={orgId}
        directorUserId={user.id}
        loanPoolBalance={poolBalance}
        initialRequests={formattedRequests}
      />
    </div>
  )
}
