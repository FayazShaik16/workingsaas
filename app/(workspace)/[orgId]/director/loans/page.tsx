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

  // 1. Fetch loan requests from loan_requests table (or fallback loans)
  const { data: rawRequests } = await db
    .from("loan_requests")
    .select(`
      id,
      amount,
      reason,
      status,
      created_at,
      repayment_terms,
      borrower:borrower_user_id (
        id,
        name,
        email,
        progress_percentage,
        org_units (name)
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  // 2. Fetch loan pool balance
  const { data: loanWallet } = await db
    .from("wallets")
    .select("balance")
    .eq("organization_id", orgId)
    .eq("purpose", "LOAN_POOL")
    .maybeSingle()

  const poolBalance = Number(loanWallet?.balance || 5000)

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
      progress_percentage: Number(r.borrower.progress_percentage || 0),
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
