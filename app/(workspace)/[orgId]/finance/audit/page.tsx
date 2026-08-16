import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BarChart3, Hash, ShieldCheck } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function FinanceAuditPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("FINANCE_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  const { data: txs } = await supabase
    .from("token_transactions")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50)

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finance Audit & Reconciliation</h1>
        <p className="text-muted-foreground mt-1">
          Double-entry proof-of-work balance sheets and blockchain cryptographic receipts
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Financial Audit Trail
          </CardTitle>
          <CardDescription>Verified disbursements and liquidity allocations</CardDescription>
        </CardHeader>
        <CardContent>
          {(!txs || txs.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No financial transaction records found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Blockchain Proof</TableHead>
                  <TableHead className="text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{t.id.slice(0, 8)}...</TableCell>
                    <TableCell><Badge variant="outline">{t.type}</Badge></TableCell>
                    <TableCell className="font-mono font-semibold">+{Number(t.amount).toLocaleString()} WORK</TableCell>
                    <TableCell>
                      {t.blockchain_tx_hash ? (
                        <span className="font-mono text-xs text-primary flex items-center gap-1">
                          <Hash className="h-3 w-3" /> {t.blockchain_tx_hash.slice(0, 10)}...
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ShieldCheck className="h-3 w-3 text-emerald-500" /> Internal Ledger
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {new Date(t.created_at).toLocaleString()}
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
