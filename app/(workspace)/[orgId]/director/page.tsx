import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Building2,
  Users,
  CheckCircle2,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  ShieldCheck,
  Award,
} from "lucide-react"
import { DirectorActions } from "@/components/director/director-actions"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()

  // 1. Fetch all organizational core data in parallel
  const [
    { data: wallets },
    { data: users },
    { data: units },
    { data: tasks },
    { data: loanRequests },
    { data: activeLoansData },
  ] = await Promise.all([
    admin.from("wallets").select("id, purpose, balance, owner_user_id").eq("organization_id", orgId),
    admin.from("users").select("id, name, email, designation, org_unit_id, progress_percentage, quality_score, status").eq("organization_id", orgId),
    admin.from("org_units").select("id, name, unit_type").eq("organization_id", orgId),
    admin.from("tasks").select("id, status, token_value, org_unit_id").eq("organization_id", orgId),
    admin.from("loan_requests").select("id, borrower_user_id, amount, reason, status, created_at").eq("organization_id", orgId),
    admin.from("loans").select("id, user_id, amount, status, created_at, description").eq("organization_id", orgId),
  ])

  const allWallets = wallets || []
  const allUsers = users || []
  const allUnits = units || []
  const allTasks = tasks || []
  const allLoanRequests = loanRequests || []
  const allLoans = activeLoansData || []

  // 2. Compute dynamic Wallet & Token balances
  let salaryPool = 0
  let personalPool = 0
  let loanPool = 0
  let treasuryPool = 0

  allWallets.forEach((w: any) => {
    const bal = Number(w.balance || 0)
    if (w.purpose === "SALARY_POOL") salaryPool += bal
    else if (w.purpose === "PERSONAL") personalPool += bal
    else if (w.purpose === "LOAN_POOL") loanPool += bal
    else treasuryPool += bal
  })

  // If newly initialized with 0 tokens, compute total verified rewards distributed
  const totalVerifiedTokens = allTasks
    .filter((t: any) => t.status === "VERIFIED")
    .reduce((sum: number, t: any) => sum + Number(t.token_value || 0), 0)

  const totalTokens = Math.max(salaryPool + personalPool + loanPool + treasuryPool, totalVerifiedTokens)

  // 3. User Progress & Threshold Metrics
  const totalEmployees = allUsers.length
  const belowThresholdUsers = allUsers.filter((u: any) => Number(u.progress_percentage || 0) < 85)
  const belowThresholdCount = belowThresholdUsers.length
  const eligibleCount = allUsers.filter((u: any) => Number(u.progress_percentage || 0) >= 85).length
  const overallAvgProgress =
    totalEmployees > 0
      ? Math.round(
          allUsers.reduce((sum: number, u: any) => sum + Number(u.progress_percentage || 0), 0) /
            totalEmployees
        )
      : 0

  // 4. Department Progress Heatmap (100% dynamic)
  const heatmap = allUnits.map((unit: any) => {
    const deptMembers = allUsers.filter((u: any) => u.org_unit_id === unit.id)
    const memberCount = deptMembers.length
    const progresses = deptMembers.map((m: any) => Number(m.progress_percentage || 0))
    const avgProgress =
      memberCount > 0
        ? Math.round(progresses.reduce((a: number, b: number) => a + b, 0) / memberCount)
        : 0

    let status = "Healthy"
    if (memberCount > 0 && avgProgress < 70) status = "Critical"
    else if (memberCount > 0 && avgProgress < 85) status = "Watch"

    return {
      id: unit.id,
      name: unit.name,
      unitType: unit.unit_type || "Department",
      memberCount,
      progress: avgProgress,
      status,
    }
  })

  // 5. Dynamic Active Loans mapping
  const parsedActiveLoans = allLoans
    .filter((l: any) => l.status === "ACTIVE" || l.status === "PARTIAL")
    .map((l: any) => {
      const userObj = allUsers.find((u: any) => u.id === l.user_id)
      const unitObj = allUnits.find((u: any) => u.id === userObj?.org_unit_id)
      const createdDate = new Date(l.created_at)
      const diffMonths = Math.max(
        1,
        (new Date().getFullYear() - createdDate.getFullYear()) * 12 +
          (new Date().getMonth() - createdDate.getMonth())
      )

      return {
        id: l.id,
        name: userObj?.name || "Staff Member",
        department: unitObj?.name || "General",
        amount: Number(l.amount || 0),
        monthsInDebt: diffMonths,
        status: l.status === "ACTIVE" ? "Open" : "Partial",
      }
    })

  // 6. Dynamic Pending Loan Approvals mapping (from loan_requests and loans)
  const parsedPendingLoans: any[] = []
  
  allLoanRequests
    .filter((lr: any) => lr.status === "PENDING")
    .forEach((lr: any) => {
      const userObj = allUsers.find((u: any) => u.id === lr.borrower_user_id)
      const unitObj = allUnits.find((u: any) => u.id === userObj?.org_unit_id)
      parsedPendingLoans.push({
        id: lr.id,
        name: userObj?.name || "Staff Member",
        department: unitObj?.name || "General",
        amount: Number(lr.amount || 0),
        reason: lr.reason || "Emergency Advance Request",
      })
    })

  allLoans
    .filter((l: any) => l.status === "PENDING")
    .forEach((l: any) => {
      if (!parsedPendingLoans.find((p) => p.id === l.id)) {
        const userObj = allUsers.find((u: any) => u.id === l.user_id)
        const unitObj = allUnits.find((u: any) => u.id === userObj?.org_unit_id)
        parsedPendingLoans.push({
          id: l.id,
          name: userObj?.name || "Staff Member",
          department: unitObj?.name || "General",
          amount: Number(l.amount || 0),
          reason: l.description || "Credit shortfall coverage",
        })
      }
    })

  // Dynamic Chart Calculations
  const totalTokensNonZero = Math.max(totalTokens, 1)
  const personalPercent = Math.round((personalPool / totalTokensNonZero) * 100)
  const salaryPercent = Math.round((salaryPool / totalTokensNonZero) * 100)
  const loanPercent = Math.round((loanPool / totalTokensNonZero) * 100)
  const treasuryPercent = Math.max(0, 100 - personalPercent - salaryPercent - loanPercent)

  const circumference = 2 * Math.PI * 80 // ~502.65
  const personalStroke = (personalPercent / 100) * circumference
  const salaryStroke = (salaryPercent / 100) * circumference

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto min-h-screen">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            Executive Director Overview
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            Live institutional governance &bull; Liquidity velocity, departmental progress & risk matrix
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${orgId}/director/reports`}>
            <Button variant="outline" size="sm" className="gap-1.5 font-bold shadow-xs">
              <FileSpreadsheet className="h-4 w-4" /> Dept Reports
            </Button>
          </Link>
          <Link href={`/${orgId}/director/org-tree`}>
            <Button size="sm" className="gap-1.5 font-bold shadow-xs">
              <Layers className="h-4 w-4" /> Organization Tree
            </Button>
          </Link>
        </div>
      </div>

      {/* 4 Dynamic KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total WORK Tokens
            </CardTitle>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
              <Coins className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {totalTokens.toLocaleString()} <span className="text-xs text-muted-foreground font-mono">WORK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Circulating & Treasury Liquidity</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Tokens with Faculty
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {personalPool.toLocaleString()} <span className="text-xs text-muted-foreground font-mono">WORK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{personalPercent}% in active circulation</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Central Salary Reserve
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <ArrowDownLeft className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {salaryPool.toLocaleString()} <span className="text-xs text-muted-foreground font-mono">WORK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">{salaryPercent}% allocated for payroll</p>
          </CardContent>
        </Card>

        <Card className={`rounded-2xl border-2 shadow-xs ${belowThresholdCount > 0 ? "border-destructive/40 bg-destructive/5" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Staff Below Threshold (&lt;85%)
            </CardTitle>
            <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-destructive">{belowThresholdCount}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {eligibleCount} of {totalEmployees} Staff Eligible
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Middle Section: Live Token Circulation & Department Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Token Circulation Dynamic Donut */}
        <Card className="lg:col-span-7 rounded-2xl border-2 shadow-md flex flex-col justify-between">
          <CardHeader className="pb-2 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground">
                  Token Circulation Architecture
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Real-time ledger distribution across institutional pools
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-bold text-xs">
                Live Ledger State
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-6 flex flex-col items-center justify-center space-y-6">
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="88"
                  cy="88"
                  r="70"
                  stroke="var(--border)"
                  strokeWidth="14"
                  fill="transparent"
                />
                {/* Personal Pool Arc */}
                <circle
                  cx="88"
                  cy="88"
                  r="70"
                  stroke="#3b82f6"
                  strokeWidth="14"
                  strokeDasharray="440"
                  strokeDashoffset={440 - (personalPercent / 100) * 440}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-500"
                />
                {/* Salary Pool Arc */}
                <circle
                  cx="88"
                  cy="88"
                  r="70"
                  stroke="#10b981"
                  strokeWidth="14"
                  strokeDasharray="440"
                  strokeDashoffset={440 - ((personalPercent + salaryPercent) / 100) * 440}
                  strokeLinecap="round"
                  fill="transparent"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-black text-foreground">{totalTokens.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                  Total Minted
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full pt-4 border-t text-xs">
              <div className="p-3 rounded-xl bg-muted/40 border flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                  <span className="font-bold text-foreground">Salary Reserves</span>
                </div>
                <span className="text-xs font-mono font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                  {salaryPool.toLocaleString()} WORK ({salaryPercent}%)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                  <span className="font-bold text-foreground">Faculty Wallets</span>
                </div>
                <span className="text-xs font-mono font-bold mt-1 text-blue-600 dark:text-blue-400">
                  {personalPool.toLocaleString()} WORK ({personalPercent}%)
                </span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-bold text-foreground">Loan Reserve</span>
                </div>
                <span className="text-xs font-mono font-bold mt-1 text-amber-600 dark:text-amber-400">
                  {loanPool.toLocaleString()} WORK ({loanPercent}%)
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Progress Heatmap */}
        <Card className="lg:col-span-5 rounded-2xl border-2 shadow-md flex flex-col justify-between">
          <CardHeader className="pb-2 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground">
                  Department Progress Heatmap
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Milestone achievement indices by academic unit
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-bold text-xs">
                {heatmap.length} Departments
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-5 space-y-3 flex-1 overflow-y-auto max-h-[340px]">
            {heatmap.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-1">
                <Building2 className="h-6 w-6 text-muted-foreground mx-auto opacity-50" />
                <p className="font-bold text-foreground">No Departments Added</p>
                <p>Visit the Organization Tree to add units.</p>
              </div>
            ) : (
              heatmap.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border-2 bg-card hover:border-primary/40 transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-extrabold text-xs text-foreground truncate">{item.name}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground mt-0.5 block">
                      {item.memberCount} Staff Members
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          item.progress >= 85
                            ? "bg-emerald-500"
                            : item.progress >= 70
                            ? "bg-amber-500"
                            : "bg-destructive"
                        }`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold text-foreground w-8 text-right">
                      {item.progress}%
                    </span>
                    <Badge
                      className={`text-[9px] font-bold ${
                        item.status === "Healthy"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                          : item.status === "Watch"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-destructive/15 text-destructive border-destructive/30"
                      }`}
                    >
                      {item.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>

      {/* Active Work Loans Table */}
      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black text-foreground">Active Work Credit Advances</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Outstanding employee debit balances against collateral work milestones
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-bold text-xs">
            {parsedActiveLoans.length} Active Loans
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-bold uppercase text-[10px]">
                <tr className="border-b">
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Loan Amount</th>
                  <th className="py-3 px-4">Duration in Debt</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parsedActiveLoans.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground font-medium text-xs">
                      No active emergency loans or debit balances in the organization.
                    </td>
                  </tr>
                ) : (
                  parsedActiveLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-muted/30 transition">
                      <td className="py-3 px-4 font-bold text-foreground">{loan.name}</td>
                      <td className="py-3 px-4 text-muted-foreground font-medium">{loan.department}</td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {Number(loan.amount).toLocaleString()} WORK
                      </td>
                      <td className="py-3 px-4 font-medium text-muted-foreground">
                        {loan.monthsInDebt} {loan.monthsInDebt === 1 ? "month" : "months"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-[10px] font-bold">
                          {loan.status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pending Loan Approvals list (Interactive Container) */}
      <DirectorActions initialPendingLoans={parsedPendingLoans} />

    </div>
  )
}
