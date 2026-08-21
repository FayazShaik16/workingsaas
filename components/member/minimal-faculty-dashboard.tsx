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
import {
  Calendar,
  Clock,
  Coins,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarCheck,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
  Layers,
  FileCheck,
  ChevronRight,
  TrendingUp,
  Award,
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export interface ScheduledLectureTask {
  id: string
  title: string
  creditValue: number
  status: string
  deadline?: string | null
  description?: string | null
  period?: number
  room?: string | null
  subjectCode?: string
}

export interface AssignedUnscheduledTask {
  id: string
  title: string
  description?: string | null
  creditValue: number
  priority?: string
  status: string
  deadline?: string | null
  category?: string
}

interface MinimalFacultyDashboardProps {
  orgId: string
  userId: string
  userName: string
  userDesignation?: string
  earnedTokens: number
  monthlyTarget: number
  scheduledTasks: ScheduledLectureTask[]
  assignedTasks: AssignedUnscheduledTask[]
}

export function MinimalFacultyDashboard({
  orgId,
  userId,
  userName,
  userDesignation = "Faculty Member",
  earnedTokens,
  monthlyTarget,
  scheduledTasks: initialScheduled,
  assignedTasks: initialAssigned,
}: MinimalFacultyDashboardProps) {
  const router = useRouter()
  const [scheduledTasks, setScheduledTasks] = useState<ScheduledLectureTask[]>(initialScheduled)
  const [assignedTasks, setAssignedTasks] = useState<AssignedUnscheduledTask[]>(initialAssigned)

  // 2-Step Confirmation Modal State for Scheduled Tasks
  const [selectedScheduleTask, setSelectedScheduleTask] = useState<ScheduledLectureTask | null>(null)
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Progress Calculations
  const progressPercent = monthlyTarget > 0 ? Math.min(100, Math.round((earnedTokens / monthlyTarget) * 100)) : 0
  const remainingTokens = Math.max(0, monthlyTarget - earnedTokens)
  const isTargetAchieved = progressPercent >= 85

  const handleOpenConfirm = (task: ScheduledLectureTask) => {
    setSelectedScheduleTask(task)
    setConfirmStep(1)
    setFeedback(null)
    setIsConfirmModalOpen(true)
  }

  const handleFinalConfirm = async () => {
    if (!selectedScheduleTask) return

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const res = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedScheduleTask.id,
          classDate: new Date().toISOString().split("T")[0],
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark session completion.")
      }

      setScheduledTasks((prev) =>
        prev.map((t) => (t.id === selectedScheduleTask.id ? { ...t, status: "CLOSED" } : t))
      )

      setFeedback({
        type: "success",
        text: `Session completed! +${selectedScheduleTask.creditValue} WORK auto-approved & credited.`,
      })

      setTimeout(() => {
        setIsConfirmModalOpen(false)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to complete task.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderPriorityBadge = (p?: string) => {
    const val = (p || "MEDIUM").toUpperCase()
    if (val === "URGENT") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive border border-destructive/20 animate-pulse">
          🔴 Urgent
        </span>
      )
    }
    if (val === "HIGH") {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          🟠 High
        </span>
      )
    }
    return null
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. MINIMAL HEADER & PROGRESS HERO                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="p-6 md:p-8 rounded-3xl border border-muted/80 bg-background/60 backdrop-blur-md shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Faculty Workspace
              </span>
              <span className="text-xs text-muted-foreground">{userDesignation}</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-1.5">
              Welcome back, {userName}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track your scheduled lectures, assigned responsibilities, and monthly earned token rewards.
            </p>
          </div>

          {/* Quick Action */}
          <Link href={`/${orgId}/member/schedule`}>
            <Button variant="outline" size="sm" className="rounded-xl text-xs gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-primary" /> Full Weekly Timetable
            </Button>
          </Link>
        </div>

        {/* 3 Minimal Progress Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          {/* Monthly Progress */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-secondary space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span>Monthly Progress</span>
              <span className={isTargetAchieved ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-primary font-bold"}>
                {progressPercent}%
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isTargetAchieved ? "bg-emerald-500" : "bg-primary"
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isTargetAchieved
                ? "✓ 85% Salary release threshold unlocked"
                : `${remainingTokens.toFixed(1)} WORK needed for full endorsement`}
            </p>
          </div>

          {/* Tokens Earned Till Now */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-secondary space-y-1">
            <span className="text-xs text-muted-foreground font-medium block">Tokens Earned Till Now</span>
            <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono flex items-baseline gap-1.5">
              +{earnedTokens.toFixed(1)}
              <span className="text-xs font-normal text-muted-foreground">WORK</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Credited directly to personal wallet</p>
          </div>

          {/* Monthly Target */}
          <div className="p-4 rounded-2xl bg-secondary/30 border border-secondary space-y-1">
            <span className="text-xs text-muted-foreground font-medium block">Monthly Target Requirement</span>
            <div className="text-2xl font-bold text-foreground font-mono flex items-baseline gap-1.5">
              {monthlyTarget.toFixed(1)}
              <span className="text-xs font-normal text-muted-foreground">WORK</span>
            </div>
            <p className="text-[11px] text-muted-foreground">Institutional teaching & duty quota</p>
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl text-xs flex items-center justify-between gap-2 shadow-sm ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
              : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SCHEDULED TASKS & LECTURES (WITH TOKEN AMOUNTS)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card className="rounded-3xl border-muted/70 bg-background/60 backdrop-blur-md shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-muted/40">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <CalendarCheck className="h-5 w-5 text-primary" />
              Scheduled Teaching Tasks
            </CardTitle>
            <CardDescription className="text-xs font-light mt-0.5">
              Timetable lectures with verified WORK token rewards. Marking completed auto-approves immediately.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {scheduledTasks.length} Scheduled
          </Badge>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-muted/30">
          {scheduledTasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs font-light space-y-1">
              <Calendar className="h-6 w-6 mx-auto opacity-40 mb-1" />
              <p className="font-medium text-foreground">No scheduled sessions for this cycle</p>
              <p>Check your timetable or contact your HOD for slot assignments.</p>
            </div>
          ) : (
            scheduledTasks.map((task) => {
              const isCompleted = ["CLOSED", "VERIFIED", "LEAD_SIGNED", "APPROVED"].includes(task.status)

              return (
                <div
                  key={task.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-foreground/90">{task.title}</h4>
                      {task.subjectCode && (
                        <Badge variant="secondary" className="text-[10px] font-mono font-bold">
                          {task.subjectCode}
                        </Badge>
                      )}
                      {/* REWARD TOKEN AMOUNT HIGHLIGHT */}
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                        +{task.creditValue.toFixed(1)} WORK
                      </span>
                    </div>

                    <p className="text-xs text-muted-foreground font-light">
                      {task.description || "Classroom Lecture Session"}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Auto-Approved & Credited
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenConfirm(task)}
                        className="rounded-xl text-xs font-semibold shadow-xs bg-primary hover:bg-primary/90"
                      >
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Mark as Completed
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. ASSIGNED UNSCHEDULED TASKS (WITH TOKEN AMOUNTS)           */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card className="rounded-3xl border-muted/70 bg-background/60 backdrop-blur-md shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-muted/40">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Layers className="h-5 w-5 text-amber-500" />
              Assigned Unscheduled Tasks
            </CardTitle>
            <CardDescription className="text-xs font-light mt-0.5">
              Accreditation, committee, and institutional duties assigned to you.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {assignedTasks.length} Assigned
          </Badge>
        </CardHeader>

        <CardContent className="p-0 divide-y divide-muted/30">
          {assignedTasks.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-xs font-light space-y-1">
              <Sparkles className="h-6 w-6 mx-auto opacity-40 mb-1" />
              <p className="font-medium text-foreground">No active unscheduled assignments</p>
              <p>You can discover and self-nominate for extra tasks in the Open Task Pool.</p>
              <div className="pt-2">
                <Button asChild size="sm" variant="outline" className="rounded-xl text-xs">
                  <Link href={`/${orgId}/member/marketplace`}>Explore Task Pool</Link>
                </Button>
              </div>
            </div>
          ) : (
            assignedTasks.map((task) => {
              const isCompleted = ["CLOSED", "VERIFIED", "LEAD_SIGNED", "APPROVED"].includes(task.status)
              const isAwaitingReview = ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED"].includes(task.status)

              return (
                <div
                  key={task.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 hover:bg-muted/20 transition-colors"
                >
                  <div className="space-y-1 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-semibold text-foreground/90">{task.title}</h4>
                      {renderPriorityBadge(task.priority)}
                      {/* REWARD TOKEN AMOUNT HIGHLIGHT */}
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                        +{task.creditValue.toFixed(1)} WORK
                      </span>
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground font-light line-clamp-1">
                        {task.description}
                      </p>
                    )}

                    {task.deadline && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-0.5">
                        <Clock className="h-3 w-3 text-primary/70" />
                        Due by:{" "}
                        <span className="font-medium text-foreground">
                          {new Date(task.deadline).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                      </span>
                    ) : isAwaitingReview ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        <Clock className="h-3.5 w-3.5" /> Submitted (HOD Review)
                      </span>
                    ) : (
                      <Link href={`/${orgId}/member/tasks`}>
                        <Button size="sm" variant="outline" className="rounded-xl text-xs gap-1 shadow-xs">
                          <FileCheck className="h-3.5 w-3.5 text-primary" />
                          Submit Proof
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. TWO-STEP CONFIRMATION MODAL (NO VALIDITY ASKED)            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {confirmStep === 1 ? "Confirm Lecture Completion" : "Final Double Confirmation"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedScheduleTask?.title}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Step 1: Initial Prompt */}
            {confirmStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-muted/80 bg-muted/20 space-y-2.5">
                  <p className="text-sm font-medium text-foreground">
                    Did you complete this scheduled lecture/task?
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/40">
                    <div className="flex justify-between">
                      <span>Reward Value:</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{selectedScheduleTask?.creditValue.toFixed(1)} WORK
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Details:</span>
                      <span className="text-foreground">{selectedScheduleTask?.description || "Scheduled Class"}</span>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2 sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="rounded-xl text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setConfirmStep(2)}
                    className="rounded-xl text-xs font-semibold shadow-xs"
                  >
                    Yes, I Completed This Task <ArrowRight className="h-3.5 w-3.5 ml-1" />
                  </Button>
                </DialogFooter>
              </div>
            )}

            {/* Step 2: Final Double Confirmation */}
            {confirmStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <ShieldCheck className="h-4 w-4" />
                    Please Confirm One More Time
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    Confirm that you have fulfilled your scheduled teaching responsibility for{" "}
                    <span className="font-bold">{selectedScheduleTask?.title}</span>.
                  </p>
                  <div className="p-2.5 rounded-lg bg-background/60 border border-primary/15 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      This task is <strong>auto-approved</strong> immediately. +{selectedScheduleTask?.creditValue} WORK will be credited to your monthly progress.
                    </span>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2 sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmStep(1)}
                    disabled={isSubmitting}
                    className="rounded-xl text-xs"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFinalConfirm}
                    disabled={isSubmitting}
                    className="rounded-xl text-xs font-semibold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white min-w-36"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Confirming...
                      </>
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1.5" /> Yes, Final Confirm
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
