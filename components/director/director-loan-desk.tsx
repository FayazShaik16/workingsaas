"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  CreditCard,
  Coins,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  ShieldCheck,
  Building2,
  Loader2,
  Sparkles,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface LoanRequestItem {
  id: string
  amount: number
  reason: string
  status: string
  created_at: string
  applicant: {
    id: string
    name: string
    email: string
    progress_percentage: number
    org_unit_name: string
  } | null
}

interface DirectorLoanDeskProps {
  orgId: string
  directorUserId: string
  loanPoolBalance: number
  initialRequests: LoanRequestItem[]
}

export function DirectorLoanDesk({
  orgId,
  directorUserId,
  loanPoolBalance,
  initialRequests,
}: DirectorLoanDeskProps) {
  const router = useRouter()

  const [requests, setRequests] = useState<LoanRequestItem[]>(initialRequests)
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [rejectDialogItem, setRejectDialogItem] = useState<LoanRequestItem | null>(null)

  const pendingRequests = requests.filter((r) => r.status === "PENDING")
  const totalRequested = pendingRequests.reduce((sum, r) => sum + r.amount, 0)
  const activeDebts = requests.filter((r) => r.status === "APPROVED" || r.status === "ACTIVE")

  const handleDecision = async (loanId: string, action: "APPROVE" | "REJECT") => {
    setIsProcessing(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/director/approve-loan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loanRequestId: loanId,
          action,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to process loan decision")
      }

      setRequests((prev) =>
        prev.map((r) =>
          r.id === loanId ? { ...r, status: action === "APPROVE" ? "APPROVED" : "REJECTED" } : r
        )
      )

      setFeedback({
        type: "success",
        text: data.message || `Loan ${action === "APPROVE" ? "approved" : "rejected"} successfully.`,
      })

      if (rejectDialogItem) setRejectDialogItem(null)
      router.refresh()
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Emergency Loan Pool
            </CardTitle>
            <Coins className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {loanPoolBalance.toLocaleString()} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Available treasury liquidity</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending Decisions
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {pendingRequests.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Awaiting executive authorization</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Advance Demand
            </CardTitle>
            <CreditCard className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 font-mono">
              {totalRequested.toLocaleString()} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Total pending allocation</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Debt Portfolio
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground font-mono">
              {activeDebts.length} Loans
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Repayment in future cycles</p>
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Main Table Card */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-3 border-b border-muted/40">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Executive Work-Loan Authorization Desk
          </CardTitle>
          <CardDescription className="text-xs">
            Review deficit-bridging requests. Approved advances debit the LOAN_POOL and disburse immediate token liquidity to the faculty PERSONAL wallet.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-sm font-light space-y-2">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-70" />
              <p className="font-bold text-foreground">No Loan Applications</p>
              <p className="text-xs">All faculty members are currently within standard credit quotas.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="text-xs font-bold">Applicant / Department</TableHead>
                  <TableHead className="text-xs font-bold">Requested Advance</TableHead>
                  <TableHead className="text-xs font-bold">Current Progress</TableHead>
                  <TableHead className="text-xs font-bold">Reason & Justification</TableHead>
                  <TableHead className="text-xs font-bold">Status</TableHead>
                  <TableHead className="text-xs font-bold text-right">Executive Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/20 text-xs">
                    <TableCell className="font-medium">
                      <div className="font-bold text-foreground">{req.applicant?.name || "Staff Member"}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{req.applicant?.email}</div>
                      <Badge variant="outline" className="text-[10px] mt-0.5">
                        <Building2 className="h-2.5 w-2.5 mr-1" />
                        {req.applicant?.org_unit_name || "General"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono font-bold text-sm text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                        +{req.amount.toLocaleString()} WORK
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="font-mono text-xs font-semibold"
                      >
                        {req.applicant?.progress_percentage || 0}%
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <p className="text-xs text-foreground leading-relaxed line-clamp-2">
                        {req.reason || "Monthly target deficit bridge."}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Submitted: {new Date(req.created_at).toLocaleDateString()}
                      </span>
                    </TableCell>
                    <TableCell>
                      {req.status === "PENDING" ? (
                        <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
                          Pending Approval
                        </Badge>
                      ) : req.status === "APPROVED" || req.status === "ACTIVE" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                          ✓ Disbursed
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          Rejected
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {req.status === "PENDING" ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => handleDecision(req.id, "REJECT")}
                            disabled={isProcessing}
                            className="rounded-lg h-7 px-2 text-destructive border-destructive/20 hover:bg-destructive/10 text-xs"
                          >
                            Reject
                          </Button>
                          <Button
                            size="xs"
                            onClick={() => handleDecision(req.id, "APPROVE")}
                            disabled={isProcessing}
                            className="rounded-lg h-7 px-3 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs text-xs"
                          >
                            {isProcessing ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Coins className="h-3 w-3 mr-1" />
                            )}
                            Disburse ({req.amount} WORK)
                          </Button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">Processed</span>
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
