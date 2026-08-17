"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Wallet,
  CheckCircle2,
  AlertTriangle,
  Coins,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Building2,
  Loader2,
  Sparkles,
  RefreshCw,
  Search,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface FinanceFacultyMember {
  id: string
  name: string
  email: string
  progress_percentage: number
  target_credits: number
  wallet_balance: number
  org_unit_name: string
  status: string
  reversed?: boolean
}

interface FinanceSalaryConsoleProps {
  orgId: string
  salaryPoolBalance: number
  initialMembers: FinanceFacultyMember[]
}

export function FinanceSalaryConsole({
  orgId,
  salaryPoolBalance,
  initialMembers,
}: FinanceSalaryConsoleProps) {
  const router = useRouter()

  const [members, setMembers] = useState<FinanceFacultyMember[]>(initialMembers)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isReversing, setIsReversing] = useState(false)
  const [confirmModalOpen, setConfirmModalOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [feedback, setFeedback] = useState<{
    type: "success" | "error"
    text: string
    txHash?: string
  } | null>(null)

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q) || m.org_unit_name.toLowerCase().includes(q)
  })

  const eligibleMembers = filteredMembers.filter((m) => m.progress_percentage >= 85 && m.wallet_balance > 0)
  const totalCirculatingTokens = members.reduce((sum, m) => sum + m.wallet_balance, 0)
  const eligibleTokensToSweep = eligibleMembers.reduce((sum, m) => sum + m.wallet_balance, 0)
  const eligibleCount = members.filter((m) => m.progress_percentage >= 85).length
  const totalCount = members.length

  const handleSelectAllEligible = (checked: boolean) => {
    if (checked) {
      setSelectedIds(eligibleMembers.map((m) => m.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleExecuteBatchReversal = async (targetMemberIds: string[]) => {
    if (targetMemberIds.length === 0) return

    setIsReversing(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/finance/batch-reverse-salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: targetMemberIds,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to execute batch reversal")
      }

      setMembers((prev) =>
        prev.map((m) =>
          targetMemberIds.includes(m.id)
            ? { ...m, wallet_balance: 0, reversed: true }
            : m
        )
      )

      setSelectedIds((prev) => prev.filter((id) => !targetMemberIds.includes(id)))
      setConfirmModalOpen(false)

      setFeedback({
        type: "success",
        text: data.message || `Batch Reversal complete for ${targetMemberIds.length} faculty members.`,
        txHash: data.batchTxHash,
      })

      router.refresh()
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "An unexpected error occurred during batch reversal.",
      })
    } finally {
      setIsReversing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Treasury Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Director SALARY_POOL
            </CardTitle>
            <Wallet className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {salaryPoolBalance.toLocaleString()} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Treasury reserve balance</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Eligible Faculty
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground font-mono">
              {eligibleCount} / {totalCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">≥85% Cryptographic Threshold</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Circulating Tokens
            </CardTitle>
            <Coins className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {totalCirculatingTokens.toFixed(1)} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Personal wallets awaiting sweep</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Blocked Disbursals
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-destructive font-mono">
              {totalCount - eligibleCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">&lt;85% Deficit (On Hold)</p>
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold space-y-1 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          <p>{feedback.text}</p>
          {feedback.txHash && (
            <p className="font-mono text-[10px] text-muted-foreground">
              Audit Hash: {feedback.txHash}
            </p>
          )}
        </div>
      )}

      {/* Main Table Matrix */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-3 border-b border-muted/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payroll Authorization & Batch Reversal Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Live snapshot of faculty claim wallets. Executing batch reversal returns capability tokens to SALARY_POOL upon bank salary release.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmModalOpen(true)}
              disabled={eligibleMembers.length === 0 || isReversing}
              className="rounded-xl text-xs h-8 font-semibold text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 shadow-xs"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              1-Click Batch Reversal ({eligibleMembers.length} Eligible)
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="p-4 border-b border-muted/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search by faculty, email, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs rounded-xl h-8"
              />
            </div>

            <div className="text-xs text-muted-foreground font-mono">
              Ready to Sweep: <strong className="text-foreground font-bold">{eligibleTokensToSweep.toFixed(1)} WORK</strong>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-light">
              No faculty records match your criteria.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        eligibleMembers.length > 0 &&
                        eligibleMembers.every((m) => selectedIds.includes(m.id))
                      }
                      onChange={(e) => handleSelectAllEligible(e.target.checked)}
                      className="rounded h-3.5 w-3.5 text-primary"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                  <TableHead className="text-xs font-bold">Department</TableHead>
                  <TableHead className="text-xs font-bold">Milestone Progress</TableHead>
                  <TableHead className="text-xs font-bold">Personal Wallet</TableHead>
                  <TableHead className="text-xs font-bold">Payroll Authorization</TableHead>
                  <TableHead className="text-xs font-bold text-right">Reversal Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((m) => {
                  const isEligible = m.progress_percentage >= 85
                  const isSelected = selectedIds.includes(m.id)

                  return (
                    <TableRow key={m.id} className="hover:bg-muted/20 text-xs">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isEligible || m.wallet_balance === 0}
                          onChange={() => handleToggleMember(m.id)}
                          className="rounded h-3.5 w-3.5 text-primary disabled:opacity-30"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="font-bold text-foreground">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{m.email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          <Building2 className="h-2.5 w-2.5 mr-1 text-primary/70" />
                          {m.org_unit_name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-full ${
                                isEligible ? "bg-emerald-500" : "bg-amber-500"
                              }`}
                              style={{ width: `${m.progress_percentage}%` }}
                            />
                          </div>
                          <span className="font-mono font-bold text-xs">{m.progress_percentage}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-bold text-foreground">
                          {m.wallet_balance.toFixed(1)} WORK
                        </span>
                      </TableCell>
                      <TableCell>
                        {m.reversed ? (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                            ✓ Payout Settled
                          </Badge>
                        ) : isEligible ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Ready for Release
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Blocked (&lt;85%)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.reversed || m.wallet_balance === 0 ? (
                          <span className="text-[11px] text-muted-foreground italic">Settled</span>
                        ) : isEligible ? (
                          <Button
                            size="xs"
                            onClick={() => handleExecuteBatchReversal([m.id])}
                            disabled={isReversing}
                            className="rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                          >
                            Sweep ({m.wallet_balance.toFixed(1)})
                          </Button>
                        ) : (
                          <span className="text-[11px] text-destructive font-semibold">Hold Payout</span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Batch Reversal Modal Confirmation */}
      <Dialog open={confirmModalOpen} onOpenChange={setConfirmModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <RefreshCw className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">Execute Atomic Batch Reversal</DialogTitle>
                <DialogDescription className="text-xs">
                  Settle monthly payroll authorization and sweep tokens to SALARY_POOL
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="p-4 rounded-xl border border-muted/80 bg-muted/20 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Eligible Faculty Count:</span>
                <span className="font-bold text-foreground font-mono">{eligibleMembers.length} Members</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tokens to Return:</span>
                <span className="font-bold text-emerald-600 font-mono text-sm">+{eligibleTokensToSweep.toFixed(1)} WORK</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Destination Vault:</span>
                <span className="font-bold text-foreground font-mono">Director SALARY_POOL</span>
              </div>
            </div>

            <p className="text-muted-foreground leading-relaxed text-[11px]">
              This operation executes an atomic sweep of capability tokens from all eligible faculty personal wallets back into the treasury SALARY_POOL. It records an immutable batch reversal transaction in the ledger while clearing wallets for next month&apos;s academic cycle.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmModalOpen(false)}
              disabled={isReversing}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() =>
                handleExecuteBatchReversal(eligibleMembers.map((m) => m.id))
              }
              disabled={isReversing}
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {isReversing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Sweeping Tokens...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Confirm Atomic Sweep ({eligibleTokensToSweep.toFixed(1)} WORK)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
