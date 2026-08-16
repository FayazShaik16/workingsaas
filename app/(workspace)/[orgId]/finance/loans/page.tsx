import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Coins, CheckCircle2, AlertCircle } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function FinanceLoansPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("FINANCE_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  const { data: loans } = await supabase
    .from("loan_requests")
    .select(`
      id,
      amount,
      reason,
      status,
      created_at,
      users:borrower_user_id(name, email)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Treasury Loan Portfolio</h1>
        <p className="text-muted-foreground mt-1">
          Financial ledger tracking employee advance disbursements, interest schedules, and repayments
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" />
            Active Advances & Disbursals
          </CardTitle>
          <CardDescription>Comprehensive emergency liquidity records</CardDescription>
        </CardHeader>
        <CardContent>
          {(!loans || loans.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No loan records found in this organization.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower</TableHead>
                  <TableHead>Principal Amount</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Issued Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l: any) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">
                      <div>{l.users?.name || "Staff Member"}</div>
                      <div className="text-xs text-muted-foreground">{l.users?.email}</div>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">{Number(l.amount).toLocaleString()} WORK</TableCell>
                    <TableCell className="text-sm">{l.reason || "General Advance"}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{l.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(l.created_at).toLocaleDateString()}
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
