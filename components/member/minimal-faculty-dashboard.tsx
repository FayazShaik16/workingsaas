"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShoppingBag,
  ExternalLink,
  CalendarDays,
  FileCheck,
  Check,
} from "lucide-react"
import { ScheduledCompletionModal, ScheduledInstanceItem } from "./scheduled-completion-modal"
import { CircularProgressRing } from "./circular-progress-ring"
import { MonthlyProgressView } from "@/lib/workledger/progress"
import Link from "next/link"

export interface ScheduledInstanceRow {
  id: string
  title: string
  workDate: string
  startTime: string
  endTime: string
  creditValue: number
  status: string
}

export interface AssignedAdHocTask {
  id: string
  title: string
  description?: string | null
  creditValue: number
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: string
  deadline?: string | null
  verificationMode: "MANUAL_REPORT" | "FILE_SUBMISSION"
}

export interface RecentActivityItem {
  id: string
  type: "SCHEDULED_COMPLETION" | "INITIATIVE_APPROVED" | "SALARY_EVENT"
  title: string
  credits: number
  occurredAt: string
}

interface MinimalFacultyDashboardProps {
  orgId: string
  userId: string
  userName: string
  userDesignation: string
  departmentName: string
  progress: MonthlyProgressView
  todayInstances: ScheduledInstanceRow[]
  nextUpcomingInstance: {
    id: string
    title: string
    workDate: string
    startTime: string
    endTime: string
    creditValue: number
  } | null
  assignedTasks: AssignedAdHocTask[]
  recentActivity: RecentActivityItem[]
}

export function MinimalFacultyDashboard({
  orgId,
  userId,
  userName,
  userDesignation,
  departmentName,
  progress: initialProgress,
  todayInstances: initialTodayInstances,
  nextUpcomingInstance,
  assignedTasks: initialAssignedTasks,
  recentActivity,
}: MinimalFacultyDashboardProps) {
  const [instances, setInstances] = useState<ScheduledInstanceRow[]>(initialTodayInstances)
  const [assigned, setAssigned] = useState<AssignedAdHocTask[]>(initialAssignedTasks)
  const [progress, setProgress] = useState<MonthlyProgressView>(initialProgress)

  // 2-Step Completion Modal State
  const [selectedInstance, setSelectedInstance] = useState<ScheduledInstanceItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Formatted date string
  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date())

  const handleOpenCompletion = (inst: ScheduledInstanceRow) => {
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

  const handleCompletionSuccess = (creditAwarded: number) => {
    if (selectedInstance) {
      setInstances((prev) =>
        prev.map((i) => (i.id === selectedInstance.id ? { ...i, status: "SELF_COMPLETED" } : i))
      )
      // Update client-side progress optimistically until refetch
      setProgress((prev) => {
        const newRaw = Math.round((prev.rawEarnedCredits + creditAwarded) * 100) / 100
        const newPct = prev.totalTargetCredits > 0
          ? Math.min(100, Math.round((newRaw / prev.totalTargetCredits) * 10000) / 100)
          : 0
        const reqThreshold = Math.round(((prev.totalTargetCredits * (prev.salaryThresholdPercentage || 85)) / 100) * 100) / 100
        return {
          ...prev,
          rawEarnedCredits: newRaw,
          scheduledEarnedCredits: prev.scheduledEarnedCredits + creditAwarded,
          displayProgressPercentage: newPct,
          creditsToThreshold: Math.max(0, Math.round((reqThreshold - newRaw) * 100) / 100),
          salaryEligible: newRaw >= reqThreshold,
          aboveTargetCredits: Math.max(0, Math.round((newRaw - prev.totalTargetCredits) * 100) / 100),
        }
      })
    }
  }

  const renderPriorityBadge = (p: string) => {
    const val = (p || "MEDIUM").toUpperCase()
    if (val === "URGENT") {
      return <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
    }
    if (val === "HIGH") {
      return <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">High</Badge>
    }
    return <Badge variant="outline" className="text-[10px]">Standard</Badge>
  }

  const thresholdRequiredCredits = progress.configured && progress.salaryThresholdPercentage
    ? Math.round(((progress.totalTargetCredits * progress.salaryThresholdPercentage) / 100) * 10) / 10
    : 0

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6">
      {/* 1. Header: Greeting, Date, Cycle, Compact Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            {todayFormatted}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Welcome, {userName}
            </h1>
            <Badge variant="secondary" className="text-xs font-normal">
              {departmentName}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {userDesignation} {progress.workCycleName ? `· ${progress.workCycleName}` : ""}
          </p>
        </div>

        <Button asChild size="sm" variant="outline">
          <Link href={`/${orgId}/member/schedule`} className="gap-1.5 text-xs">
            <Calendar className="h-3.5 w-3.5" />
            <span>View Full Schedule</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {/* 2. ROW 1: Responsive Two-Column Main Grid (Left ~60%, Right ~40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT COLUMN (~60%): Today's Scheduled Sessions */}
        <Card className="lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Today's Scheduled Sessions
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">
                Weekly timetable sessions scheduled for today. Complete on trust.
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-xs">
              {instances.length} session{instances.length === 1 ? "" : "s"}
            </Badge>
          </CardHeader>

          <CardContent className="p-4 flex-1 flex flex-col justify-center">
            {instances.length === 0 ? (
              <div className="py-6 text-center space-y-2">
                <Calendar className="h-7 w-7 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">No scheduled sessions today.</p>
                {nextUpcomingInstance ? (
                  <p className="text-xs text-muted-foreground">
                    Next session: <span className="font-medium text-foreground">{nextUpcomingInstance.title}</span> on <span className="font-mono">{nextUpcomingInstance.workDate}</span> ({nextUpcomingInstance.startTime}–{nextUpcomingInstance.endTime})
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    View your weekly recurring calendar in <Link href={`/${orgId}/member/schedule`} className="text-primary hover:underline">My Schedule</Link>.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {instances.map((inst) => {
                  const isDone = inst.status === "SELF_COMPLETED"

                  return (
                    <div
                      key={inst.id}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                        isDone ? "bg-muted/30 border-muted" : "bg-card hover:border-primary/50"
                      }`}
                    >
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {inst.startTime} – {inst.endTime}
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
                        <p className={`font-semibold text-sm truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {inst.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          +{inst.creditValue.toFixed(1)} WORK Credits
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isDone ? (
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-2 py-1">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Done</span>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleOpenCompletion(inst)}
                            className="text-xs h-8"
                          >
                            Complete
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT COLUMN (~40%): Monthly Work Progress */}
        <Card className="lg:col-span-5 flex flex-col justify-between">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Monthly Work Progress
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Based on recorded scheduled work and approved initiatives.
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 flex-1 flex flex-col justify-center items-center text-center space-y-4">
            {progress.configured ? (
              <>
                {/* Circular Progress Ring */}
                <div className="flex flex-col items-center space-y-2">
                  <CircularProgressRing
                    percentage={progress.displayProgressPercentage}
                    size={120}
                    strokeWidth={10}
                  />
                  <div className="text-xs font-mono text-muted-foreground">
                    <span className="font-bold text-foreground">{progress.rawEarnedCredits.toFixed(1)}</span> / {progress.totalTargetCredits.toFixed(1)} WORK credits
                  </div>
                </div>

                {/* Threshold Info */}
                <div className="w-full pt-3 border-t space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground font-mono">
                    <span>{progress.salaryThresholdPercentage || 85}% Threshold:</span>
                    <span className="font-semibold text-foreground">
                      {thresholdRequiredCredits.toFixed(1)} / {progress.totalTargetCredits.toFixed(1)} cr
                    </span>
                  </div>

                  {/* Status Hint */}
                  <div className="text-xs">
                    {progress.salaryEligible ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-normal">
                        Eligible to request salary review from {progress.salaryRequestOpenDate ? new Date(progress.salaryRequestOpenDate).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "Day 26"}
                      </Badge>
                    ) : (
                      <p className="text-muted-foreground">
                        <span className="font-bold font-mono text-foreground">{progress.creditsToThreshold?.toFixed(1)}</span> credits to salary-request eligibility
                      </p>
                    )}
                  </div>

                  {progress.aboveTargetCredits > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1 pt-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>+{progress.aboveTargetCredits.toFixed(1)} credits above target</span>
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="py-6 space-y-1 text-xs text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="font-semibold text-foreground">Your monthly work plan is not configured.</p>
                <p className="text-muted-foreground">
                  Contact your Department Administrator to allocate weekly timetable templates.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. ROW 2 — Full Width: Assigned Work & Initiatives */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Assigned Work & Initiatives · {assigned.length} task{assigned.length === 1 ? "" : "s"}
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Department tasks, committees, and ad-hoc initiatives assigned to you.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="ghost" className="text-xs gap-1">
            <Link href={`/${orgId}/member/marketplace`}>
              <span>Task Pool</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="p-4">
          {assigned.length === 0 ? (
            <div className="py-8 text-center space-y-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">No assigned initiatives right now.</p>
              <Button asChild size="sm" variant="outline" className="text-xs gap-1.5">
                <Link href={`/${orgId}/member/marketplace`}>
                  <ShoppingBag className="h-3.5 w-3.5" />
                  <span>Explore Task Pool</span>
                </Link>
              </Button>
            </div>
          ) : (
            <div className="divide-y">
              {assigned.map((task) => (
                <div key={task.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {renderPriorityBadge(task.priority)}
                      <span className="text-xs font-mono font-bold text-primary">
                        +{task.creditValue.toFixed(1)} cr
                      </span>
                      {task.deadline && (
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Due: {task.deadline}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm text-foreground truncate">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="text-[10px]">
                      {task.verificationMode === "FILE_SUBMISSION" ? "File Evidence" : "Report"}
                    </Badge>
                    <Button asChild size="sm" variant="default" className="text-xs h-8">
                      <Link href={`/${orgId}/member/tasks`}>
                        Submit Proof
                      </Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. ROW 3 — Compact Recent Activity */}
      {recentActivity.length > 0 && (
        <Card>
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" />
              Recent Work Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y text-xs">
              {recentActivity.map((act) => (
                <div key={act.id} className="p-3.5 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">{act.title}</p>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {new Date(act.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    +{act.credits.toFixed(1)} cr
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
