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
  Coins,
  Lock,
  Trophy,
  Flame,
  Zap,
  ShieldCheck,
  IndianRupee,
} from "lucide-react"
import { ScheduledCompletionModal, ScheduledInstanceItem } from "./scheduled-completion-modal"
import { CircularProgressRing } from "./circular-progress-ring"
import { MonthlyProgressView } from "@/lib/workledger/progress"
import type { MemberDashboardData } from "@/lib/workledger/member-dashboard"
import { checkSessionTiming } from "@/lib/utils"
import Link from "next/link"
import { toast } from "sonner"

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
  isNominated?: boolean
  nominationStatus?: string
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
  walletBalance: number
  progress: MonthlyProgressView
  salaryComponent?: MemberDashboardData["salaryComponent"]
  motivationalPacing?: MemberDashboardData["motivationalPacing"]
  actionableSuggestions?: MemberDashboardData["actionableSuggestions"]
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
  walletBalance,
  progress: initialProgress,
  salaryComponent,
  motivationalPacing,
  actionableSuggestions,
  todayInstances: initialTodayInstances,
  nextUpcomingInstance,
  assignedTasks: initialAssignedTasks,
  recentActivity,
}: MinimalFacultyDashboardProps) {
  const [instances, setInstances] = useState<ScheduledInstanceRow[]>(initialTodayInstances)
  const [assigned, setAssigned] = useState<AssignedAdHocTask[]>(initialAssignedTasks)
  const [progress, setProgress] = useState<MonthlyProgressView>(initialProgress)
  const [claimingSalary, setClaimingSalary] = useState(false)
  const [salaryClaimed, setSalaryClaimed] = useState(
    Boolean(initialProgress.salaryRequestStatus && initialProgress.salaryRequestStatus !== "HOD_REJECTED")
  )

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

  // Derived Salary Component Data
  const salaryComp = salaryComponent || {
    baseSalary: 75000,
    currency: "INR",
    targetCredits: progress.totalTargetCredits || 20.0,
    thresholdCredits: thresholdRequiredCredits || 17.0,
    earnedCredits: progress.rawEarnedCredits || 0,
    unlockedSalaryAmount: Math.round(
      75000 * Math.min(1.0, (progress.rawEarnedCredits || 0) / (progress.totalTargetCredits || 20.0))
    ),
    remainingCreditsToThreshold: Math.max(
      0,
      Math.round(((thresholdRequiredCredits || 17.0) - (progress.rawEarnedCredits || 0)) * 10) / 10
    ),
    isEligible: progress.salaryEligible,
    isCustomConfigured: false,
  }

  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  }
  const currSym = currencySymbols[salaryComp.currency] || salaryComp.currency

  // Derived Motivational Pacing
  const pacing = motivationalPacing || {
    status: salaryComp.isEligible
      ? ("THRESHOLD_MET" as const)
      : (progress.displayProgressPercentage || 0) >= 50
      ? ("ON_TRACK" as const)
      : ("BEHIND" as const),
    headline: salaryComp.isEligible
      ? "🎉 85% Salary Clearance Threshold Met!"
      : (progress.displayProgressPercentage || 0) >= 50
      ? `🔥 Final Sprint: Only ${salaryComp.remainingCreditsToThreshold.toFixed(1)} WORK Tokens to 85% Safety!`
      : `🚀 Momentum Alert: Bank ${salaryComp.remainingCreditsToThreshold.toFixed(1)} WORK Tokens for Salary Clearance`,
    subtext: salaryComp.isEligible
      ? "You have officially qualified for monthly salary clearance on Day 26. Complete remaining classes to earn additional performance tokens!"
      : "Complete your scheduled sessions and pending task proofs to secure your 100% monthly salary payout.",
    daysUntilSalaryReview: Math.max(0, 26 - new Date().getDate()),
    tokensToSafety: salaryComp.remainingCreditsToThreshold,
  }

  const suggestions = actionableSuggestions || []

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

        <div className="flex flex-wrap items-center gap-2.5">
          <Badge variant="outline" className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 py-1 px-3">
            <Coins className="h-3.5 w-3.5" />
            <span>{(walletBalance || 0).toFixed(1)} WORK Credits Earned</span>
          </Badge>
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgId}/member/schedule`} className="gap-1.5 text-xs">
              <Calendar className="h-3.5 w-3.5" />
              <span>View Full Schedule</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. HERO: Expected Tokens vs Salary & Psychological Motivation Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* LEFT: Expected Tokens to be Earned with respect to Salary */}
        <Card className="lg:col-span-6 rounded-2xl border-2 shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Expected Tokens & Salary Clearance
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Monthly token requirements to guarantee full salary payout on Day 26.
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-mono font-bold bg-primary/5 text-primary border-primary/20">
              {salaryComp.isCustomConfigured ? "Configured Policy" : "Standard Policy"}
            </Badge>
          </CardHeader>

          <CardContent className="p-5 space-y-4 flex-1 flex flex-col justify-between">
            {/* Top 3 Metric Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 border space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Base Salary
                </span>
                <span className="text-lg font-black text-foreground font-mono">
                  {currSym}{salaryComp.baseSalary.toLocaleString()}
                </span>
                <span className="text-[10px] text-muted-foreground block">Monthly Base</span>
              </div>

              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1">
                <span className="text-[11px] font-medium text-primary uppercase tracking-wider block">
                  Target Tokens
                </span>
                <span className="text-lg font-black text-primary font-mono">
                  {salaryComp.targetCredits.toFixed(1)} <span className="text-xs">WORK</span>
                </span>
                <span className="text-[10px] text-muted-foreground block">For 100% Clearance</span>
              </div>

              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                  Earned To Date
                </span>
                <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {salaryComp.earnedCredits.toFixed(1)} <span className="text-xs">WORK</span>
                </span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-mono font-medium block">
                  {currSym}{salaryComp.unlockedSalaryAmount.toLocaleString()} unlocked
                </span>
              </div>
            </div>

            {/* Threshold & Progress Visualization Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>85% Safety Threshold: <strong className="font-mono text-foreground">{salaryComp.thresholdCredits.toFixed(1)} WORK</strong></span>
                </span>
                <span className="font-mono font-bold text-foreground">
                  {progress.displayProgressPercentage || 0}%
                </span>
              </div>

              {/* Multi-tier Visual Progress Bar */}
              <div className="relative w-full h-3.5 bg-muted rounded-full overflow-hidden">
                {/* 85% Safety Threshold Marker */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-foreground/40 z-10"
                  style={{ left: "85%" }}
                  title="85% Payroll Safety Mark"
                />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    salaryComp.isEligible
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                      : (progress.displayProgressPercentage || 0) >= 50
                      ? "bg-gradient-to-r from-amber-500 to-amber-400"
                      : "bg-gradient-to-r from-primary/80 to-primary"
                  }`}
                  style={{ width: `${Math.min(100, progress.displayProgressPercentage || 0)}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-[11px] text-muted-foreground pt-0.5">
                <span>0 WORK</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  85% ({salaryComp.thresholdCredits.toFixed(1)} WORK) Clearance Mark
                </span>
                <span>100% ({salaryComp.targetCredits.toFixed(1)} WORK)</span>
              </div>
            </div>

            {/* Status Footer Badge */}
            <div className="pt-2 border-t flex items-center justify-between gap-3 text-xs">
              {salaryComp.isEligible ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>100% Salary Clearance Guaranteed for Day 26 Review!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                  <AlertCircle className="h-4 w-4" />
                  <span>
                    Need <strong className="font-mono">{salaryComp.remainingCreditsToThreshold.toFixed(1)} more WORK tokens</strong> to unlock 100% salary clearance.
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Psychological Motivation & Work Suggestions */}
        <Card className="lg:col-span-6 rounded-2xl border-2 shadow-xs overflow-hidden flex flex-col justify-between">
          <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Work Suggestions & Motivation
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  High-yield tasks & scheduled classes to bank required tokens quickly.
                </CardDescription>
              </div>
            </div>
            {pacing.daysUntilSalaryReview > 0 && (
              <Badge variant="outline" className="text-xs font-mono font-bold border-amber-500/30 text-amber-600 bg-amber-500/5">
                {pacing.daysUntilSalaryReview} Days to Review
              </Badge>
            )}
          </CardHeader>

          <CardContent className="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
            {/* Dynamic Psychological Callout Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 text-xs ${
                pacing.status === "EXCEEDED"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : pacing.status === "THRESHOLD_MET"
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                  : pacing.status === "ON_TRACK"
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300"
              }`}
            >
              {pacing.status === "EXCEEDED" ? (
                <Trophy className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              ) : pacing.status === "THRESHOLD_MET" ? (
                <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              ) : pacing.status === "ON_TRACK" ? (
                <Flame className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              ) : (
                <Zap className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-sm text-foreground">{pacing.headline}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{pacing.subtext}</p>
              </div>
            </div>

            {/* Suggestions Checklist */}
            <div className="space-y-2 flex-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Recommended Actions to Bank Tokens:
              </p>

              {suggestions.length === 0 ? (
                <div className="p-4 text-center rounded-xl bg-muted/20 border text-xs text-muted-foreground space-y-1">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" />
                  <p className="font-bold text-foreground">All recommended actions completed!</p>
                  <p className="text-[11px]">Explore the Task Pool to take on optional initiatives.</p>
                </div>
              ) : (
                suggestions.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-xl border bg-card hover:bg-muted/30 transition flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground truncate">{item.title}</span>
                        <Badge variant="secondary" className="font-mono text-[10px] text-primary font-bold shrink-0">
                          +{item.creditValue.toFixed(1)} WORK
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">{item.reason}</p>
                    </div>

                    <div className="shrink-0">
                      {item.type === "SCHEDULED_SESSION" && instances.some((i) => `session-${i.id}` === item.id) ? (
                        <Button
                          size="sm"
                          className="h-7 text-xs font-semibold"
                          onClick={() => {
                            const inst = instances.find((i) => `session-${i.id}` === item.id)
                            if (inst) handleOpenCompletion(inst)
                          }}
                        >
                          {item.actionLabel}
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="outline" className="h-7 text-xs font-semibold">
                          <Link href={item.actionUrl}>
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. ROW 2: Responsive Two-Column Main Grid (Left ~60%, Right ~40%) */}
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
                  const timing = checkSessionTiming(inst.workDate, inst.startTime)

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
                          ) : timing.canComplete ? (
                            <Badge variant="outline" className="text-[10px]">
                              Scheduled
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-muted-foreground font-mono bg-muted/40">
                              {timing.label}
                            </Badge>
                          )}
                        </div>
                        <p className={`font-semibold text-sm truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {inst.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          +{(inst.creditValue || 1).toFixed(1)} WORK Credits
                        </p>
                      </div>

                      <div className="shrink-0">
                        {isDone ? (
                          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium px-2 py-1">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>Done</span>
                          </div>
                        ) : timing.canComplete ? (
                          <Button
                            size="sm"
                            onClick={() => handleOpenCompletion(inst)}
                            className="text-xs h-8"
                          >
                            Complete
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled
                            variant="outline"
                            className="text-xs h-8 opacity-60 cursor-not-allowed font-normal text-muted-foreground gap-1"
                            title={timing.label}
                          >
                            <Lock className="h-3 w-3" />
                            <span>{timing.label}</span>
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
                    <span className="font-bold text-foreground">{(progress.rawEarnedCredits || 0).toFixed(1)}</span> / {(progress.totalTargetCredits || 0).toFixed(1)} WORK credits
                  </div>
                </div>

                {/* Threshold Info */}
                <div className="w-full pt-3 border-t space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-muted-foreground font-mono">
                    <span>{progress.salaryThresholdPercentage || 85}% Threshold:</span>
                    <span className="font-semibold text-foreground">
                      {(thresholdRequiredCredits || 0).toFixed(1)} / {(progress.totalTargetCredits || 0).toFixed(1)} cr
                    </span>
                  </div>

                  {/* Status Hint */}
                  <div className="text-xs pt-1">
                    {progress.salaryEligible ? (
                      <div className="space-y-2">
                        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs font-normal">
                          Eligible to request salary review from {progress.salaryRequestOpenDate ? new Date(progress.salaryRequestOpenDate).toLocaleDateString("en-US", { day: "numeric", month: "short" }) : "Day 26"}
                        </Badge>
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              setClaimingSalary(true)
                              const res = await fetch("/api/member/claim-salary", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({}),
                              })
                              const data = await res.json()
                              if (!res.ok) throw new Error(data.error || "Failed to initiate salary review.")
                              setSalaryClaimed(true)
                              toast.success(data.message || "Salary review requested successfully!")
                            } catch (err: any) {
                              toast.error(err.message || "Could not initiate salary review.")
                            } finally {
                              setClaimingSalary(false)
                            }
                          }}
                          disabled={claimingSalary || salaryClaimed}
                          className="w-full text-xs font-semibold h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          {claimingSalary ? (
                            "Submitting Review Request..."
                          ) : progress.salaryRequestStatus === "HOD_APPROVED" || progress.salaryRequestStatus === "APPROVED_LEAD" ? (
                            "✓ Salary Endorsed by HOD"
                          ) : salaryClaimed || progress.salaryRequestStatus === "PENDING_HOD" ? (
                            "✓ Salary Review Pending HOD"
                          ) : (
                            "Initiate Salary Review"
                          )}
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">
                        <span className="font-bold font-mono text-foreground">{(progress.creditsToThreshold || 0).toFixed(1)}</span> credits to salary-request eligibility
                      </p>
                    )}
                  </div>

                  {progress.aboveTargetCredits > 0 && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-1 pt-1">
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>+{Number(progress.aboveTargetCredits || 0).toFixed(1)} credits above target</span>
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
              Department tasks, committees, and ad-hoc initiatives assigned to you or nominated from Task Pool.
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
              {assigned.map((task) => {
                const isApproved = task.status === "LEAD_SIGNED" || task.status === "CLOSED"
                const isReviewPending = task.status === "VERIFICATION_PENDING"
                const isPendingNomination = task.nominationStatus === "PENDING" || task.status === "NOMINATED"
                return (
                  <div key={task.id} className="py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {renderPriorityBadge(task.priority)}
                        <span className="text-xs font-mono font-bold text-primary">
                          +{Number(task.creditValue || 0).toFixed(1)} cr
                        </span>
                        {task.deadline && (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            Due: {task.deadline.includes("T") ? task.deadline.split("T")[0] : task.deadline}
                          </span>
                        )}
                        {isApproved ? (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40 font-semibold flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            <span>Approved & Signed</span>
                          </Badge>
                        ) : isReviewPending ? (
                          <Badge variant="secondary" className="text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/40 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>Proof Submitted · In HOD Review</span>
                          </Badge>
                        ) : isPendingNomination ? (
                          <Badge variant="secondary" className="text-[10px] bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-300/40">
                            Nominated (Pending Review)
                          </Badge>
                        ) : task.isNominated ? (
                          <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300/40">
                            Nomination Accepted
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300/40">
                            Assigned
                          </Badge>
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
                      {isApproved ? (
                        <Button asChild size="sm" variant="outline" className="text-xs h-8 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10">
                          <Link href={`/${orgId}/member/tasks/${task.id}`}>
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            <span>View Deliverable</span>
                          </Link>
                        </Button>
                      ) : isReviewPending ? (
                        <Button asChild size="sm" variant="outline" className="text-xs h-8 text-purple-600 dark:text-purple-400 border-purple-500/30">
                          <Link href={`/${orgId}/member/tasks/${task.id}`}>
                            <Clock className="h-3.5 w-3.5 mr-1" />
                            <span>In Review</span>
                          </Link>
                        </Button>
                      ) : isPendingNomination ? (
                        <Button asChild size="sm" variant="outline" className="text-xs h-8">
                          <Link href={`/${orgId}/member/marketplace/${task.id}`}>
                            View Task
                          </Link>
                        </Button>
                      ) : (
                        <Button asChild size="sm" variant="default" className="text-xs h-8">
                          <Link href={`/${orgId}/member/tasks/${task.id}`}>
                            Submit Proof
                          </Link>
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
                      <p className="text-[11px] text-muted-foreground font-mono" suppressHydrationWarning>
                        {new Date(act.occurredAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    +{Number(act.credits || 0).toFixed(1)} cr
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
