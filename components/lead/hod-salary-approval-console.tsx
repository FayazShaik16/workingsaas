"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Users,
  Loader2,
  Check,
  X,
  ArrowRight,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface DepartmentSalaryRequestItem {
  id: string
  userId: string
  userName: string
  userEmail: string
  designation: string
  earnedCredits: number
  targetCredits: number
  progressPercentage: number
  isEligible: boolean
  status: string
  requestedAt: string
}

interface HODSalaryApprovalConsoleProps {
  orgId: string
  deptName: string
  requests: DepartmentSalaryRequestItem[]
}

export function HODSalaryApprovalConsole({
  orgId,
  deptName,
  requests: initialRequests,
}: HODSalaryApprovalConsoleProps) {
  const router = useRouter()
  const [requests, setRequests] = useState<DepartmentSalaryRequestItem[]>(initialRequests)

  // Endorsement State
  const [selectedReq, setSelectedReq] = useState<DepartmentSalaryRequestItem | null>(null)
  const [endorseNotes, setEndorseNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleOpenEndorse = (req: DepartmentSalaryRequestItem) => {
    setSelectedReq(req)
    setEndorseNotes("")
    setFeedbackMsg(null)
  }

  const handleSubmitEndorsement = async (action: "ENDORSE" | "REJECT") => {
    if (!selectedReq) return
    setIsSubmitting(true)
    setFeedbackMsg(null)

    try {
      const res = await fetch("/api/lead/endorse-salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: selectedReq.id,
          action,
          notes: endorseNotes || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to process endorsement.")

      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedReq.id
            ? { ...r, status: action === "ENDORSE" ? "HOD_APPROVED" : "HOD_REJECTED" }
            : r
        )
      )

      setFeedbackMsg({
        type: "success",
        text: `Salary request ${action === "ENDORSE" ? "endorsed and routed to Finance" : "returned for revision"}.`,
      })

      setTimeout(() => {
        setSelectedReq(null)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setFeedbackMsg({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Endorsements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {requests.filter((r) => r.status === "PENDING_HOD" || r.status === "PENDING_LEAD").length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Faculty salary requests waiting review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              85% Threshold Met
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {requests.filter((r) => r.isEligible).length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Eligible for automated release</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Department Scope
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground truncate">{deptName}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Isolated department authorization</p>
          </CardContent>
        </Card>
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Faculty Salary Endorsement Queue ({requests.length})
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Authorize monthly salary claims for department faculty based on recorded work credits.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {requests.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <CreditCard className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No Salary Requests Submitted</p>
              <p className="text-muted-foreground">
                Faculty can submit salary claims on or after Day 26 when their monthly progress reaches the 85% threshold.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                    <th className="py-3 px-4 font-semibold">Faculty Member</th>
                    <th className="py-3 px-4 font-semibold">Designation</th>
                    <th className="py-3 px-4 font-semibold">Credits Earned / Target</th>
                    <th className="py-3 px-4 font-semibold">Progress %</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {requests.map((r) => {
                    const isPending = r.status === "PENDING_HOD" || r.status === "PENDING_LEAD"

                    return (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          {r.userName}
                          <span className="block text-[11px] text-muted-foreground font-mono">{r.userEmail}</span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{r.designation}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-foreground">
                          {r.earnedCredits.toFixed(1)} / {r.targetCredits.toFixed(1)} cr
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-primary">
                          {r.progressPercentage.toFixed(0)}%
                        </td>
                        <td className="py-3 px-4">
                          {r.status === "HOD_APPROVED" || r.status === "APPROVED_LEAD" ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                              Endorsed
                            </Badge>
                          ) : isPending ? (
                            <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/40">
                              Pending Review
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {r.status}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isPending ? (
                            <Button
                              size="sm"
                              onClick={() => handleOpenEndorse(r)}
                              className="text-xs h-7 gap-1"
                            >
                              <span>Review Claim</span>
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-mono">Processed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Endorsement Dialog */}
      <Dialog open={Boolean(selectedReq)} onOpenChange={(open) => !open && setSelectedReq(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedReq && (
            <div>
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  Endorse Monthly Salary Claim
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Verify that {selectedReq.userName} has completed their allocated work and meets the 85% credit authorization threshold.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                {feedbackMsg && (
                  <div
                    className={`p-3 rounded-lg border flex items-center gap-2 ${
                      feedbackMsg.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}
                  >
                    {feedbackMsg.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{feedbackMsg.text}</span>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/40 border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground">{selectedReq.userName}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {selectedReq.progressPercentage.toFixed(0)}% Progress
                    </Badge>
                  </div>
                  <div className="flex justify-between text-muted-foreground font-mono text-[11px]">
                    <span>Earned: {selectedReq.earnedCredits.toFixed(1)} cr</span>
                    <span>Target: {selectedReq.targetCredits.toFixed(1)} cr</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">HOD Endorsement Note (Optional)</label>
                  <Textarea
                    placeholder="Optional notes for Finance settlement..."
                    value={endorseNotes}
                    onChange={(e) => setEndorseNotes(e.target.value)}
                    className="text-xs min-h-[70px]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSubmitEndorsement("REJECT")}
                  disabled={isSubmitting}
                  className="text-xs text-destructive hover:text-destructive"
                >
                  Return Claim
                </Button>
                <Button
                  type="button"
                  onClick={() => handleSubmitEndorsement("ENDORSE")}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Endorse for Release</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
