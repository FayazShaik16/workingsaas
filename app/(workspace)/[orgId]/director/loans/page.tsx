import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CreditCard, Check, X, Clock, AlertCircle, Coins } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorLoansPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch loan requests / emergency credit requests
  const { data: loanRequests } = await supabase
    .from("loan_requests")
    .select(`
      id,
      amount,
      reason,
      status,
      created_at,
      repayment_terms,
      users:borrower_user_id(
        id,
        name,
        email,
        progress_percentage,
        org_units(name)
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  // Fetch loan pool wallet balance
  const { data: loanWallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("organization_id", orgId)
    .eq("purpose", "LOAN_POOL")
    .maybeSingle()

  const poolBalance = Number(loanWallet?.balance || 0)
  const pendingRequests = (loanRequests || []).filter((l: any) => l.status === "PENDING")
  const totalRequested = pendingRequests.reduce((sum: number, l: any) => sum + Number(l.amount || 0), 0)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Loan & Emergency Credit Approvals</h1>
        <p className="text-muted-foreground mt-1">
          Review employee credit advances against verified token balance & future salary eligibility
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Emergency Loan Pool</CardTitle>
            <Coins className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{poolBalance.toLocaleString()} WORK</div>
            <p className="text-xs text-muted-foreground mt-1">Available treasury liquidity</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending Requests</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingRequests.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting executive decision</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Value Requested</CardTitle>
            <CreditCard className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequested.toLocaleString()} WORK</div>
            <p className="text-xs text-muted-foreground mt-1">Pending approval pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* Loan Requests Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Credit Applications
          </CardTitle>
          <CardDescription>Employee loan applications and collateral verification</CardDescription>
        </CardHeader>
        <CardContent>
          {(!loanRequests || loanRequests.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No active loan or credit advance requests at this time.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Work Progress</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loanRequests.map((req: any) => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium">
                      <div>{req.users?.name || "Staff Member"}</div>
                      <div className="text-xs text-muted-foreground">{req.users?.email}</div>
                    </TableCell>
                    <TableCell>{req.users?.org_units?.name || "General"}</TableCell>
                    <TableCell className="font-mono font-semibold">{Number(req.amount).toLocaleString()} WORK</TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold">{req.users?.progress_percentage || 0}%</span>
                    </TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{req.reason || "General Advance"}</TableCell>
                    <TableCell>
                      {req.status === "PENDING" ? (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">Pending</Badge>
                      ) : req.status === "APPROVED" ? (
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Approved</Badge>
                      ) : (
                        <Badge variant="destructive">Rejected</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="text-emerald-500 hover:text-emerald-600 gap-1">
                            <Check className="h-4 w-4" /> Approve
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive gap-1">
                            <X className="h-4 w-4" /> Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Completed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
