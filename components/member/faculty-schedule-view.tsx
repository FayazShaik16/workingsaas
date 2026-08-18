"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  Calendar,
  Clock,
  MapPin,
  Users,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  CalendarCheck,
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

  // Form State
  const todayDateString = new Date().toISOString().split("T")[0]
  const [classDate, setClassDate] = useState<string>(todayDateString)
  const [studentsPresent, setStudentsPresent] = useState<number>(55)
  const [studentsAbsent, setStudentsAbsent] = useState<number>(5)
  const [topicsCovered, setTopicsCovered] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Local record state for immediate UI feedback
  const [localRecords, setLocalRecords] = useState<Record<string, { status: string }>>(
    Object.fromEntries(
      Object.entries(recentAttendanceRecords).map(([k, v]) => [k, { status: v.status }])
    )
  )

  const handleOpenAttendanceModal = (slot: SlotEntry) => {
    setSelectedSlot(slot)
    const defaultTotal = slot.studentCount || 60
    setStudentsPresent(Math.min(55, defaultTotal))
    setStudentsAbsent(Math.max(0, defaultTotal - 55))
    setTopicsCovered("")
    setClassDate(todayDateString)
    setFeedbackMessage(null)
    setIsModalOpen(true)
  }

  const handlePresentChange = (val: number) => {
    const present = Math.max(0, val)
    setStudentsPresent(present)
    const total = selectedSlot?.studentCount || 60
    setStudentsAbsent(Math.max(0, total - present))
  }

  const handleSubmitAttendance = async (e: React.FormEvent) => {
    e.preventDefault()
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
          classDate,
          studentsPresent,
          studentsAbsent,
          topicsCovered,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit attendance")
      }

      // Mark locally as SUBMITTED
      const recordKey = `${selectedSlot.slotId}_${classDate}`
      setLocalRecords((prev) => ({
        ...prev,
        [recordKey]: { status: "SUBMITTED" },
      }))

      setFeedbackMessage({
        type: "success",
        text: "Attendance submitted successfully! Sent to HOD Monday approval queue.",
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

  const totalSlots = Object.values(schedule).flat().length

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

              const isSubmitted = attendanceRecord?.status === "SUBMITTED"
              const isVerified = attendanceRecord?.status === "VERIFIED"
              const isRejected = attendanceRecord?.status === "REJECTED"

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
                        <span className="font-semibold text-sm text-foreground">
                          {slot.subjectCode} — {slot.subjectName}
                        </span>
                        <Badge variant="secondary" className="text-[10px] font-normal rounded-md">
                          {slot.batch}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          Sem {slot.semester}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-muted-foreground font-light">
                        {slot.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-primary/70" /> {slot.room}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3 text-primary/70" /> {slot.programme}
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3 text-primary/70" /> {slot.studentCount || 60} Enrolled
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Status / Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    {isVerified ? (
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold py-1 px-2.5">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Verified by HOD (+1.0 Token)
                      </Badge>
                    ) : isSubmitted ? (
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-xs font-semibold py-1 px-2.5">
                        <Clock className="h-3.5 w-3.5 mr-1" /> Pending HOD Approval
                      </Badge>
                    ) : isRejected ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs">
                          <AlertCircle className="h-3.5 w-3.5 mr-1" /> Rejected
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenAttendanceModal(slot)}
                          className="rounded-xl text-xs h-8"
                        >
                          Resubmit
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenAttendanceModal(slot)}
                        className="rounded-xl text-xs h-9 shadow-xs font-medium"
                      >
                        <CalendarCheck className="h-3.5 w-3.5 mr-1.5" />
                        Log Attendance Sheet
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      {/* One-Click Attendance Sheet Popup Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">Classroom Attendance Sheet</DialogTitle>
                <DialogDescription className="text-xs">
                  {selectedSlot?.subjectCode} — {selectedSlot?.subjectName} ({selectedSlot?.batch})
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmitAttendance} className="space-y-4 pt-2">
            {feedbackMessage && (
              <div
                className={`p-3 text-xs rounded-xl border ${
                  feedbackMessage.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                    : "bg-destructive/10 text-destructive border-destructive/20"
                }`}
              >
                {feedbackMessage.text}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="classDate" className="text-xs">
                  Session Date
                </Label>
                <Input
                  id="classDate"
                  type="date"
                  value={classDate}
                  onChange={(e) => setClassDate(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="text-xs rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="room" className="text-xs">
                  Classroom / Lab
                </Label>
                <Input
                  id="room"
                  value={selectedSlot?.room || "LH-101"}
                  disabled
                  className="text-xs rounded-xl bg-muted/40"
                />
              </div>
            </div>

            {/* Attendance Counts */}
            <div className="p-4 rounded-xl border border-muted/80 bg-muted/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">Enrolled Students</span>
                <Badge variant="secondary" className="font-mono text-xs">
                  {selectedSlot?.studentCount || 60} Total
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="present" className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                    Students Present
                  </Label>
                  <Input
                    id="present"
                    type="number"
                    min={0}
                    max={selectedSlot?.studentCount || 100}
                    value={studentsPresent}
                    onChange={(e) => handlePresentChange(Number(e.target.value))}
                    required
                    disabled={isSubmitting}
                    className="text-sm font-mono rounded-xl font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="absent" className="text-xs text-muted-foreground">
                    Students Absent
                  </Label>
                  <Input
                    id="absent"
                    type="number"
                    min={0}
                    value={studentsAbsent}
                    onChange={(e) => setStudentsAbsent(Number(e.target.value))}
                    required
                    disabled={isSubmitting}
                    className="text-sm font-mono rounded-xl"
                  />
                </div>
              </div>
            </div>

            {/* Topics Brief */}
            <div className="space-y-1.5">
              <Label htmlFor="topics" className="text-xs">
                Topic Covered & Pedagogical Brief
              </Label>
              <Textarea
                id="topics"
                placeholder="e.g. Unit 3: Dynamic Programming algorithms, Knapsack implementation demo, problem set assigned."
                value={topicsCovered}
                onChange={(e) => setTopicsCovered(e.target.value)}
                rows={3}
                required
                disabled={isSubmitting}
                className="text-xs rounded-xl"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl text-xs font-semibold shadow-xs">
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Submit to HOD Queue
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
