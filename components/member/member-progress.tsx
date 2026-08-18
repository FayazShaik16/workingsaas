"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Coins,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  HelpCircle,
  Loader2,
  Sparkles,
  Wallet,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface MemberProgressProps {
  earnedTokens: number
  monthlyTarget: number
  activeLoanAmount: number
  loanDueDate: string | null
  orgId?: string
  userId?: string
}

export function MemberProgress({
  earnedTokens,
  monthlyTarget,
  activeLoanAmount,
  loanDueDate,
  orgId,
  userId,
}: MemberProgressProps) {
  const router = useRouter()

  const safeTarget = Number(monthlyTarget) > 0 ? Number(monthlyTarget) : 50
  const progressPercent = Math.min(100, Math.round((earnedTokens / safeTarget) * 100))
  const target85Percent = Math.ceil(safeTarget * 0.85)
  const shortfall85 = Math.max(0, target85Percent - earnedTokens)
  const isEligibleForSalary = progressPercent >= 85

  // Salary Claim State
  const [claimModalOpen, setClaimModalOpen] = useState(false)
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimStatus, setClaimStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Work-Loan Request State
  const [loanModalOpen, setLoanModalOpen] = useState(false)
  const [loanAmount, setLoanAmount] = useState<string>(String(shortfall85 > 0 ? shortfall85 : 5))
  const [loanReason, setLoanReason] = useState<string>("Bridging monthly structured shortfall before payroll snapshot")
  const [isRequestingLoan, setIsRequestingLoan] = useState(false)
  const [loanStatus, setLoanStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  const handleClaimSalary = async () => {
    setIsClaiming(true)
    setClaimStatus(null)

    try {
      const response = await fetch("/api/member/claim-salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to initiate salary claim.")
      }

      setClaimStatus({
        type: "success",
        message: data.message || "Salary claim submitted to HOD approval queue.",
      })

      setTimeout(() => {
        setClaimModalOpen(false)
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setClaimStatus({
        type: "error",
        message: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsClaiming(false)
    }
  }

  const handleRequestLoan = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsRequestingLoan(true)
    setLoanStatus(null)

    try {
      const response = await fetch("/api/member/request-loan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(loanAmount),
          reason: loanReason,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit work-loan request.")
      }

      setLoanStatus({
        type: "success",
        message: data.message || "Work-loan request submitted to Director Loan Desk.",
      })

      setTimeout(() => {
        setLoanModalOpen(false)
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setLoanStatus({
        type: "error",
        message: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsRequestingLoan(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Progress Circular Card */}
      <Card className="rounded-2xl border-2 border-border bg-card/70 backdrop-blur-xs shadow-md text-center py-6">
        <CardContent className="flex flex-col items-center">
          <div className="flex items-center justify-between w-full px-2 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Monthly Merit Progress
            </span>
            <Badge
              variant={isEligibleForSalary ? "default" : "secondary"}
              className={`text-[10px] font-bold ${
                isEligibleForSalary
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
              }`}
            >
              {isEligibleForSalary ? "Eligible (≥85%)" : "Deficit (<85%)"}
            </Badge>
          </div>

          <div className="relative w-40 h-40 flex items-center justify-center my-2">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="64"
                stroke="var(--border)"
                strokeWidth="12"
                fill="transparent"
              />
              <circle
                cx="80"
                cy="80"
                r="64"
                stroke={isEligibleForSalary ? "#10b981" : "#f59e0b"}
                strokeWidth="12"
                strokeDasharray="402"
                strokeDashoffset={402 - (402 * progressPercent) / 100}
                strokeLinecap="round"
                fill="transparent"
                className="transition-all duration-500"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-3xl font-black text-foreground">{progressPercent}%</span>
              <span className="text-[10px] text-muted-foreground font-bold tracking-wider uppercase">
                {earnedTokens}/{safeTarget} Credits
              </span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2 font-medium">
            Dynamic target denominator: <strong className="text-foreground">{safeTarget} tokens</strong>
          </p>

          {/* Action Gate Conditionals */}
          <div className="w-full mt-5 space-y-2">
            {isEligibleForSalary ? (
              <Button
                onClick={() => setClaimModalOpen(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs py-5 shadow-xs flex items-center justify-center gap-2"
              >
                <ShieldCheck className="h-4 w-4" />
                Initiate My Salary Claim (≥85%)
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => setLoanModalOpen(true)}
                className="w-full border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl text-xs font-bold py-5 flex items-center justify-center gap-2"
              >
                <Coins className="h-4 w-4" /> Raise Work-Loan Request ({shortfall85} WORK Deficit)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Token Ledger Balance */}
      <Card className="rounded-2xl border-2 border-border bg-card/70 backdrop-blur-xs shadow-md">
        <CardHeader className="pb-2 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Personal Claim Ledger
            </span>
            <Badge variant="outline" className="text-[10px] font-mono font-bold">
              Non-Monetary
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <span className="text-2xl font-black text-foreground">{earnedTokens}</span>
                <span className="text-xs text-muted-foreground font-mono ml-1 font-bold">WORK</span>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] font-bold">
              {isEligibleForSalary ? "Threshold Met" : "Target: 85%"}
            </Badge>
          </div>

          <div className="text-xs space-y-2 pt-2 border-t text-muted-foreground font-medium">
            <div className="flex justify-between">
              <span>Verified Credits Earned:</span>
              <span className="font-bold text-foreground">{earnedTokens} WORK</span>
            </div>
            <div className="flex justify-between">
              <span>Monthly Target Denominator:</span>
              <span className="font-bold text-foreground">{safeTarget} WORK</span>
            </div>
            <div className="flex justify-between">
              <span>85% Salary Clearance Gate:</span>
              <span className="font-bold text-foreground">{target85Percent} WORK</span>
            </div>
            {!isEligibleForSalary && shortfall85 > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-bold pt-1 border-t">
                <span>Shortfall to Salary Gate:</span>
                <span>{shortfall85} tokens</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Work Loan Alert Card */}
      {activeLoanAmount > 0 && (
        <Card className="rounded-2xl border-l-4 border-l-destructive bg-destructive/5 border-destructive/20 p-5">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
            <div className="space-y-1 text-left">
              <h4 className="text-xs font-bold text-destructive uppercase tracking-wider">
                Active Work Loan Debt
              </h4>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                You carry an outstanding work debt of {activeLoanAmount} tokens from a previous cycle shortfall. Clear this by self-nominating for marketplace tasks.
              </p>
              <div className="flex justify-between pt-2 text-[10px] text-muted-foreground">
                <span>
                  Loan Debt: <strong className="text-destructive font-mono">{activeLoanAmount} WORK</strong>
                </span>
                <span>
                  Due Date: <strong>{loanDueDate ? new Date(loanDueDate).toLocaleDateString() : "Month End"}</strong>
                </span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Salary Claim Dialog */}
      <Dialog open={claimModalOpen} onOpenChange={setClaimModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">Initiate Monthly Salary Claim</DialogTitle>
                <DialogDescription className="text-xs">
                  Cryptographic verification confirmation
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            {claimStatus && (
              <div
                className={`p-3 rounded-xl border font-semibold ${
                  claimStatus.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {claimStatus.message}
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-muted/80 bg-muted/20 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Verified Progress:</span>
                <span className="font-bold text-emerald-600 font-mono">{progressPercent}% (≥85%)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Earned Credits:</span>
                <span className="font-bold text-foreground font-mono">{earnedTokens} / {safeTarget} WORK</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status:</span>
                <span className="font-bold text-emerald-600">Eligible for Monthly Release</span>
              </div>
            </div>

            <p className="text-muted-foreground text-[11px] leading-relaxed">
              By initiating this claim, your proof-of-work bundle is forwarded to your HOD for cryptographic signature endorsement, authorizing Finance to release your fixed salary.
            </p>
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setClaimModalOpen(false)}
              disabled={isClaiming}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleClaimSalary}
              disabled={isClaiming}
              className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {isClaiming ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Submitting Claim...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Confirm & Send to HOD
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Work-Loan Request Dialog */}
      <Dialog open={loanModalOpen} onOpenChange={setLoanModalOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Coins className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">Raise Work-Loan Request</DialogTitle>
                <DialogDescription className="text-xs">
                  Bridge your credit shortfall from the Emergency Loan Pool
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleRequestLoan} className="space-y-4 pt-2">
            {loanStatus && (
              <div
                className={`p-3 text-xs rounded-xl border font-semibold ${
                  loanStatus.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {loanStatus.message}
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs space-y-1.5">
              <div className="flex justify-between font-bold">
                <span className="text-amber-800 dark:text-amber-300">Current Progress:</span>
                <span className="font-mono">{progressPercent}%</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Shortfall to 85% Threshold:</span>
                <span className="font-bold text-foreground font-mono">{shortfall85} WORK</span>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                A work loan advance lets you qualify for this month&apos;s salary payout, creating a work obligation to be cleared in future cycles.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loanAmount" className="text-xs font-semibold">
                Requested Loan Advance (WORK)
              </Label>
              <Input
                id="loanAmount"
                type="number"
                min="1"
                max="50"
                value={loanAmount}
                onChange={(e) => setLoanAmount(e.target.value)}
                required
                disabled={isRequestingLoan}
                className="text-sm font-mono font-bold rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="loanReason" className="text-xs font-semibold">
                Reason & Context
              </Label>
              <Textarea
                id="loanReason"
                value={loanReason}
                onChange={(e) => setLoanReason(e.target.value)}
                rows={3}
                required
                disabled={isRequestingLoan}
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLoanModalOpen(false)}
                disabled={isRequestingLoan}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isRequestingLoan}
                className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
              >
                {isRequestingLoan ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <Coins className="h-3.5 w-3.5 mr-1.5" /> Submit to Director Loan Desk
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
