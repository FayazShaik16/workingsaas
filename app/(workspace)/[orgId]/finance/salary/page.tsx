import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Wallet, CheckCircle2, AlertTriangle, ArrowUpRight, DollarSign } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function FinanceSalaryPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("FINANCE_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch all staff in org with progress
  const { data: users } = await supabase
    .from("users")
    .select(`
      id,
      name,
      email,
      progress_percentage,
      status,
      org_units(name)
    `)
    .eq("organization_id", orgId)
    .order("progress_percentage", { ascending: false })

  const { data: salaryWallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("organization_id", orgId)
    .eq("purpose", "SALARY_POOL")
    .maybeSingle()

  const eligibleUsers = (users || []).filter((u: any) => Number(u.progress_percentage || 0) >= 85)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Salary Release Execution</h1>
          <p className="text-muted-foreground mt-1">
            Automated token-backed payroll disbursement governed by verified work progress
          </p>
        </div>
        <Button size="lg" className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <DollarSign className="h-5 w-5" /> Execute Batch Payout
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salary Pool Liquidity</CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Number(salaryWallet?.balance || 0).toLocaleString()} WORK</div>
            <p className="text-xs text-muted-foreground mt-1">Treasury reserves allocated</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Eligible Employees</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{eligibleUsers.length} / {users?.length || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">&ge;85% Completed Milestones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Blocked Disbursals</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-500">{(users?.length || 0) - eligibleUsers.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Under verification threshold</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Payroll Eligibility Queue</CardTitle>
          <CardDescription>Individual release verification state</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Milestone Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users || []).map((u: any) => {
                const isEligible = Number(u.progress_percentage || 0) >= 85
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      <div>{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>{u.org_units?.name || "General"}</TableCell>
                    <TableCell>
                      <span className="font-mono text-sm font-semibold">{u.progress_percentage || 0}%</span>
                    </TableCell>
                    <TableCell>
                      {isEligible ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Ready for Release</Badge>
                      ) : (
                        <Badge variant="destructive">Blocked (&lt;85%)</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant={isEligible ? "default" : "outline"} disabled={!isEligible}>
                        {isEligible ? "Disburse" : "Hold"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
