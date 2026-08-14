import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Coins, ArrowUpRight, ArrowDownLeft, AlertCircle, FileSpreadsheet } from "lucide-react"
import { DirectorActions } from "@/components/director/director-actions"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR")

  const supabase = await createClient()

  // 1. Aggregated Wallet Balances
  const { data: wallets } = await supabase
    .from("wallets")
    .select("purpose, balance")
    .eq("organization_id", orgId)

  let salaryPool = 0
  let personalPool = 0
  let loanPool = 0

  wallets?.forEach((w) => {
    if (w.purpose === "SALARY_POOL") salaryPool += Number(w.balance)
    if (w.purpose === "PERSONAL") personalPool += Number(w.balance)
    if (w.purpose === "LOAN_POOL") loanPool += Number(w.balance)
  })

  const totalTokens = salaryPool + personalPool + loanPool

  // 2. Count users below 85% progress threshold
  const { count: belowThresholdCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .lt("progress_percentage", 85)

  // 3. Department Progress Heatmap
  const { data: units } = await supabase
    .from("org_units")
    .select(`
      id,
      name,
      users(progress_percentage)
    `)
    .eq("organization_id", orgId)

  const heatmap = (units || []).map((unit: any) => {
    const userProgresses = unit.users?.map((u: any) => Number(u.progress_percentage)) || []
    const averageProgress = userProgresses.length > 0 
      ? Math.round(userProgresses.reduce((a: number, b: number) => a + b, 0) / userProgresses.length)
      : 0
    
    let status = "On Track"
    if (averageProgress < 70) status = "Critical"
    else if (averageProgress < 90) status = "Watch"

    return {
      id: unit.id,
      name: unit.name,
      progress: averageProgress,
      status
    }
  })

  // 4. Active Work Loans list
  const { data: activeLoans } = await supabase
    .from("loans")
    .select(`
      id,
      amount,
      status,
      created_at,
      users:user_id (
        name,
        org_units:org_unit_id(name)
      )
    `)
    .eq("organization_id", orgId)
    .in("status", ["ACTIVE", "PARTIAL"])

  const parsedActiveLoans = (activeLoans || []).map((l: any) => {
    const createdDate = new Date(l.created_at)
    const diffMonths = Math.max(1, (new Date().getFullYear() - createdDate.getFullYear()) * 12 + (new Date().getMonth() - createdDate.getMonth()))
    return {
      id: l.id,
      name: l.users?.name || "Unknown User",
      department: l.users?.org_units?.name || "Unassigned",
      amount: l.amount,
      monthsInDebt: diffMonths,
      status: l.status === "ACTIVE" ? "Open" : "Partial"
    }
  })

  // 5. Pending Loans requests
  const { data: pendingLoans } = await supabase
    .from("loans")
    .select(`
      id,
      amount,
      description,
      users:user_id (
        name,
        org_units:org_unit_id(name)
      )
    `)
    .eq("organization_id", orgId)
    .eq("status", "PENDING")

  const parsedPendingLoans = (pendingLoans || []).map((pl: any) => ({
    id: pl.id,
    name: pl.users?.name || "Unknown Requestor",
    department: pl.users?.org_units?.name || "Unassigned",
    amount: pl.amount,
    reason: pl.description || "Credit shortfall coverage request"
  }))

  // Calculate chart proportions
  const personalPercent = totalTokens > 0 ? ((personalPool / totalTokens) * 100).toFixed(1) : "0"
  const reversedPercent = totalTokens > 0 ? ((salaryPool / totalTokens) * 100).toFixed(1) : "0"
  const loanPercent = totalTokens > 0 ? ((loanPool / totalTokens) * 100).toFixed(1) : "0"

  return (
    <div className="space-y-8 p-8 min-h-screen bg-linear-to-b from-background to-muted/20">
      
      {/* Title section */}
      <div>
        <h1 className="text-3xl font-light tracking-tight text-foreground/90">Director Dashboard</h1>
        <p className="text-muted-foreground font-light mt-1">Cross-Department Overview — Semester 2025-26</p>
      </div>

      {/* 4 KPIs grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-light text-muted-foreground uppercase">Total Tokens Minted</span>
            <Coins className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight">{totalTokens.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">WORK</span></div>
            <p className="text-[10px] text-muted-foreground mt-2 font-light">This Semester</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-light text-muted-foreground uppercase">Tokens with Faculty</span>
            <ArrowUpRight className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight">{personalPool.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">WORK</span></div>
            <p className="text-[10px] text-muted-foreground mt-2 font-light">{personalPercent}% of minted</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-light text-muted-foreground uppercase">Tokens in Central Pool</span>
            <ArrowDownLeft className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight">{salaryPool.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">WORK</span></div>
            <p className="text-[10px] text-muted-foreground mt-2 font-light">{reversedPercent}% returned</p>
          </CardContent>
        </Card>

        <Card className={`rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs ${belowThresholdCount && belowThresholdCount > 0 ? "border-l-4 border-l-destructive" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <span className="text-xs font-light text-muted-foreground uppercase">Faculty Below Threshold</span>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-light tracking-tight text-destructive">{belowThresholdCount || 0}</div>
            <Badge variant={belowThresholdCount && belowThresholdCount > 0 ? "destructive" : "secondary"} className="mt-2 text-[9px] font-light">
              {belowThresholdCount && belowThresholdCount > 0 ? "Needs Attention" : "Clear"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Token Circulation Donut chart */}
        <Card className="lg:col-span-2 rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-lg font-light">Token Circulation</CardTitle>
            <CardDescription className="font-light">Semester 2025-26 - All amounts in WORK tokens</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-6">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="96" cy="96" r="80" stroke="#f3f4f6" strokeWidth="16" fill="transparent" />
                <circle cx="96" cy="96" r="80" stroke="#3b82f6" strokeWidth="16" strokeDasharray="502" strokeDashoffset="240" fill="transparent" />
                <circle cx="96" cy="96" r="80" stroke="#22c55e" strokeWidth="16" strokeDasharray="502" strokeDashoffset="400" fill="transparent" />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-2xl font-light tracking-tight">{totalTokens.toLocaleString()}</span>
                <span className="text-[10px] text-muted-foreground uppercase font-light">Total Minted</span>
              </div>
            </div>
            <div className="flex justify-center gap-6 mt-8 text-xs font-light">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500" />
                <span>Central reserves: {salaryPool.toLocaleString()} WORK ({reversedPercent}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                <span>With Faculty: {personalPool.toLocaleString()} WORK ({personalPercent}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500" />
                <span>Loan Pool: {loanPool.toLocaleString()} WORK ({loanPercent}%)</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Heatmap list */}
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader>
            <CardTitle className="text-lg font-light">Department Progress Heatmap</CardTitle>
            <CardDescription className="font-light">Task completion rates by unit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {heatmap.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center font-light">No departments configured.</p>
            ) : (
              heatmap.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl border border-muted/40 bg-background/40">
                  <span className="text-sm font-light">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{item.progress}%</span>
                    <Badge variant={item.status === "On Track" ? "secondary" : item.status === "Watch" ? "outline" : "destructive"} className="text-[9px] font-light rounded px-1.5 py-0.5">
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
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle className="text-lg font-light">Active Work Loans</CardTitle>
            <CardDescription className="font-light">Outstanding token debit balances</CardDescription>
          </div>
          <Button variant="outline" size="sm" className="rounded-xl flex items-center gap-1.5">
            <FileSpreadsheet className="h-4 w-4" /> Export CSV
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm font-light">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="py-3 px-4">Faculty Name</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Loan Amount</th>
                <th className="py-3 px-4">Months in Debt</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {parsedActiveLoans.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-muted-foreground font-light">No active work loans.</td>
                </tr>
              ) : (
                parsedActiveLoans.map((loan) => (
                  <tr key={loan.id} className={`border-b hover:bg-muted/40 transition-colors ${loan.monthsInDebt >= 3 ? "bg-destructive/5" : ""}`}>
                    <td className="py-3 px-4 font-normal">{loan.name}</td>
                    <td className="py-3 px-4">{loan.department}</td>
                    <td className="py-3 px-4 font-medium">{loan.amount} WORK</td>
                    <td className="py-3 px-4 text-destructive flex items-center gap-1">
                      {loan.monthsInDebt} months {loan.monthsInDebt >= 3 && <AlertCircle className="h-3 w-3" />}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={loan.status === "Open" ? "outline" : "secondary"} className="text-[10px] font-light rounded">
                        {loan.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button variant="outline" size="xs" className="rounded-lg text-xs">Flag for Review</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Pending Loan Approvals list (Interactive Container) */}
      <DirectorActions initialPendingLoans={parsedPendingLoans} />
      
    </div>
  )
}
