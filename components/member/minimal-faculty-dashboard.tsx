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
  Award,
  Layers,
  FileCheck,
  ShoppingBag,
  ExternalLink,
} from "lucide-react"
import { ScheduledCompletionModal, ScheduledInstanceItem } from "./scheduled-completion-modal"
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

interface MinimalFacultyDashboardProps {
  orgId: string
  userId: string
  userName: string
  userDesignation: string
  workCycleName: string | null
  rawEarnedCredits: number
  totalTargetCredits: number
  displayPercentage: number
  isSalaryEligible: boolean
  scheduledInstances: ScheduledInstanceRow[]
  assignedTasks: AssignedAdHocTask[]
}

export function MinimalFacultyDashboard({
  orgId,
  userId,
  userName,
  userDesignation,
  workCycleName,
  rawEarnedCredits,
  totalTargetCredits,
  displayPercentage,
  isSalaryEligible,
  scheduledInstances: initialInstances,
  assignedTasks: initialAssigned,
}: MinimalFacultyDashboardProps) {
  const [instances, setInstances] = useState<ScheduledInstanceRow[]>(initialInstances)
  const [assigned, setAssigned] = useState<AssignedAdHocTask[]>(initialAssigned)

  // 2-Step Completion Modal
  const [selectedInstance, setSelectedInstance] = useState<ScheduledInstanceItem | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Formatted date
  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date())

  const isConfigured = totalTargetCredits > 0
  const extraCredits = rawEarnedCredits > totalTargetCredits ? rawEarnedCredits - totalTargetCredits : 0

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
    }
  }

  const renderPriorityBadge = (p: string) => {
    const val = (p || "MEDIUM").toUpperCase()
    if (val === "URGENT") {
      return <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px]">Urgent</Badge>
    }
    if (val === "HIGH") {
      return <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">High</Badge>
    }
    return <Badge className="bg-slate-800 text-slate-300 border-white/10 text-[10px]">Standard</Badge>
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* 1. Header + Date + Concise Greeting */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div>
          <p className="text-xs font-mono text-violet-400 uppercase tracking-wider">
            {todayFormatted}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mt-1">
            Welcome, {userName}
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {userDesignation} · {workCycleName || "Active Work Cycle"}
          </p>
        </div>

        <Link
          href={`/${orgId}/member/schedule`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-200 transition-colors shrink-0"
        >
          <Calendar size={14} className="text-violet-400" />
          <span>My Full Weekly Schedule</span>
          <ArrowRight size={12} className="text-slate-400" />
        </Link>
      </div>

      {/* 2. Monthly Work Progress Card */}
      <Card className="rounded-2xl border-white/[0.08] bg-slate-900/60 backdrop-blur-md shadow-xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-violet-500 via-indigo-500 to-emerald-500" />
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-violet-400" />
                Monthly Work Progress
              </CardTitle>
              <CardDescription className="text-slate-400 text-xs mt-0.5">
                Calculated from verified structured and unstructured work ledger entries.
              </CardDescription>
            </div>
            {isConfigured ? (
              <Badge
                variant="outline"
                className={`font-mono text-xs px-3 py-1 ${
                  isSalaryEligible
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                    : "bg-violet-500/20 text-violet-300 border-violet-500/40"
                }`}
              >
                {isSalaryEligible ? "85% Salary Threshold Met" : "In Progress (85% Target)"}
              </Badge>
            ) : (
              <Badge variant="outline" className="font-mono text-xs bg-slate-800 text-slate-400 border-white/10">
                Target Not Configured
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-5">
          {isConfigured ? (
            <>
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-extrabold text-white font-mono">
                    {rawEarnedCredits.toFixed(1)}
                  </span>
                  <span className="text-sm font-mono text-slate-400 ml-1.5">
                    / {totalTargetCredits.toFixed(1)} Target Credits
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold font-mono text-violet-300">
                    {displayPercentage}%
                  </span>
                </div>
              </div>

              {/* Progress Bar with 85% Threshold Marker */}
              <div className="relative pt-2 pb-1">
                <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isSalaryEligible
                        ? "bg-gradient-to-r from-violet-500 to-emerald-400"
                        : "bg-gradient-to-r from-violet-600 to-indigo-500"
                    }`}
                    style={{ width: `${Math.min(100, displayPercentage)}%` }}
                  />
                </div>
                {/* 85% Marker Line */}
                <div
                  className="absolute top-1 bottom-0 flex flex-col items-center pointer-events-none"
                  style={{ left: "85%" }}
                >
                  <div className="w-0.5 h-full bg-amber-400 shadow-sm" />
                  <span className="text-[10px] font-mono text-amber-300 mt-1">85% Req</span>
                </div>
              </div>

              {extraCredits > 0 && (
                <p className="text-xs text-emerald-400 font-medium flex items-center gap-1.5 pt-1">
                  <Sparkles size={13} />
                  <span>You are +{extraCredits.toFixed(1)} credits above this month's target!</span>
                </p>
              )}
            </>
          ) : (
            <div className="py-6 text-center text-slate-400 text-xs">
              <p>No active work cycle or scheduled targets configured for your account.</p>
              <p className="text-slate-500 mt-1">Contact your Department Administrator to allocate your weekly timetable.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Scheduled Tasks Due Today */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Clock size={16} className="text-violet-400" />
            Today's Scheduled Sessions
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {instances.length} session{instances.length === 1 ? "" : "s"} scheduled
          </span>
        </div>

        {instances.length === 0 ? (
          <Card className="rounded-2xl border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Calendar size={28} className="mx-auto text-slate-500 mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-300">No scheduled sessions today</p>
            <p className="text-xs text-slate-500 mt-1">
              Your weekly recurring sessions will appear here on their scheduled days.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {instances.map((inst) => {
              const isCompleted = inst.status === "SELF_COMPLETED"

              return (
                <Card
                  key={inst.id}
                  className={`rounded-2xl border transition-all ${
                    isCompleted
                      ? "border-emerald-500/20 bg-emerald-950/10"
                      : "border-white/[0.08] bg-slate-900/40 hover:border-violet-500/30"
                  }`}
                >
                  <CardContent className="p-5 flex flex-col justify-between h-full gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                          <Clock size={12} className="text-violet-400" />
                          {inst.startTime} – {inst.endTime}
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] bg-violet-500/10 text-violet-300 border-violet-500/30"
                        >
                          +{inst.creditValue.toFixed(1)} Credits
                        </Badge>
                      </div>
                      <h3 className="text-base font-semibold text-white">{inst.title}</h3>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.04]">
                      {isCompleted ? (
                        <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                          <CheckCircle2 size={14} />
                          <span>Self-Confirmed Completed</span>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleOpenCompletion(inst)}
                          className="w-full bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs rounded-xl shadow-md shadow-violet-600/20"
                        >
                          Mark Completed
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

      {/* 4. Assigned Unscheduled / Ad-Hoc Tasks */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-400" />
            Assigned Ad-Hoc Work
          </h2>
          <span className="text-xs text-slate-400 font-mono">
            {assigned.length} assigned task{assigned.length === 1 ? "" : "s"}
          </span>
        </div>

        {assigned.length === 0 ? (
          <Card className="rounded-2xl border-white/[0.06] bg-white/[0.02] p-8 text-center">
            <Layers size={28} className="mx-auto text-slate-500 mb-2 opacity-50" />
            <p className="text-sm font-medium text-slate-300">No ad-hoc tasks currently assigned</p>
            <p className="text-xs text-slate-500 mt-1">
              Explore the departmental task pool to nominate yourself for additional institutional tasks.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {assigned.map((task) => (
              <Card
                key={task.id}
                className="rounded-2xl border-white/[0.08] bg-slate-900/40 hover:border-indigo-500/30 transition-all"
              >
                <CardContent className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {renderPriorityBadge(task.priority)}
                      <span className="text-xs font-mono text-slate-400">
                        Evidence: {task.verificationMode === "FILE_SUBMISSION" ? "File Upload" : "Written Report"}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-white">{task.title}</h3>
                    {task.description && (
                      <p className="text-xs text-slate-400 line-clamp-1">{task.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-mono text-indigo-300 font-bold block">
                        +{task.creditValue.toFixed(1)} Credits
                      </span>
                      {task.deadline && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          Due: {task.deadline.slice(0, 10)}
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/${orgId}/member/marketplace`}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>Submit Proof</span>
                      <ArrowRight size={12} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 5. Compact Task Pool Link */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-violet-950/40 to-indigo-950/40 border border-violet-500/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/20 text-violet-300 border border-violet-500/30">
            <ShoppingBag size={18} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">Department Task Pool</h4>
            <p className="text-xs text-slate-400">Nominate yourself for institutional initiatives and committee tasks.</p>
          </div>
        </div>
        <Link
          href={`/${orgId}/member/marketplace`}
          className="px-4 py-2 rounded-xl text-xs font-semibold bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/20 transition-colors inline-flex items-center gap-1.5 shrink-0"
        >
          <span>Explore Pool</span>
          <ArrowRight size={13} />
        </Link>
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
