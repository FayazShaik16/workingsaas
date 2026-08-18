"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ScrollText,
  ShieldCheck,
  Hash,
  Coins,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Filter,
  CheckCircle2,
  Lock,
  Layers,
  Copy,
  Check,
} from "lucide-react"

export interface LedgerTransaction {
  id: string
  amount: number
  type: string
  status?: string
  blockchain_tx_hash: string | null
  created_at: string
  from_wallet_label: string
  to_wallet_label: string
  faculty_name?: string
}

interface DirectorLedgerAuditProps {
  orgId: string
  transactions: LedgerTransaction[]
}

export function DirectorLedgerAudit({ orgId, transactions }: DirectorLedgerAuditProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState("ALL")
  const [inspectedTx, setInspectedTx] = useState<LedgerTransaction | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter !== "ALL" && tx.type !== typeFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchId = tx.id.toLowerCase().includes(q)
      const matchHash = tx.blockchain_tx_hash?.toLowerCase().includes(q)
      const matchFaculty = tx.faculty_name?.toLowerCase().includes(q)
      const matchFrom = tx.from_wallet_label.toLowerCase().includes(q)
      const matchTo = tx.to_wallet_label.toLowerCase().includes(q)
      if (!matchId && !matchHash && !matchFaculty && !matchFrom && !matchTo) return false
    }
    return true
  })

  const totalVolume = transactions.reduce((sum, t) => sum + t.amount, 0)
  const rewardVolume = transactions
    .filter((t) => t.type === "TASK_REWARD" || t.type === "MINT")
    .reduce((sum, t) => sum + t.amount, 0)
  const payoutVolume = transactions
    .filter((t) => t.type === "SALARY_PAYOUT" || t.type === "BATCH_REVERSAL")
    .reduce((sum, t) => sum + t.amount, 0)

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "TASK_REWARD":
      case "MINT":
        return (
          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
            Task Reward
          </Badge>
        )
      case "SALARY_PAYOUT":
      case "BATCH_REVERSAL":
        return (
          <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 text-[10px] font-bold">
            Batch Reversal
          </Badge>
        )
      case "LOAN_ISSUE":
        return (
          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
            Loan Advance
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-mono">
            {type}
          </Badge>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Ledger Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Ledger Volume
            </CardTitle>
            <Coins className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground font-mono">
              {totalVolume.toLocaleString()} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Non-monetary audit throughput</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Earned / Minted
            </CardTitle>
            <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              +{rewardVolume.toLocaleString()} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Verified work milestones</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Swept / Reversed
            </CardTitle>
            <ArrowUpRight className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-purple-600 dark:text-purple-400 font-mono">
              {payoutVolume.toLocaleString()} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Returned on salary release</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Ledger Events
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 font-mono">
              {transactions.length} Events
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Immutable double-entry rows</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Journal Card */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-3 border-b border-muted/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <ScrollText className="h-5 w-5 text-primary" />
              Cryptographic Transaction Journal
            </CardTitle>
            <CardDescription className="text-xs">
              Immutable double-entry log of all capability token mints, peer-transfers, loan advances, and salary sweeps.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
              <Lock className="h-3 w-3 mr-1 text-emerald-500" /> SHA-256 Audit Anchor
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="p-4 border-b border-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by Tx ID, hash, wallet, faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs rounded-xl h-8"
              />
            </div>

            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="rounded-xl text-xs h-8 min-w-36 font-semibold">
                  <SelectValue placeholder="Event Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Event Types</SelectItem>
                  <SelectItem value="TASK_REWARD">Task Rewards</SelectItem>
                  <SelectItem value="SALARY_PAYOUT">Salary Batch Reversals</SelectItem>
                  <SelectItem value="LOAN_ISSUE">Loan Advances</SelectItem>
                  <SelectItem value="TRANSFER">Direct Transfers</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm font-light space-y-2">
              <ScrollText className="h-8 w-8 mx-auto opacity-30" />
              <p className="font-bold text-foreground">No Ledger Entries Found</p>
              <p className="text-xs">Try adjusting your search criteria or event type filter.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="text-xs font-bold">Transaction Hash / ID</TableHead>
                  <TableHead className="text-xs font-bold">Event Type</TableHead>
                  <TableHead className="text-xs font-bold">Amount</TableHead>
                  <TableHead className="text-xs font-bold">From Source</TableHead>
                  <TableHead className="text-xs font-bold">To Destination</TableHead>
                  <TableHead className="text-xs font-bold">Cryptographic Anchor</TableHead>
                  <TableHead className="text-xs font-bold text-right">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-muted/20 text-xs">
                    <TableCell className="font-mono">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setInspectedTx(tx)}
                          className="font-bold text-primary hover:underline"
                        >
                          {tx.id.slice(0, 8)}...
                        </button>
                        <button
                          onClick={() => handleCopy(tx.id, tx.id)}
                          className="text-muted-foreground hover:text-foreground ml-1"
                        >
                          {copiedId === tx.id ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(tx.type)}</TableCell>
                    <TableCell>
                      <span
                        className={`font-mono font-bold ${
                          tx.type === "SALARY_PAYOUT" || tx.type === "BATCH_REVERSAL"
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {tx.type === "SALARY_PAYOUT" || tx.type === "BATCH_REVERSAL" ? "-" : "+"}
                        {tx.amount.toLocaleString()} WORK
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {tx.from_wallet_label}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="font-semibold text-foreground">{tx.to_wallet_label}</span>
                      {tx.faculty_name && (
                        <div className="text-[10px] text-muted-foreground">{tx.faculty_name}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {tx.blockchain_tx_hash ? (
                        <span className="font-mono text-[11px] text-primary flex items-center gap-1 bg-primary/5 px-2 py-0.5 rounded border border-primary/20 max-w-xs truncate">
                          <Hash className="h-3 w-3 shrink-0" />
                          {tx.blockchain_tx_hash.slice(0, 12)}...
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Internal Chain
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-[11px] text-muted-foreground">
                      {new Date(tx.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Transaction Detail Inspector Modal */}
      <Dialog open={!!inspectedTx} onOpenChange={() => setInspectedTx(null)}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <ScrollText className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">Ledger Proof Inspector</DialogTitle>
                <DialogDescription className="text-xs font-mono">
                  Tx ID: {inspectedTx?.id}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {inspectedTx && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3.5 rounded-xl border border-muted/80 bg-muted/20 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Event Type:</span>
                  <span className="font-bold text-foreground font-mono">{inspectedTx.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Token Delta:</span>
                  <span className="font-bold text-emerald-600 font-mono text-sm">
                    {inspectedTx.amount} WORK
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">From Vault:</span>
                  <span className="font-mono text-foreground">{inspectedTx.from_wallet_label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">To Vault:</span>
                  <span className="font-mono text-foreground">{inspectedTx.to_wallet_label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Block Timestamp:</span>
                  <span className="font-mono text-muted-foreground">
                    {new Date(inspectedTx.created_at).toISOString()}
                  </span>
                </div>
              </div>

              {inspectedTx.blockchain_tx_hash && (
                <div className="p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary block">
                    Cryptographic Audit Hash
                  </span>
                  <p className="font-mono text-[11px] text-foreground break-all">
                    {inspectedTx.blockchain_tx_hash}
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => setInspectedTx(null)} className="rounded-xl text-xs">
              Close Inspector
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
