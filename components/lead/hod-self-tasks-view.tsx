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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Lightbulb,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  FileCheck,
  TrendingUp,
  Loader2,
  Calendar,
  ExternalLink,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Search,
} from "lucide-react"
import { SelfTaskItem } from "@/lib/workledger/self-tasks"
import { useRouter } from "next/navigation"

interface HODSelfTasksViewProps {
  orgId: string
  deptName?: string
  pendingProposals: SelfTaskItem[]
  pendingVerifications: SelfTaskItem[]
  activeInProgress: SelfTaskItem[]
  completedTasks: SelfTaskItem[]
  allTasks: SelfTaskItem[]
}

export function HODSelfTasksView({
  orgId,
  deptName = "Department",
  pendingProposals: initialPendingProposals,
  pendingVerifications: initialPendingVerifications,
  activeInProgress: initialActive,
  completedTasks: initialCompleted,
  allTasks: initialAll,
}: HODSelfTasksViewProps) {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<"proposals" | "verifications" | "history">("proposals")
  const [pendingProposals, setPendingProposals] = useState<SelfTaskItem[]>(initialPendingProposals)
  const [pendingVerifications, setPendingVerifications] = useState<SelfTaskItem[]>(initialPendingVerifications)
  const [activeInProgress, setActiveInProgress] = useState<SelfTaskItem[]>(initialActive)
  const [completedTasks, setCompletedTasks] = useState<SelfTaskItem[]>(initialCompleted)
  const [allTasks, setAllTasks] = useState<SelfTaskItem[]>(initialAll)

  // Proposal Review Modal
  const [reviewingTask, setReviewingTask] = useState<SelfTaskItem | null>(null)
  const [approvedCredits, setApprovedCredits] = useState<number>(2.0)
  const [reviewComment, setReviewComment] = useState("")
  const [isReviewing, setIsReviewing] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  // Verification Modal
  const [verifyingTask, setVerifyingTask] = useState<SelfTaskItem | null>(null)
  const [verifyComment, setVerifyComment] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Handle Proposal Decision
  const handleProposalDecision = async (decision: "APPROVE" | "REJECT") => {
    if (!reviewingTask) return
    setIsReviewing(true)
    setReviewError(null)

    try {
      const res = await fetch("/api/tasks/self-tasks/review-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: reviewingTask.id,
          decision,
          approvedCredits,
          comment: reviewComment.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${decision.toLowerCase()} proposal.`)
      }

      setFeedback({ type: "success", text: data.message })
      setPendingProposals((prev) => prev.filter((t) => t.id !== reviewingTask.id))

      if (decision === "APPROVE") {
        const approvedItem: SelfTaskItem = {
          ...reviewingTask,
          proposalStatus: "APPROVED",
          taskStatus: "ASSIGNED",
          approvedCredits,
          hodApprovalComment: reviewComment.trim(),
        }
        setActiveInProgress((prev) => [approvedItem, ...prev])
        setAllTasks((prev) => prev.map((t) => (t.id === reviewingTask.id ? approvedItem : t)))
      }

      setReviewingTask(null)
      router.refresh()
    } catch (err: any) {
      setReviewError(err.message || "Failed to process proposal.")
    } finally {
      setIsReviewing(false)
    }
  }

  // Handle Deliverable Verification Decision
  const handleVerificationDecision = async (decision: "APPROVE" | "REJECT") => {
    if (!verifyingTask) return
    setIsVerifying(true)
    setVerifyError(null)

    try {
      const res = await fetch("/api/tasks/self-tasks/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: verifyingTask.id,
          decision,
          comment: verifyComment.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify deliverables.")
      }

      setFeedback({ type: "success", text: data.message })
      setPendingVerifications((prev) => prev.filter((t) => t.id !== verifyingTask.id))

      if (decision === "APPROVE") {
        const verifiedItem: SelfTaskItem = {
          ...verifyingTask,
          taskStatus: "LEAD_SIGNED",
          hodVerificationComment: verifyComment.trim(),
        }
        setCompletedTasks((prev) => [verifiedItem, ...prev])
        setActiveInProgress((prev) => prev.filter((t) => t.id !== verifyingTask.id))
        setAllTasks((prev) => prev.map((t) => (t.id === verifyingTask.id ? verifiedItem : t)))
      }

      setVerifyingTask(null)
      router.refresh()
    } catch (err: any) {
      setVerifyError(err.message || "Failed to complete verification.")
    } finally {
      setIsVerifying(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-card via-card/90 to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Department Head • Self-Task Governance</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Faculty Self-Task Oversight & Sign-Off
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Empower faculty initiative while maintaining academic rigor and anti-favoritism standards.
              Review proposals for feasibility, set fair WORK token rewards, and verify completion before disbursing tokens.
              All actions are transparently audited by the Director.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="text-xs px-3 py-1 bg-background/80">
              Department: <strong className="text-foreground ml-1">{deptName}</strong>
            </Badge>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50">
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
              Proposals Awaiting Review
            </span>
            <span className="text-xl font-black text-amber-400">{pendingProposals.length}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20">
            <span className="text-[10px] text-blue-400 uppercase font-bold tracking-wider block">
              Deliverables for Verification
            </span>
            <span className="text-xl font-black text-blue-400">{pendingVerifications.length}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Active In Progress
            </span>
            <span className="text-xl font-black text-foreground">{activeInProgress.length}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
              Completed & Verified
            </span>
            <span className="text-xl font-black text-emerald-400">{completedTasks.length}</span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="font-semibold">{feedback.text}</span>
          </div>
          <Button size="xs" variant="ghost" onClick={() => setFeedback(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* 2. TABS */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <TabsList className="bg-muted/60 p-1 rounded-2xl">
          <TabsTrigger value="proposals" className="rounded-xl text-xs font-semibold gap-1.5 relative">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Proposal Approvals</span>
            {pendingProposals.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
                {pendingProposals.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="verifications" className="rounded-xl text-xs font-semibold gap-1.5 relative">
            <FileCheck className="h-3.5 w-3.5" />
            <span>Completion Verifications</span>
            {pendingVerifications.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full bg-blue-500 text-white text-[10px] font-black">
                {pendingVerifications.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-xl text-xs font-semibold gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Department Roster ({allTasks.length})
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PROPOSAL APPROVAL QUEUE */}
        <TabsContent value="proposals" className="space-y-4">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                  <TableHead className="text-xs font-bold">Proposed Initiative & Interest</TableHead>
                  <TableHead className="text-xs font-bold">Target Date</TableHead>
                  <TableHead className="text-xs font-bold">Requested Credits</TableHead>
                  <TableHead className="text-xs font-bold">Planned Deliverable</TableHead>
                  <TableHead className="text-xs font-bold text-right">Review Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingProposals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400/60" />
                      No pending self-task proposals. All faculty initiatives have been reviewed!
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingProposals.map((task) => (
                    <TableRow key={task.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs">
                        <strong className="text-foreground block">{task.facultyName}</strong>
                        <span className="text-[10px] text-muted-foreground">{task.facultyDesignation || task.facultyEmail}</span>
                      </TableCell>

                      <TableCell className="text-xs max-w-sm">
                        <strong className="text-foreground block">{task.title}</strong>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="secondary" className="text-[9px] px-1 py-0">
                            {task.interestArea}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground line-clamp-1">
                            {task.description}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {task.targetCompletionDate || "—"}
                      </TableCell>

                      <TableCell className="text-xs font-bold text-emerald-400 whitespace-nowrap">
                        +{task.proposedCredits.toFixed(1)} WORK
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {task.expectedDeliverable || "Standard documentation"}
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="xs"
                          onClick={() => {
                            setReviewingTask(task)
                            setApprovedCredits(task.proposedCredits)
                            setReviewComment("")
                            setReviewError(null)
                          }}
                          className="rounded-xl text-xs gap-1 bg-primary hover:bg-primary/90 font-semibold"
                        >
                          <Lightbulb className="h-3 w-3" /> Evaluate Proposal
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 2: DELIVERABLE VERIFICATION QUEUE */}
        <TabsContent value="verifications" className="space-y-4">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                  <TableHead className="text-xs font-bold">Initiative</TableHead>
                  <TableHead className="text-xs font-bold">Approved Reward</TableHead>
                  <TableHead className="text-xs font-bold">Deliverables & Evidence</TableHead>
                  <TableHead className="text-xs font-bold text-right">Verification Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingVerifications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-xs">
                      <FileCheck className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      No deliverables awaiting verification right now.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingVerifications.map((task) => (
                    <TableRow key={task.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs">
                        <strong className="text-foreground block">{task.facultyName}</strong>
                        <span className="text-[10px] text-muted-foreground">{task.facultyDesignation}</span>
                      </TableCell>

                      <TableCell className="text-xs">
                        <strong className="text-foreground block">{task.title}</strong>
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">
                          {task.interestArea}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs font-bold text-emerald-400 whitespace-nowrap">
                        +{task.approvedCredits.toFixed(1)} WORK
                      </TableCell>

                      <TableCell className="text-xs max-w-sm">
                        <p className="text-muted-foreground line-clamp-2">{task.proofDescription}</p>
                        {task.proofUrl && (
                          <a
                            href={task.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-[11px] font-semibold mt-1"
                          >
                            <ExternalLink className="h-3 w-3" /> Inspect Deliverable Proof
                          </a>
                        )}
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="xs"
                          onClick={() => {
                            setVerifyingTask(task)
                            setVerifyComment("")
                            setVerifyError(null)
                          }}
                          className="rounded-xl text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Verify & Credit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 3: DEPARTMENT ROSTER & HISTORY */}
        <TabsContent value="history" className="space-y-4">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                  <TableHead className="text-xs font-bold">Initiative</TableHead>
                  <TableHead className="text-xs font-bold">Credits</TableHead>
                  <TableHead className="text-xs font-bold">Proposal Status</TableHead>
                  <TableHead className="text-xs font-bold">Execution State</TableHead>
                  <TableHead className="text-xs font-bold text-right">Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allTasks.map((task) => (
                  <TableRow key={task.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-xs">
                      <strong className="text-foreground block">{task.facultyName}</strong>
                      <span className="text-[10px] text-muted-foreground">{task.facultyEmail}</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-foreground">{task.title}</div>
                      <span className="text-[10px] text-muted-foreground">{task.interestArea}</span>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-400 whitespace-nowrap">
                      +{task.approvedCredits.toFixed(1)} WORK
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.proposalStatus === "APPROVED" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px]">Approved</Badge>
                      ) : task.proposalStatus === "REJECTED" ? (
                        <Badge variant="destructive" className="text-[9px]">Declined</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px]">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {task.taskStatus === "LEAD_SIGNED" || task.taskStatus === "CLOSED" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-bold">✓ Verified</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px]">{task.taskStatus}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {task.proofUrl ? (
                        <a
                          href={task.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                        >
                          <ExternalLink className="h-3 w-3" /> Proof
                        </a>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 3. EVALUATE PROPOSAL MODAL */}
      <Dialog open={!!reviewingTask} onOpenChange={(open) => !open && setReviewingTask(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Lightbulb className="h-5 w-5 text-primary" /> Evaluate Proposal
            </DialogTitle>
            <DialogDescription className="text-xs">
              Review initiative from <strong>{reviewingTask?.facultyName}</strong>
            </DialogDescription>
          </DialogHeader>

          {reviewError && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{reviewError}</span>
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-2xl bg-muted/40 border space-y-1">
              <strong className="text-foreground text-sm block">{reviewingTask?.title}</strong>
              <p className="text-muted-foreground text-xs leading-relaxed">{reviewingTask?.description}</p>
              {reviewingTask?.expectedDeliverable && (
                <div className="pt-2 text-[11px] text-muted-foreground border-t border-border/40">
                  Deliverable plan: <strong className="text-foreground">{reviewingTask.expectedDeliverable}</strong>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Approved WORK Token Reward</Label>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="20"
                value={approvedCredits}
                onChange={(e) => setApprovedCredits(Math.max(0.5, parseFloat(e.target.value) || 2.0))}
                className="rounded-xl text-xs font-bold"
              />
              <span className="text-[10px] text-muted-foreground">
                Faculty requested: {reviewingTask?.proposedCredits.toFixed(1)} WORK tokens. Adjust as appropriate.
              </span>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">HOD Feedback / Approval Comment</Label>
              <Textarea
                rows={3}
                placeholder="Add guidance, milestone expectations, or justification for approved credits..."
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleProposalDecision("REJECT")}
              disabled={isReviewing}
              className="rounded-xl text-xs"
            >
              Decline Proposal
            </Button>
            <Button
              size="sm"
              onClick={() => handleProposalDecision("APPROVE")}
              disabled={isReviewing}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 font-semibold"
            >
              {isReviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <ThumbsUp className="h-3.5 w-3.5 mr-1.5" />}
              Approve for Execution (+{approvedCredits} WORK)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. VERIFY DELIVERABLE MODAL */}
      <Dialog open={!!verifyingTask} onOpenChange={(open) => !open && setVerifyingTask(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" /> Verify Completion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm completion for <strong>{verifyingTask?.facultyName}</strong>
            </DialogDescription>
          </DialogHeader>

          {verifyError && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{verifyError}</span>
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            <div className="p-3 rounded-2xl bg-muted/40 border space-y-1.5">
              <strong className="text-foreground text-sm block">{verifyingTask?.title}</strong>
              <p className="text-muted-foreground text-xs leading-relaxed">{verifyingTask?.proofDescription}</p>
              {verifyingTask?.proofUrl && (
                <a
                  href={verifyingTask.proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-semibold pt-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Open Deliverable Link
                </a>
              )}
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-between">
              <span>Disbursement Amount:</span>
              <strong className="text-base font-black">+{verifyingTask?.approvedCredits.toFixed(1)} WORK Tokens</strong>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Verification Note / Sign-off Comment</Label>
              <Textarea
                rows={3}
                placeholder="Confirm that deliverables meet departmental academic and technical expectations..."
                value={verifyComment}
                onChange={(e) => setVerifyComment(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleVerificationDecision("REJECT")}
              disabled={isVerifying}
              className="rounded-xl text-xs text-destructive hover:bg-destructive/10"
            >
              Request Revision
            </Button>
            <Button
              size="sm"
              onClick={() => handleVerificationDecision("APPROVE")}
              disabled={isVerifying}
              className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
              Confirm Verification & Disburse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
