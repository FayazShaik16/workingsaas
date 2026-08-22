"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Check,
} from "lucide-react"
import { ScheduledCompletionModal, ScheduledInstanceItem } from "./scheduled-completion-modal"

export interface WeeklyTemplateItem {
  id: string
  title: string
  weeklyDay: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN"
  startTime: string
  endTime: string
  creditValue: number
  description?: string | null
}

export interface InstanceItem {
  id: string
  templateId: string | null
  title: string
  workDate: string
  startTime: string
  endTime: string
  creditValue: number
  status: "SCHEDULED" | "SELF_COMPLETED" | "CANCELLED"
}

interface FacultyScheduleViewProps {
  orgId: string
  userId: string
  templates: WeeklyTemplateItem[]
  instances: InstanceItem[]
  currentMonthName: string
}

export function FacultyScheduleView({
  orgId,
  userId,
  templates,
  instances: initialInstances,
  currentMonthName,
}: FacultyScheduleViewProps) {
  const days: Array<"MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"> = [
    "MON",
    "TUE",
    "WED",
    "THU",
    "FRI",
    "SAT",
  ]
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
  const todayDow = (dowMap[todayDowIndex] === "SUN" ? "MON" : dowMap[todayDowIndex]) as any

  const [activeDay, setActiveDay] = useState<string>(todayDow)
  const [instances, setInstances] = useState<InstanceItem[]>(initialInstances)

  // 2-Step Completion Modal State
  const [selectedInstance, setSelectedInstance] = useState<ScheduledInstanceItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Group templates by day
  const templatesByDay: Record<string, WeeklyTemplateItem[]> = {
    MON: [],
    TUE: [],
    WED: [],
    THU: [],
    FRI: [],
    SAT: [],
  }

  for (const t of templates) {
    const d = t.weeklyDay.toUpperCase()
    if (templatesByDay[d]) {
      templatesByDay[d].push(t)
    }
  }

  // Sort each day by start time
  Object.keys(templatesByDay).forEach((d) => {
    templatesByDay[d].sort((a, b) => a.startTime.localeCompare(b.startTime))
  })

  const currentDayTemplates = templatesByDay[activeDay] || []

  const handleOpenCompletion = (inst: InstanceItem) => {
    setSelectedInstance({
      id: inst.id,
      title: inst.title,
      workDate: inst.workDate,
      startTime: inst.startTime,
      endTime: inst.endTime,
      creditValue: inst.creditValue,
      status: inst.status,
    })
    setIsModalOpen(true)
  }

  const handleCompletionSuccess = (creditsAwarded: number) => {
    if (selectedInstance) {
      setInstances((prev) =>
        prev.map((i) => (i.id === selectedInstance.id ? { ...i, status: "SELF_COMPLETED" } : i))
      )
    }
  }

  return (
    <div className="space-y-6">
      {/* Weekly Day Tabs */}
      <div className="flex flex-wrap gap-2 border-b pb-4">
        {days.map((day) => {
          const count = templatesByDay[day]?.length || 0
          const isSelected = activeDay === day
          const isToday = todayDow === day

          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{dayLabels[day]}</span>
              {isToday && (
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Today" />
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isSelected
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Active Day Recurring Sessions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              {dayLabels[activeDay]} Recurring Timetable
            </h2>
            <p className="text-xs text-muted-foreground">
              Weekly sessions scheduled for every {dayLabels[activeDay]}.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {currentDayTemplates.length} session{currentDayTemplates.length === 1 ? "" : "s"}
          </Badge>
        </div>

        {currentDayTemplates.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-xs text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="font-medium text-foreground">No recurring sessions on {dayLabels[activeDay]}</p>
              <p className="text-muted-foreground mt-0.5">
                Enjoy your preparation and research time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentDayTemplates.map((t) => (
              <Card key={t.id} className="hover:border-primary/40 transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary">
                          {t.startTime?.slice(0, 5)} – {t.endTime?.slice(0, 5)}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          Weekly Template
                        </Badge>
                      </div>
                      <h3 className="font-semibold text-sm text-foreground mt-1">{t.title}</h3>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs shrink-0">
                      +{t.creditValue.toFixed(1)} cr
                    </Badge>
                  </div>

                  {t.description && (
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Generated Instances This Month */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {currentMonthName} Work Instances ({instances.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Date-specific session instances generated for this monthly accounting cycle.
            </p>
          </div>
        </div>

        {instances.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No date-specific instances generated yet for this month.</p>
              <p className="text-muted-foreground mt-0.5">
                Your Department Administrator syncs monthly instances from the Schedule Matrix.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {instances.map((inst) => {
              const isDone = inst.status === "SELF_COMPLETED"

              return (
                <Card
                  key={inst.id}
                  className={`transition-colors ${
                    isDone ? "bg-muted/30 border-muted" : "hover:border-primary/50"
                  }`}
                >
                  <CardContent className="p-4 flex flex-col justify-between h-full space-y-3">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-muted-foreground">
                          {inst.workDate}
                        </span>
                        {isDone ? (
                          <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-500/10">
                            Completed
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Scheduled
                          </Badge>
                        )}
                      </div>
                      <p className={`font-semibold text-sm ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {inst.title}
                      </p>
                      <div className="flex items-center justify-between text-xs font-mono pt-1 text-muted-foreground">
                        <span>{inst.startTime} – {inst.endTime}</span>
                        <span className="font-bold text-foreground">+{inst.creditValue.toFixed(1)} cr</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t flex justify-end">
                      {isDone ? (
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium py-1">
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Self Completed</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenCompletion(inst)}
                          className="w-full text-xs"
                        >
                          Complete Session
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* 2-Step Completion Modal */}
      <ScheduledCompletionModal
        instance={selectedInstance}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleCompletionSuccess}
      />
    </div>
  )
}
