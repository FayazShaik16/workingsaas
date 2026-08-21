import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTablePrimitive } from "@/components/shared/data-table-primitive"
import { ColumnDef } from "@tanstack/react-table"
import { formatNumber } from "@/lib/utils"

type Wallet = {
  id: string
  owner_user_id: string
  purpose: string
  balance: string
  is_locked: boolean
  users: { name: string; email: string } | null
}

export default async function FinanceDashboardPage() {
  const user = await requireAuth()
  await requireScope("FINANCE_ADMIN")

  const supabase = await createClient()

  // Get organization salary pool and loan pool
  const { data: wallets } = await (supabase as any)
    .from("wallets")
    .select("id, owner_user_id, purpose, balance, is_locked, users(name, email)")
    .eq("organization_id", user.organizationId)
    .in("purpose", ["SALARY_POOL", "LOAN_POOL"])
    .order("purpose", { ascending: true })

  // Get total transaction volume
  const { data: transactions } = await (supabase as any)
    .from("token_transactions")
    .select("amount, type, status")
    .eq("organization_id", user.organizationId)
    .eq("status", "CONFIRMED")

  const totalSalaryReleased = (transactions as any[])
    ?.filter((t: any) => t.type === "SALARY_RELEASE")
    ?.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0

  const totalLoansIssued = (transactions as any[])
    ?.filter((t: any) => t.type === "LOAN_DISBURSE")
    ?.reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0) || 0

  const salaryPool = (wallets as any[])?.find((w: any) => w.purpose === "SALARY_POOL")
  const loanPool = (wallets as any[])?.find((w: any) => w.purpose === "LOAN_POOL")

  const columns: ColumnDef<Wallet>[] = [
    {
      accessorKey: "purpose",
      header: "Wallet Purpose",
      cell: ({ row }) => (
        <Badge variant={row.original.purpose === "SALARY_POOL" ? "default" : "outline"}>
          {row.original.purpose}
        </Badge>
      ),
    },
    {
      accessorKey: "balance",
      header: "Balance",
      cell: ({ row }) => (
        <span className="font-mono font-semibold">{formatNumber(parseFloat(row.original.balance))}</span>
      ),
    },
    {
      accessorKey: "is_locked",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.is_locked ? "destructive" : "secondary"}>
          {row.original.is_locked ? "LOCKED" : "ACTIVE"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          asChild
        >
          <a href={`/finance/wallet/${row.original.id}`}>Manage</a>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage wallets, salaries, and loan disbursements</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salary Pool Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(parseFloat(salaryPool?.balance || "0"))}</div>
            <p className="text-xs text-muted-foreground mt-1">Tokens available for salary</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Loan Pool Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(parseFloat(loanPool?.balance || "0"))}</div>
            <p className="text-xs text-muted-foreground mt-1">Tokens available for loans</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Salaries Released</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatNumber(totalSalaryReleased)}</div>
            <p className="text-xs text-muted-foreground mt-1">This month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Loans Issued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{formatNumber(totalLoansIssued)}</div>
            <p className="text-xs text-muted-foreground mt-1">Outstanding</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organization Wallets</CardTitle>
          <CardDescription>Manage salary and loan pool accounts</CardDescription>
        </CardHeader>
        <CardContent>
          {wallets && wallets.length > 0 ? (
            <DataTablePrimitive
              columns={columns}
              data={(wallets || []) as any}
              enableSearch={true}
              searchPlaceholder="Search wallets..."
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No wallets configured. Set up pools in organization settings.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild>
          <a href="/finance/release-salary">Release Salary</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/finance/loan-management">Manage Loans</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/finance/reports">Financial Reports</a>
        </Button>
      </div>
    </div>
  )
}
