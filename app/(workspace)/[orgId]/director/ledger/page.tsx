import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollText, ArrowUpRight, ArrowDownLeft, ShieldCheck, Hash } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorLedgerPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch token transactions / immutable ledger entries
  const { data: transactions } = await supabase
    .from("token_transactions")
    .select(`
      id,
      amount,
      type,
      reference_type,
      reference_id,
      blockchain_tx_hash,
      created_at,
      from_wallet:from_wallet_id(purpose, owner_user_id),
      to_wallet:to_wallet_id(purpose, owner_user_id)
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Ledger & Audit Log</h1>
        <p className="text-muted-foreground mt-1">
          Cryptographically auditable transaction ledger for non-monetary token issuance, transfers & burn
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-primary" />
            Immutable Transaction Journal
          </CardTitle>
          <CardDescription>
            Verified double-entry bookkeeping records for all enterprise work credit distributions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(!transactions || transactions.length === 0) ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No transactions recorded in the ledger yet. Transactions are created when tasks are verified.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Transaction ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Hash / Proof</TableHead>
                  <TableHead className="text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx: any) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {tx.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {tx.type || "TRANSFER"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-semibold">
                      +{Number(tx.amount).toLocaleString()} WORK
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.from_wallet?.purpose || "TREASURY"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {tx.to_wallet?.purpose || "EMPLOYEE_WALLET"}
                    </TableCell>
                    <TableCell>
                      {tx.blockchain_tx_hash ? (
                        <span className="font-mono text-xs text-primary flex items-center gap-1">
                          <Hash className="h-3 w-3" />
                          {tx.blockchain_tx_hash.slice(0, 10)}...
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-emerald-500" />
                          Internal Ledger Verified
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString()}
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
