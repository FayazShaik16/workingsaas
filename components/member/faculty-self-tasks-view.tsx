"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Lightbulb,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  Send,
  Plus,
  Loader2,
  Calendar,
  ExternalLink,
  UploadCloud,
  FileCheck,
  TrendingUp,
} from "lucide-react"
import { SelfTaskItem, SelfTaskInterestArea } from "@/lib/workledger/self-tasks"
import { useRouter } from "next/navigation"

interface FacultySelfTasksViewProps {
  orgId: string
  tasks: SelfTaskItem[]
  facultyName: string
}

export function FacultySelfTasksView({
  orgId,
  tasks: initialTasks,
  facultyName,
}: FacultySelfTasksViewProps) {
  const router = useRouter()
  const [tasks, setTasks] = useState<SelfTaskItem[]>(initialTasks)

  // Propose Modal state
  const [isProposeOpen, setIsProposeOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [interestArea, setInterestArea] = useState<SelfTaskInterestArea>("RESEARCH")
  const [proposedCredits, setProposedCredits] = useState<number>(2.0)
  const [targetDate, setTargetDate] = useState<string>("")
  const [expectedDeliverable, setExpectedDeliverable] = useState("")
  const [isProposing, setIsProposing] = useState(false)
  const [proposeError, setProposeError] = useState<string | null>(null)
  const [proposeSuccess, setProposeSuccess] = useState<string | null>(null)

  // Submit Deliverable Modal state
  const [submittingTask, setSubmittingTask] = useState<SelfTaskItem | null>(null)
  const [proofNotes, setProofNotes] = useState("")
  const [proofUrl, setProofUrl] = useState("")
  const [isSubmittingProof, setIsSubmittingProof] = useState(false)
  const [proofError, setProofError] = useState<string | null>(null)

  // Metrics
  const totalProposed = tasks.length
  const activeInProgress = tasks.filter((t) => t.taskStatus === "ASSIGNED")
  const pendingReview = tasks.filter((t) => t.proposalStatus === "PENDING" && t.taskStatus === "DRAFT")
  const completedTasks = tasks.filter((t) => t.taskStatus === "LEAD_SIGNED" || t.taskStatus === "CLOSED")
  const totalTokensEarned = completedTasks.reduce((sum, t) => sum + t.approvedCredits, 0)

  // Handle Propose
  const handlePropose = async () => {
    if (!title.trim() || !description.trim()) {
      setProposeError("Please provide both a title and description for your initiative.")
      return
    }

    setIsProposing(true)
    setProposeError(null)

    try {
      const res = await fetch("/api/tasks/self-tasks/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          interestArea,
          proposedCredits,
          targetDate: targetDate || undefined,
          expectedDeliverable: expectedDeliverable.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit proposal.")
      }

      setProposeSuccess(data.message)
      setTimeout(() => {
        setIsProposeOpen(false)
        setTitle("")
        setDescription("")
        setExpectedDeliverable("")
        setProposeSuccess(null)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setProposeError(err.message || "Failed to propose task.")
    } finally {
      setIsProposing(false)
    }
  }

  // Handle Submit Deliverable
  const handleSubmitDeliverable = async () => {
    if (!submittingTask) return
    if (!proofNotes.trim() && !proofUrl.trim()) {
      setProofError("Please provide deliverable notes or a proof URL.")
      return
    }

    setIsSubmittingProof(true)
    setProofError(null)

    try {
      const res = await fetch("/api/tasks/self-tasks/submit-deliverable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: submittingTask.id,
          description: proofNotes.trim(),
          fileUrl: proofUrl.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit deliverable.")
      }

      setTasks((prev) =>
        prev.map((t) =>
          t.id === submittingTask.id
            ? {
                ...t,
                taskStatus: "VERIFICATION_PENDING",
                proofDescription: proofNotes.trim(),
                proofUrl: proofUrl.trim() || undefined,
              }
            : t
        )
      )

      setSubmittingTask(null)
      router.refresh()
    } catch (err: any) {
      setProofError(err.message || "Failed to submit deliverable.")
    } finally {
      setIsSubmittingProof(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-card via-card/90 to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <Lightbulb className="h-3.5 w-3.5" />
              <span>Interest-Driven Initiatives & Self-Tasking</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              Self-Proposed Tasks & Innovation Sandbox
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Have an initiative you are passionate about? Propose your own project in research, workshops, or lab enhancements.
              Once evaluated and approved by your Department Head, execute and submit deliverables to unlock extra WORK token rewards.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => setIsProposeOpen(true)}
              className="rounded-2xl text-xs gap-2 bg-primary hover:bg-primary/90 font-bold px-4 py-2.5 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Propose New Initiative
            </Button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50">
          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Total Proposed
            </span>
            <span className="text-xl font-black text-foreground">{totalProposed}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20">
            <span className="text-[10px] text-primary uppercase font-bold tracking-wider block">
              Active / In Progress
            </span>
            <span className="text-xl font-black text-primary">{activeInProgress.length}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
              Awaiting HOD Approval
            </span>
            <span className="text-xl font-black text-amber-400">{pendingReview.length}</span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
              Earned Rewards
            </span>
            <span className="text-xl font-black text-emerald-400">
              +{totalTokensEarned.toFixed(2)} <span className="text-xs font-semibold">WORK</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. TASK LIST TABLE */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <FileCheck className="h-4 w-4 text-primary" /> My Proposed Initiatives ({tasks.length})
          </h2>
          <Badge variant="outline" className="text-xs">
            Director Audited & Protected
          </Badge>
        </div>

        <Card className="rounded-2xl border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="text-xs font-bold">Initiative & Interest Area</TableHead>
                <TableHead className="text-xs font-bold">Target Date</TableHead>
                <TableHead className="text-xs font-bold">Credits</TableHead>
                <TableHead className="text-xs font-bold">HOD Proposal Review</TableHead>
                <TableHead className="text-xs font-bold">Lifecycle State</TableHead>
                <TableHead className="text-xs font-bold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-xs">
                    <Lightbulb className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    No self-proposed tasks yet. Click <strong>"Propose New Initiative"</strong> to launch a project aligned with your interests!
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-xs max-w-sm">
                      <strong className="text-foreground text-sm block">{task.title}</strong>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
                          {task.interestArea}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground line-clamp-1">
                          {task.description}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {task.targetCompletionDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>{task.targetCompletionDate}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      <div className="font-bold text-emerald-400">
                        +{task.approvedCredits.toFixed(1)} WORK
                      </div>
                      {task.proposedCredits !== task.approvedCredits && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          {task.proposedCredits.toFixed(1)} proposed
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="text-xs">
                      {task.proposalStatus === "APPROVED" ? (
                        <div>
                          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] font-semibold">
                            ✓ Approved by HOD
                          </Badge>
                          {task.hodApprovalComment && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 italic">
                              "{task.hodApprovalComment}"
                            </p>
                          )}
                        </div>
                      ) : task.proposalStatus === "REJECTED" ? (
                        <div>
                          <Badge variant="destructive" className="text-[9px] font-semibold">
                            ✗ Declined
                          </Badge>
                          {task.hodApprovalComment && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {task.hodApprovalComment}
                            </p>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[9px] font-semibold">
                          ⏳ Review Pending
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      {task.taskStatus === "LEAD_SIGNED" || task.taskStatus === "CLOSED" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                          ✓ Verified & Rewarded
                        </Badge>
                      ) : task.taskStatus === "VERIFICATION_PENDING" ? (
                        <Badge variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[10px] font-semibold">
                          🔍 Proof Under Verification
                        </Badge>
                      ) : task.taskStatus === "ASSIGNED" ? (
                        <Badge variant="outline" className="bg-primary/15 text-primary border-primary/30 text-[10px] font-semibold">
                          🚀 Ready for Work
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          {task.taskStatus}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      {task.taskStatus === "ASSIGNED" && (
                        <Button
                          size="xs"
                          onClick={() => {
                            setSubmittingTask(task)
                            setProofNotes("")
                            setProofUrl("")
                            setProofError(null)
                          }}
                          className="rounded-xl text-xs gap-1 bg-primary hover:bg-primary/90 font-semibold"
                        >
                          <UploadCloud className="h-3 w-3" /> Submit Deliverable
                        </Button>
                      )}
                      {(task.taskStatus === "LEAD_SIGNED" || task.taskStatus === "VERIFICATION_PENDING") && task.proofUrl && (
                        <a
                          href={task.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Proof
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* 3. PROPOSE MODAL */}
      <Dialog open={isProposeOpen} onOpenChange={setIsProposeOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Lightbulb className="h-5 w-5 text-primary" /> Propose Self-Task Initiative
            </DialogTitle>
            <DialogDescription className="text-xs">
              Propose an academic, research, or laboratory project aligned with your interests.
            </DialogDescription>
          </DialogHeader>

          {proposeError && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{proposeError}</span>
            </div>
          )}

          {proposeSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{proposeSuccess}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Initiative Title</Label>
              <Input
                placeholder="e.g. Conduct Hands-on Workshop on Microservices Architecture"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Area of Interest</Label>
                <Select value={interestArea} onValueChange={(val: any) => setInterestArea(val)}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESEARCH" className="text-xs">Research & Publications</SelectItem>
                    <SelectItem value="DEVELOPMENT" className="text-xs">Software / Hardware Project</SelectItem>
                    <SelectItem value="WORKSHOP" className="text-xs">Technical Workshop / Bootcamps</SelectItem>
                    <SelectItem value="LAB_UPGRADE" className="text-xs">Lab Equipment Upgrade</SelectItem>
                    <SelectItem value="MENTORSHIP" className="text-xs">Specialized Student Mentorship</SelectItem>
                    <SelectItem value="ACADEMIC_INITIATIVE" className="text-xs">Curriculum / Syllabus Innovation</SelectItem>
                    <SelectItem value="OTHER" className="text-xs">Other Initiative</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Proposed Credits (WORK)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="20"
                  value={proposedCredits}
                  onChange={(e) => setProposedCredits(Math.max(0.5, parseFloat(e.target.value) || 2.0))}
                  className="rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Completion Date</Label>
              <Input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rationale & Proposed Objectives</Label>
              <Textarea
                rows={3}
                placeholder="Explain the background, benefits to the department/students, and planned execution steps..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Planned Deliverable / Proof Plan</Label>
              <Input
                placeholder="e.g. GitHub repository, workshop report with participant sign-ins, working hardware demo"
                value={expectedDeliverable}
                onChange={(e) => setExpectedDeliverable(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProposeOpen(false)}
              disabled={isProposing}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handlePropose}
              disabled={isProposing || !title.trim() || !description.trim()}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 font-semibold"
            >
              {isProposing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
              Submit to Department Head
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. SUBMIT DELIVERABLE MODAL */}
      <Dialog open={!!submittingTask} onOpenChange={(open) => !open && setSubmittingTask(null)}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <UploadCloud className="h-5 w-5 text-primary" /> Submit Deliverables
            </DialogTitle>
            <DialogDescription className="text-xs">
              {submittingTask?.title} (+{submittingTask?.approvedCredits} WORK tokens)
            </DialogDescription>
          </DialogHeader>

          {proofError && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{proofError}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Summary of Accomplishments & Outcomes</Label>
              <Textarea
                rows={4}
                placeholder="Describe what was executed, key milestones reached, student participation, or repository details..."
                value={proofNotes}
                onChange={(e) => setProofNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Deliverable Evidence / Repository URL</Label>
              <Input
                type="url"
                placeholder="https://github.com/... or https://drive.google.com/..."
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSubmittingTask(null)}
              disabled={isSubmittingProof}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitDeliverable}
              disabled={isSubmittingProof || (!proofNotes.trim() && !proofUrl.trim())}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 font-semibold"
            >
              {isSubmittingProof ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <UploadCloud className="h-3.5 w-3.5 mr-1.5" />}
              Submit for HOD Verification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
