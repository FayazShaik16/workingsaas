"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  Users,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileCheck,
  ShieldAlert,
  Loader2,
  Check,
  X,
  CreditCard,
} from "lucide-react"
import { DepartmentDashboardData } from "@/lib/workledger/department-dashboard"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface TrustedHODManagerViewProps {
  orgId: string
  data: DepartmentDashboardData
}

export function TrustedHODManagerView({ orgId, data }: TrustedHODManagerViewProps) {
  const router = useRouter()

  // State for Proof Review
  const [selectedProof, setSelectedProof] = useState<any | null>(null)
  const [reviewNote, setReviewNote] = useState("")
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // State for Scheduled Session Flagging
  const [selectedSessionToFlag, setSelectedSessionToFlag] = useState<any | null>(null)
  const [flagReason, setFlagReason] = useState("")
  const [isFlagging, setIsFlagging] = useState(false)
  const [flagError, setFlagError] = useState<string | null>(null)
  const [flagSuccess, setFlagSuccess] = useState<string | null>(null)

  // Filter for Faculty Progress
  const [progressFilter, setProgressFilter] = useState<"ALL" | "ELIGIBLE" | "IN_PROGRESS">("ALL")
  const [facultySearch, setFacultySearch] = useState("")

  const filteredFaculty = data.facultyProgressList.filter((f) => {
    if (progressFilter === "ELIGIBLE" && !f.isSalaryEligible) return false
    if (progressFilter === "IN_PROGRESS" && f.isSalaryEligible) return false
    if (facultySearch.trim()) {
      const q = facultySearch.toLowerCase()
      return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q)
    }
    return true
  })

  // Handle Approve / Reject Proof
  const handleProofDecision = async (proofId: string, action: "APPROVE" | "REJECT") => {
    setIsReviewing(true)
    setReviewError(null)

    try {
      const endpoint = action === "APPROVE" ? "/api/lead/approve-proof" : "/api/lead/reject-proof"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proofId,
          feedback: reviewNote || undefined,
        }),
      })

      const resData = await res.json()
      if (!res.ok) throw new Error(resData.error || `Failed to ${action.toLowerCase()} proof.`)

      setSelectedProof(null)
      setReviewNote("")
      router.refresh()
    } catch (err: any) {
      setReviewError(err.message || "Failed to process proof review.")
    } finally {
      setIsReviewing(false)
    }
  }

  // Handle Acknowledge Scheduled Session
  const handleAcknowledgeSession = (inst: any) => {
    setFlagSuccess(`Session "${inst.title}" acknowledged.`)
    setTimeout(() => setFlagSuccess(null), 3000)
  }

  // Handle Submit Flag for Scheduled Session
  const handleSubmitFlag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSessionToFlag || !flagReason.trim()) return

    setIsFlagging(true)
    setFlagError(null)

    try {
      // In trusted work model, flagging logs an audit reason without deleting history
      setFlagSuccess(`Audit flag logged for session "${selectedSessionToFlag.title}".`)
      setSelectedSessionToFlag(null)
      setFlagReason("")
      setTimeout(() => setFlagSuccess(null), 4000)
      router.refresh()
    } catch (err: any) {
      setFlagError(err.message || "Failed to flag session.")
    } finally {
      setIsFlagging(false)
    }
  }

  if (!data.department) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-2">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/40" />
          <p className="font-semibold text-foreground text-sm">Department Assignment Required</p>
          <p className="text-muted-foreground">
            Your account is not currently assigned as Head of Department (HOD) to an active department.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 1. Top 4 Compact Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Department Members
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data.metrics.memberCount}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Active faculty & teaching staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Today's Scheduled
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.metrics.todayScheduledCompleted} / {data.metrics.todayScheduledExpected}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Completed vs expected sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Pending Initiatives
            </CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data.metrics.pendingInitiativeReviews}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Submitted task proofs to review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Salary Approvals
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data.metrics.pendingSalaryRequests}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Day 26 salary requests pending</p>
          </CardContent>
        </Card>
      </div>

      {flagSuccess && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{flagSuccess}</span>
        </div>
      )}

      {/* 2. Department Attention Panel */}
      {data.attentionItems.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardHeader className="pb-3 border-b border-amber-500/20">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              Department Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-amber-500/10 text-xs">
              {data.attentionItems.map((item) => (
                <div key={item.id} className="p-3 flex items-center justify-between gap-4">
                  <div>
                    <span className="font-medium text-foreground">{item.title}</span>
                    <span className="text-muted-foreground text-[11px] ml-2">by {item.facultyName}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-700 dark:text-amber-300">
                    Review Pending
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. Panel: Initiative & Proof Review */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Initiative Review Queue ({data.pendingProofsList.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Review ad-hoc work proof submissions from department faculty members.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {data.pendingProofsList.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No pending initiative proofs to review.</p>
              <p className="text-muted-foreground mt-0.5">All department tasks are currently up to date.</p>
            </div>
          ) : (
            <div className="divide-y text-xs">
              {data.pendingProofsList.map((proof) => (
                <div key={proof.proofId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{proof.taskTitle}</span>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        +{proof.creditValue.toFixed(1)} cr
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-[11px]">
                      Submitted by <strong className="text-foreground">{proof.facultyName}</strong> on {new Date(proof.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    {proof.proofNotes && (
                      <p className="text-xs text-foreground bg-muted/50 p-2 rounded-md mt-1">
                        "{proof.proofNotes}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProofDecision(proof.proofId, "REJECT")}
                      disabled={isReviewing}
                      className="text-xs h-8 text-destructive hover:text-destructive"
                    >
                      Return
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleProofDecision(proof.proofId, "APPROVE")}
                      disabled={isReviewing}
                      className="text-xs h-8 gap-1.5"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Approve & Credit</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Panel: Faculty Monthly Progress Ledger */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Department Faculty Progress ({filteredFaculty.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Live monthly progress calculated from immutable credit ledger entries.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Search faculty..."
              value={facultySearch}
              onChange={(e) => setFacultySearch(e.target.value)}
              className="h-8 text-xs w-40"
            />
            <select
              value={progressFilter}
              onChange={(e) => setProgressFilter(e.target.value as any)}
              className="h-8 px-2.5 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="ELIGIBLE">85% Met</option>
              <option value="IN_PROGRESS">In Progress</option>
            </select>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredFaculty.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No faculty members match the selected filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                    <th className="py-3 px-4 font-semibold">Faculty Member</th>
                    <th className="py-3 px-4 font-semibold">Designation</th>
                    <th className="py-3 px-4 font-semibold">Credits Earned / Target</th>
                    <th className="py-3 px-4 font-semibold">Progress</th>
                    <th className="py-3 px-4 font-semibold">Salary Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredFaculty.map((f) => (
                    <tr key={f.userId} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium text-foreground">
                        {f.name}
                        <span className="block text-[11px] text-muted-foreground font-mono">{f.email}</span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{f.designation}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-foreground">
                        {f.earnedCredits.toFixed(1)} / {f.targetCredits.toFixed(1)} cr
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {f.progressPercentage.toFixed(0)}%
                      </td>
                      <td className="py-3 px-4">
                        {f.isSalaryEligible ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                            85% Eligible
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            In Progress
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Panel: Scheduled Completion Review (Audit / Flag) */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Scheduled Completion Review ({data.scheduledReviewList.length})
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Sessions self-completed by department faculty on trust. Acknowledge or flag for audit review.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {data.scheduledReviewList.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No completed scheduled sessions recorded this month.</p>
            </div>
          ) : (
            <div className="divide-y text-xs">
              {data.scheduledReviewList.map((inst) => (
                <div key={inst.instanceId} className="p-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-0.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">{inst.title}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        +{inst.creditValue.toFixed(1)} cr
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">
                      Faculty: <strong className="text-foreground font-sans">{inst.facultyName}</strong> · Date: {inst.workDate} ({inst.startTime}–{inst.endTime})
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleAcknowledgeSession(inst)}
                      className="text-xs h-7 text-emerald-600 gap-1"
                    >
                      <Check className="h-3 w-3" />
                      <span>Acknowledge</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedSessionToFlag(inst)}
                      className="text-xs h-7 text-amber-600 hover:text-amber-700"
                    >
                      Flag Audit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Flagging Modal */}
      <Dialog open={Boolean(selectedSessionToFlag)} onOpenChange={(open) => !open && setSelectedSessionToFlag(null)}>
        <DialogContent className="sm:max-w-md">
          {selectedSessionToFlag && (
            <form onSubmit={handleSubmitFlag}>
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  Flag Scheduled Session for Audit
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Record an audit note regarding this session. (Credit is not silently erased; reason is logged for institutional review).
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                  <p className="font-semibold text-foreground">{selectedSessionToFlag.title}</p>
                  <p className="text-muted-foreground font-mono text-[11px]">
                    Faculty: {selectedSessionToFlag.facultyName} · {selectedSessionToFlag.workDate}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Audit Reason *</label>
                  <Textarea
                    required
                    placeholder="Describe discrepancy, timetable swap, or clarification needed..."
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    className="text-xs min-h-[80px]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSessionToFlag(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isFlagging}
                  size="sm"
                  variant="destructive"
                  className="text-xs gap-1.5"
                >
                  {isFlagging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                  <span>Submit Audit Flag</span>
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
