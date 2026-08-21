"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
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
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Check,
  Sparkles,
  CalendarCheck,
} from "lucide-react"

interface ScheduleItem {
  id: string
  title: string
  credit_value: number
  status: string
  deadline: string | null
  description: string | null
}

interface Commitment {
  id: string
  title: string
  reward: number
  status: string
  deadline: string | null
}

interface MemberCommitmentsProps {
  commitments: Commitment[]
  schedule: ScheduleItem[]
  orgId: string
}

export function MemberCommitments({ commitments, schedule: initialSchedule, orgId }: MemberCommitmentsProps) {
  const router = useRouter()
  const [schedule, setSchedule] = useState<ScheduleItem[]>(initialSchedule)
  const [selectedItem, setSelectedItem] = useState<ScheduleItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1)
  const [actionLoading, setActionLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const handleOpenConfirm = (item: ScheduleItem) => {
    setSelectedItem(item)
    setConfirmStep(1)
    setFeedback(null)
    setIsModalOpen(true)
  }

  const handleFinalConfirmCompletion = async () => {
    if (!selectedItem) return

    setActionLoading(true)
    setFeedback(null)

    try {
      const res = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: selectedItem.id,
          classDate: new Date().toISOString().split("T")[0],
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to mark session completion.")
      }

      setSchedule((prev) =>
        prev.map((s) => (s.id === selectedItem.id ? { ...s, status: "CLOSED" } : s))
      )

      setFeedback({
        type: "success",
        text: "Task completed! Auto-approved & added to your progress.",
      })

      setTimeout(() => {
        setIsModalOpen(false)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to complete task.",
      })
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Weekly Schedule */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-lg font-light">This Week&apos;s Schedule</CardTitle>
            <CardDescription className="font-light">Lectures and scheduled teaching sessions</CardDescription>
          </div>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3.5">
          {schedule.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center font-light">
              No lectures or sessions scheduled for this week.
            </p>
          ) : (
            schedule.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3.5 rounded-xl border border-muted/40 bg-background/40 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {s.deadline
                      ? new Date(s.deadline).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                      : "09:00"}
                  </span>
                  <div>
                    <span className="text-sm font-semibold text-foreground/90 block">{s.title}</span>
                    <span className="text-[11px] text-muted-foreground font-light">
                      {s.description || "Assigned Classroom"}
                    </span>
                  </div>
                </div>

                {s.status === "CLOSED" || s.status === "LEAD_SIGNED" || s.status === "VERIFIED" ? (
                  <Badge
                    variant="secondary"
                    className="text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-[10px] font-medium rounded-lg"
                  >
                    ✓ Auto-Approved & Done
                  </Badge>
                ) : (
                  <Button
                    size="xs"
                    onClick={() => handleOpenConfirm(s)}
                    disabled={actionLoading}
                    className="rounded-xl text-xs font-semibold shadow-xs"
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Mark Completed
                  </Button>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Active Commitments */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader>
          <CardTitle className="text-lg font-light">My Active Commitments</CardTitle>
          <CardDescription className="font-light">Unstructured tasks accepted</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {commitments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center font-light">
              No active commitments.
            </p>
          ) : (
            commitments.map((ac) => (
              <div
                key={ac.id}
                className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-muted/40 bg-background/40 gap-4"
              >
                <div className="text-left">
                  <h4 className="text-sm font-normal text-foreground/90">{ac.title}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[9px] font-light">
                      {ac.reward} tokens
                    </Badge>
                    {ac.status === "OVERDUE" && (
                      <Badge variant="destructive" className="text-[9px] font-light rounded">
                        Overdue
                      </Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => router.push(`/${orgId}/member/tasks`)}
                  className="rounded-xl text-xs shrink-0 shadow-xs"
                >
                  Submit Proof
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2-STEP CONFIRMATION MODAL FOR SCHEDULED TASKS                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">
                  {confirmStep === 1 ? "Confirm Task Completion" : "Final Double Confirmation"}
                </DialogTitle>
                <DialogDescription className="text-xs">{selectedItem?.title}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {feedback && (
              <div
                className={`p-3 text-xs rounded-xl border flex items-center gap-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{feedback.text}</span>
              </div>
            )}

            {/* STEP 1: First Confirmation Box */}
            {confirmStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-muted/80 bg-muted/20 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Did you complete this scheduled teaching session/task?
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/40">
                    <div className="flex justify-between">
                      <span>Task:</span>
                      <span className="font-semibold text-foreground">{selectedItem?.title}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Details:</span>
                      <span className="text-foreground">{selectedItem?.description || "Scheduled Session"}</span>
                    </div>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2 sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsModalOpen(false)}
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

            {/* STEP 2: Second Double-Check Confirmation */}
            {confirmStep === 2 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-2.5">
                  <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                    <ShieldCheck className="h-4 w-4" />
                    Please Confirm One More Time
                  </div>
                  <p className="text-xs text-foreground/90 leading-relaxed">
                    Confirm that you have fulfilled this scheduled responsibility:{" "}
                    <span className="font-bold">{selectedItem?.title}</span>.
                  </p>
                  <div className="p-2.5 rounded-lg bg-background/60 border border-primary/15 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      As a core scheduled duty, this task is <strong>auto-approved</strong> and immediately updated for your HOD and credited to your progress.
                    </span>
                  </div>
                </div>

                <DialogFooter className="gap-2 pt-2 sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setConfirmStep(1)}
                    disabled={actionLoading}
                    className="rounded-xl text-xs"
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleFinalConfirmCompletion}
                    disabled={actionLoading}
                    className="rounded-xl text-xs font-semibold shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white min-w-36"
                  >
                    {actionLoading ? (
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
