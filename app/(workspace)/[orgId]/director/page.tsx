import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTeachingStaff } from "@/lib/queries/teaching-staff"
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
import { WalletCard } from "@/components/blockchain/wallet-card"
import { DirectorBudgetAllocator, DepartmentBudgetInfo } from "@/components/director/director-budget-allocator"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch all organizational core data in parallel
  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  const [
    { data: wallets },
    teachingStaff,
    { data: units },
    { data: tasks },
    { data: loanRequests },
    { data: activeLoansData },
    { data: progressRecords },
  ] = await Promise.all([
    db.from("wallets").select("id, purpose, balance, owner_user_id").eq("organization_id", orgId),
    getTeachingStaff(admin, orgId),
    db.from("org_units").select("id, name, unit_type, metadata, lead_user_id, users:lead_user_id(name)").eq("organization_id", orgId),
    db.from("tasks").select("id, status, credit_value, org_unit_id").eq("organization_id", orgId),
    db.from("loan_requests").select("id, borrower_user_id, amount, reason, status, created_at").eq("organization_id", orgId),
    db.from("loans").select("id, user_id, amount, status, created_at, description").eq("organization_id", orgId),
    db.from("monthly_work_progress").select("user_id, display_progress_percentage, salary_eligible, raw_earned_credits, total_target_credits").eq("organization_id", orgId).eq("month_start", currentMonthStart),
  ])

  const allWallets = wallets || []
  const allTeachingStaff = teachingStaff || []
  const allUnits = units || []
  const allTasks = tasks || []
  const allLoanRequests = loanRequests || []
  const allLoans = activeLoansData || []
  const progressMap = new Map<string, number>((progressRecords || []).map((p: any) => [p.user_id, Number(p.display_progress_percentage || 0)]))

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

  // Compute total verified rewards distributed
  const totalVerifiedTokens = allTasks
    .filter((t: any) => t.status === "VERIFIED" || t.status === "CLOSED" || t.status === "LEAD_SIGNED")
    .reduce((sum: number, t: any) => sum + Number(t.credit_value || 0), 0)

  const totalTokens = Math.max(salaryPool + personalPool + loanPool + treasuryPool, totalVerifiedTokens)

  // 3. User Progress & Threshold Metrics (Over Teaching Staff Only)
  const totalEmployees = allTeachingStaff.length
  const belowThresholdUsers = allTeachingStaff.filter((u: any) => (progressMap.get(u.id) || 0) < 85)
  const belowThresholdCount = belowThresholdUsers.length
  const eligibleCount = allTeachingStaff.filter((u: any) => (progressMap.get(u.id) || 0) >= 85).length
  const overallAvgProgress =
    totalEmployees > 0
      ? Math.round(
          allTeachingStaff.reduce((sum: number, u: any) => sum + (progressMap.get(u.id) || 0), 0) /
            totalEmployees
        )
      : 0

  // 4. Department Progress Heatmap (Over Teaching Staff Only)
  const heatmap = allUnits.map((unit: any) => {
    const deptMembers = allTeachingStaff.filter((u: any) => u.org_unit_id === unit.id)
    const memberCount = deptMembers.length
    const progresses = deptMembers.map((m: any) => progressMap.get(m.id) || 0)
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
      const userObj = allTeachingStaff.find((u: any) => u.id === l.user_id)
      const unitObj = allUnits.find((u: any) => u.id === userObj?.org_unit_id)
      const createdDate = new Date(l.created_at)
      const diffMonths = Math.max(
        1,
        (new Date().getFullYear() - createdDate.getFullYear()) * 12 +
          (new Date().getMonth() - createdDate.getMonth())
      )

      return {
        id: l.id,
        name: userObj?.name || "Faculty Member",
        department: unitObj?.name || "General",
        amount: Number(l.amount || 0),
        monthsInDebt: diffMonths,
        status: l.status === "ACTIVE" ? "Open" : "Partial",
      }
    })

  // 6. Dynamic Department Budget Allocation mapping
  const departmentsBudgetInfo: DepartmentBudgetInfo[] = allUnits.map((u: any) => {
    const meta = u.metadata && typeof u.metadata === "object" ? u.metadata : {}
    const deptTasks = allTasks.filter((t: any) => t.org_unit_id === u.id)
    const spentBudget = deptTasks
      .filter((t: any) => ["VERIFIED", "CLOSED", "LEAD_SIGNED", "APPROVED"].includes(t.status))
      .reduce((sum: number, t: any) => sum + Number(t.credit_value || 0), 0)

    return {
      id: u.id,
      name: u.name,
      unitType: u.unit_type || "Department",
      leadName: (u.users as any)?.name || undefined,
      allocatedBudget: Number(meta.allocated_budget || 0),
      spentBudget: spentBudget,
      budgetCurrency: meta.budget_currency || "WORK",
      budgetPeriod: meta.budget_period || "MONTHLY",
      budgetNotes: meta.budget_notes || undefined,
      lastUpdated: meta.budget_updated_at || undefined,
    }
  })

  // 7. Dynamic Pending Loan Approvals mapping (from loan_requests and loans)
  const parsedPendingLoans: any[] = []
  
  allLoanRequests
    .filter((lr: any) => lr.status === "PENDING")
    .forEach((lr: any) => {
      const userObj = allTeachingStaff.find((u: any) => u.id === lr.borrower_user_id)
      const unitObj = allUnits.find((u: any) => u.id === userObj?.org_unit_id)
      parsedPendingLoans.push({
        id: lr.id,
        name: userObj?.name || "Faculty Member",
        department: unitObj?.name || "General",
        amount: Number(lr.amount || 0),
        reason: lr.reason || "Emergency Advance Request",
      })
    })

  allLoans
    .filter((l: any) => l.status === "PENDING")
    .forEach((l: any) => {
      if (!parsedPendingLoans.find((p) => p.id === l.id)) {
        const userObj = allTeachingStaff.find((u: any) => u.id === l.user_id)
        const unitObj = allUnits.find((u: any) => u.id === userObj?.org_unit_id)
        parsedPendingLoans.push({
          id: l.id,
          name: userObj?.name || "Faculty Member",
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
              Faculty Below Threshold (&lt;85%)
            </CardTitle>
            <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
              <AlertCircle className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-destructive">{belowThresholdCount}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {eligibleCount} of {totalEmployees} Faculty Eligible
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
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Faculty Wallets
                </span>
                <span className="text-base font-black text-foreground mt-1">{personalPool.toLocaleString()} WORK</span>
                <span className="text-[10px] text-muted-foreground font-mono">{personalPercent}% of pool</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border flex flex-col">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Salary Reserve
                </span>
                <span className="text-base font-black text-foreground mt-1">{salaryPool.toLocaleString()} WORK</span>
                <span className="text-[10px] text-muted-foreground font-mono">{salaryPercent}% allocated</span>
              </div>

              <div className="p-3 rounded-xl bg-muted/40 border flex flex-col">
                <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  Loan Pool
                </span>
                <span className="text-base font-black text-foreground mt-1">{loanPool.toLocaleString()} WORK</span>
                <span className="text-[10px] text-muted-foreground font-mono">{loanPercent}% available</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Department Progress Heatmap */}
        <Card className="lg:col-span-5 rounded-2xl border-2 shadow-md flex flex-col">
          <CardHeader className="pb-2 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground">
                  Department Progress Heatmap
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Mean progress velocity across academic units
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono text-xs">
                Avg: {overallAvgProgress}%
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-4 space-y-3 flex-1 overflow-y-auto max-h-[350px]">
            {heatmap.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                No academic departments configured yet.
              </div>
            ) : (
              heatmap.map((dept: any) => (
                <div
                  key={dept.id}
                  className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs truncate text-foreground flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                      {dept.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {dept.memberCount} faculty members
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${
                          dept.progress >= 85
                            ? "bg-emerald-500"
                            : dept.progress >= 70
                            ? "bg-amber-500"
                            : "bg-destructive"
                        }`}
                        style={{ width: `${dept.progress}%` }}
                      />
                    </div>
                    <span className="text-xs font-mono font-bold w-9 text-right text-foreground">
                      {dept.progress}%
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[9px] font-bold uppercase px-1.5 py-0 ${
                        dept.status === "Healthy"
                          ? "border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
                          : dept.status === "Watch"
                          ? "border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          : "border-destructive/30 text-destructive bg-destructive/10"
                      }`}
                    >
                      {dept.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* On-Chain Institutional Treasury Mirror */}
      <WalletCard
        orgId={orgId}
        userRole="DIRECTOR"
        title="Institutional Treasury Mirror (Sepolia Testnet)"
        description="Genesis on-chain treasury wallet and cryptographic audit anchor for institutional settlement."
      />

      {/* Bottom Section: Active Work-Loans & Governance Triggers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Active Debt / Loans */}
        <Card className="lg:col-span-7 rounded-2xl border-2 shadow-md">
          <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-500" />
                Active Institutional Work-Debt
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Staff bridging salary gates via work-loan commitments
              </CardDescription>
            </div>
            <Link href={`/${orgId}/director/loans`}>
              <Button variant="ghost" size="sm" className="text-xs font-bold gap-1 text-primary">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>

          <CardContent className="p-4">
            {parsedActiveLoans.length === 0 && parsedPendingLoans.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs space-y-1">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto" />
                <p className="font-bold text-foreground">Zero Active Work Debt</p>
                <p>All faculty are meeting proof targets organically.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {parsedPendingLoans.map((pl: any) => (
                  <div
                    key={pl.id}
                    className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        {pl.name} ({pl.department})
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">{pl.reason}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                        {pl.amount} WORK
                      </span>
                      <Badge className="bg-amber-500 text-white text-[10px]">Pending Approval</Badge>
                    </div>
                  </div>
                ))}

                {parsedActiveLoans.map((al: any) => (
                  <div
                    key={al.id}
                    className="p-3 rounded-xl border bg-muted/20 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-foreground">{al.name} ({al.department})</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Active for {al.monthsInDebt} month(s)
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-foreground">{al.amount} WORK</span>
                      <Badge variant="outline" className="text-[10px] font-bold">
                        {al.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Director Executive Actions */}
        <Card className="lg:col-span-5 rounded-2xl border-2 shadow-md">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base font-black text-foreground">
              Institutional Governance Actions
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Cycle budget minting & emergency ledger freezes
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <DirectorActions
              initialPendingLoans={parsedPendingLoans}
            />
          </CardContent>
        </Card>
      </div>

      {/* Department Budget Allocation Console */}
      <DirectorBudgetAllocator
        orgId={orgId}
        departments={departmentsBudgetInfo}
        salaryPoolBalance={salaryPool}
      />
    </div>
  )
}
