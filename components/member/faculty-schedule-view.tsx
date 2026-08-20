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
  MapPin,
  Users,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarCheck,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface SlotEntry {
  slotId: string
  assignmentId: string
  period: number
  startTime: string
  endTime: string
  room: string | null
  subjectCode: string
  subjectName: string
  batch: string
  batchId?: string
  studentCount?: number
  semester: number
  programme: string
  dayOfWeek: string
  attendanceStatus?: "SUBMITTED" | "VERIFIED" | "REJECTED" | null
  taskId?: string
}

interface FacultyScheduleViewProps {
  orgId: string
  userId: string
  schedule: Record<string, SlotEntry[]>
  recentAttendanceRecords: Record<string, { id: string; status: string; class_date: string; students_present: number }>
}

export function FacultyScheduleView({
  orgId,
  userId,
  schedule,
  recentAttendanceRecords,
}: FacultyScheduleViewProps) {
  const router = useRouter()
  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const dayLabels: Record<string, string> = {
    MON: "Monday",
    TUE: "Tuesday",
    WED: "Wednesday",
    THU: "Thursday",
    FRI: "Friday",
    SAT: "Saturday",
  }

  // Determine today's day abbreviation
  const todayDowIndex = new Date().getDay()
  const dowMap = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const todayDow = dowMap[todayDowIndex] === "SUN" ? "MON" : dowMap[todayDowIndex]

  const [activeDay, setActiveDay] = useState<string>(todayDow)
  const [selectedSlot, setSelectedSlot] = useState<SlotEntry | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1)

  const todayDateString = new Date().toISOString().split("T")[0]
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Local record state for immediate UI feedback
  const [localRecords, setLocalRecords] = useState<Record<string, { status: string }>>(
    Object.fromEntries(
      Object.entries(recentAttendanceRecords).map(([k, v]) => [k, { status: v.status }])
    )
  )

  const handleOpenConfirmModal = (slot: SlotEntry) => {
    setSelectedSlot(slot)
    setConfirmStep(1)
    setFeedbackMessage(null)
    setIsModalOpen(true)
  }

  const handleFinalConfirmCompletion = async () => {
    if (!selectedSlot) return

    setIsSubmitting(true)
    setFeedbackMessage(null)

    try {
      const response = await fetch("/api/attendance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timetableSlotId: selectedSlot.slotId,
          taskId: selectedSlot.taskId,
          classDate: todayDateString,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to mark session completion")
      }

      // Mark locally as VERIFIED / Auto-Approved
      const recordKey = `${selectedSlot.slotId}_${todayDateString}`
      setLocalRecords((prev) => ({
        ...prev,
        [recordKey]: { status: "VERIFIED" },
      }))

      setFeedbackMessage({
        type: "success",
        text: "Session completed! Auto-approved & credits added to your progress.",
      })

      setTimeout(() => {
        setIsModalOpen(false)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setFeedbackMessage({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Day Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {days.map((day) => {
          const count = schedule[day]?.length || 0
          const isToday = day === todayDow
          const isSelected = day === activeDay

          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-xs transition-all shrink-0 ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span>{dayLabels[day]}</span>
              {isToday && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-primary-foreground/20 text-primary-foreground font-bold">
                  Today
                </span>
              )}
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                  isSelected ? "bg-primary-foreground/25" : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Slots List for Selected Day */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-3 border-b border-muted/40 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-light flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {dayLabels[activeDay]} Schedule
            </CardTitle>
            <CardDescription className="font-light text-xs">
              {schedule[activeDay]?.length || 0} scheduled periods
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            Academic Year 2025-2026
          </Badge>
        </CardHeader>
        <CardContent className="p-0 divide-y divide-muted/30">
          {(schedule[activeDay] || []).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-light">
              <CalendarCheck className="h-8 w-8 mx-auto mb-2 opacity-40" />
              No lectures or sessions scheduled for {dayLabels[activeDay]}.
            </div>
          ) : (
            schedule[activeDay].map((slot, index) => {
              const recordKey = `${slot.slotId}_${todayDateString}`
              const attendanceRecord = localRecords[recordKey]

              const isCompleted =
                attendanceRecord?.status === "VERIFIED" ||
                attendanceRecord?.status === "CONDUCTED" ||
                slot.attendanceStatus === "VERIFIED"

              return (
                <div
                  key={`${slot.slotId}-${index}`}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-18 flex-shrink-0 text-center bg-primary/10 rounded-xl p-2.5 border border-primary/20">
                      <p className="text-xs font-bold text-primary">Period {slot.period}</p>
                      <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                        {slot.startTime} – {slot.endTime}
                      </p>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-mono text-[10px] font-bold">
                          {slot.subjectCode}
                        </Badge>
                        <h4 className="text-sm font-semibold text-foreground/90">
                          {slot.subjectName}
                        </h4>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-0.5">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-primary/70" />
                          {slot.batch} ({slot.programme})
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-primary/70" />
                          {slot.room || "Classroom"}
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3.5 w-3.5 text-primary/70" />
                          Semester {slot.semester}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4" /> Completed & Auto-Approved
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenConfirmModal(slot)}
                        className="rounded-xl text-xs font-semibold shadow-xs"
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
      {/* TWO-STEP CONFIRMATION MODAL (NO VALIDITY FORM ASKED)          */}
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
                  {confirmStep === 1
                    ? "Confirm Task Completion"
                    : "Final Double Confirmation"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedSlot?.subjectCode} — {selectedSlot?.subjectName} ({selectedSlot?.batch})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {feedbackMessage && (
              <div
                className={`p-3 text-xs rounded-xl border flex items-center gap-2 ${
                  feedbackMessage.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{feedbackMessage.text}</span>
              </div>
            )}

            {/* STEP 1: First Confirmation Box */}
            {confirmStep === 1 && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-muted/80 bg-muted/20 space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    Did you complete this scheduled teaching session?
                  </p>
                  <div className="text-xs text-muted-foreground space-y-1 pt-1 border-t border-border/40">
                    <div className="flex justify-between">
                      <span>Subject:</span>
                      <span className="font-semibold text-foreground">
                        {selectedSlot?.subjectName} ({selectedSlot?.subjectCode})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Batch & Time:</span>
                      <span className="text-foreground">
                        {selectedSlot?.batch} • {selectedSlot?.startTime} – {selectedSlot?.endTime}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Classroom:</span>
                      <span className="text-foreground">{selectedSlot?.room || "Classroom"}</span>
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
                    Confirm that you have fulfilled your scheduled teaching responsibility for{" "}
                    <span className="font-bold">{selectedSlot?.subjectName}</span> on{" "}
                    <span className="font-semibold">{dayLabels[activeDay]}</span>.
                  </p>
                  <div className="p-2.5 rounded-lg bg-background/60 border border-primary/15 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      As a scheduled core responsibility, this task is <strong>auto-approved</strong> and immediately credited to your progress and visible to your HOD.
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
                    onClick={handleFinalConfirmCompletion}
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
