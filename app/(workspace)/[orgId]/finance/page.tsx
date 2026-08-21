import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Coins,
  CreditCard,
  TrendingUp,
  Landmark,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Lock,
} from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function FinanceDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("FINANCE_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch organization wallets
  const { data: wallets } = await db
    .from("wallets")
    .select("id, owner_user_id, purpose, balance, is_locked")
    .eq("organization_id", orgId)
    .order("purpose", { ascending: true })

  // 2. Fetch total verified transaction volume
  const { data: transactions } = await db
    .from("token_transactions")
    .select("amount, type")
    .eq("organization_id", orgId)

  const allWallets = wallets || []
  const allTx = transactions || []

  const totalTokensDistributed = allTx.reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0)

  const salaryPool = allWallets.find((w: any) => w.purpose === "SALARY_POOL")
  const loanPool = allWallets.find((w: any) => w.purpose === "LOAN_POOL")
  const treasuryWallet = allWallets.find((w: any) => w.purpose === "TREASURY" || w.purpose === "ORGANIZATION")

  // 3. Fetch count of staff eligible for payroll release
  const { data: eligibleUsers } = await admin
    .from("users")
    .select("id, progress_percentage")
    .eq("organization_id", orgId)

  const totalStaff = eligibleUsers?.length || 0
  const eligibleStaffCount = (eligibleUsers || []).filter(
    (u) => Number(u.progress_percentage || 0) >= 85
  ).length

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Landmark className="h-8 w-8 text-primary" />
            Treasury & Finance Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Liquidity pools, payroll releases, emergency loans & cryptographic balance audit
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Salary Pool Liquidity
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Coins className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {Number(salaryPool?.balance || 0).toLocaleString()} WORK
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Available for salary release</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Emergency Loan Reserve
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {Number(loanPool?.balance || 0).toLocaleString()} WORK
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Allocated for staff credit</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Payroll Readiness
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {eligibleStaffCount} / {totalStaff}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Staff &ge;85% progress</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Volume Transacted
            </CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {totalTokensDistributed.toLocaleString()} WORK
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Lifetime verified throughput</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Navigation Modules */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href={`/${orgId}/finance/salary`}
          className="p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 group-hover:scale-105 transition-transform">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                Salary Release Execution
              </h3>
              <p className="text-xs text-muted-foreground font-medium">Disburse payroll to eligible staff</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href={`/${orgId}/finance/loans`}
          className="p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 group-hover:scale-105 transition-transform">
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                Treasury Loan Portfolio
              </h3>
              <p className="text-xs text-muted-foreground font-medium">Review advances & repayment terms</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>

        <Link
          href={`/${orgId}/finance/audit`}
          className="p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:shadow-md transition-all group flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="p-3 rounded-xl bg-purple-500/10 text-purple-600 group-hover:scale-105 transition-transform">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                Balance Sheet Audit
              </h3>
              <p className="text-xs text-muted-foreground font-medium">Cryptographic transaction journal</p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
        </Link>
      </div>

      {/* Organization Wallets Table */}
      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-foreground">
                Institutional Wallets & Reserves
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Active liquidity pools and dedicated organizational wallets
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-bold text-xs">
              {allWallets.length} Wallets
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {allWallets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <Landmark className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-bold text-foreground">No Wallets Configured</p>
              <p className="text-xs">Wallets will automatically initialize upon first task activity.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Wallet ID</TableHead>
                    <TableHead className="font-bold text-xs">Purpose / Category</TableHead>
                    <TableHead className="font-bold text-xs">Current Balance</TableHead>
                    <TableHead className="font-bold text-xs">Lock Status</TableHead>
                    <TableHead className="font-bold text-xs">Security</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allWallets.map((w: any) => (
                    <TableRow key={w.id} className="hover:bg-muted/30 transition">
                      <TableCell className="font-mono text-xs text-muted-foreground font-semibold">
                        {w.id}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            w.purpose === "SALARY_POOL"
                              ? "default"
                              : w.purpose === "LOAN_POOL"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px] font-bold uppercase tracking-wider"
                        >
                          {w.purpose}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-sm text-foreground">
                        {Number(w.balance).toLocaleString()} WORK
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={w.is_locked ? "destructive" : "secondary"}
                          className="text-[10px] font-bold"
                        >
                          {w.is_locked ? "LOCKED" : "ACTIVE"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <ShieldCheck className="h-3.5 w-3.5" /> Non-Custodial Relay
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
