"use client"

import { useState, useMemo } from "react"
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
  Sparkles,
  ClipboardList,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Search,
  Users,
  Coins,
  FileCheck,
  CheckSquare,
  FileText,
  Loader2,
  Calendar,
  Layers,
  ArrowUpDown,
  X,
  SlidersHorizontal,
  RotateCcw,
  UserCheck,
} from "lucide-react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export interface DepartmentTask {
  id: string
  title: string
  description?: string
  creditValue: number
  penaltyValue?: number
  category: string
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | string
  status: string
  deadline?: string
  createdAt: string
  completedAt?: string
  assignedToId?: string
  assignedToName?: string
  assignedToEmail?: string
  validationMode?: string
  tags?: string[]
  proofUrl?: string
  proofText?: string
}

export interface DepartmentFacultyMember {
  id: string
  name: string
  email: string
  designation?: string | null
}

export type TaskPeriodFilter = "today" | "yesterday" | "this_week" | "this_month" | "all" | "custom"

interface HODTaskManagerProps {
  orgId: string
  leadUserId: string
  deptId?: string
  deptName?: string
  tasks: DepartmentTask[]
  facultyMembers: DepartmentFacultyMember[]
  initialTab?: "pending" | "existing" | "view_all" | "approvals"
  pageTitle?: string
  pageDescription?: string
}

const getPriorityWeight = (p?: string): number => {
  const up = (p || "MEDIUM").toUpperCase()
  if (up === "URGENT") return 4
  if (up === "HIGH") return 3
  if (up === "MEDIUM") return 2
  return 1 // LOW
}

export function HODTaskManager({
  orgId,
  leadUserId,
  deptId,
  deptName = "Department",
  tasks: initialTasks,
  facultyMembers,
  initialTab = "pending",
}: HODTaskManagerProps) {
  const router = useRouter()

  // Tab State: "pending" | "existing" | "view_all" | "approvals"
  const [activeTab, setActiveTab] = useState<"pending" | "existing" | "view_all" | "approvals">(initialTab)

  // Tasks State
  const [tasks, setTasks] = useState<DepartmentTask[]>(initialTasks)

  // Sorting State - DEFAULT: HIGHEST PRIORITY FIRST
  const [sortBy, setSortBy] = useState<string>("PRIORITY_DESC")

  // Filters State
  const [periodFilter, setPeriodFilter] = useState<TaskPeriodFilter>("this_month")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL")
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL")

  // Inspection & Modals
  const [inspectingTask, setInspectingTask] = useState<DepartmentTask | null>(null)
  const [rejectModalTask, setRejectModalTask] = useState<DepartmentTask | null>(null)
  const [rejectReason, setRejectReason] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Faculty Assignment Modal State
  const [assigningTask, setAssigningTask] = useState<DepartmentTask | null>(null)
  const [assignFacultyId, setAssignFacultyId] = useState<string>("")
  const [assignDate, setAssignDate] = useState<string>("")
  const [assignError, setAssignError] = useState<string | null>(null)
  const [isAssigning, setIsAssigning] = useState(false)

  // Date filtering logic
  const isDateInPeriod = (dateStr?: string): boolean => {
    if (!dateStr) return periodFilter === "all"
    const itemDate = new Date(dateStr)
    const now = new Date()

    if (isNaN(itemDate.getTime())) return true

    switch (periodFilter) {
      case "today": {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        return itemDate >= startOfToday
      }
      case "yesterday": {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        return itemDate >= startOfYesterday && itemDate < endOfYesterday
      }
      case "this_week": {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return itemDate >= oneWeekAgo
      }
      case "this_month": {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return itemDate >= thirtyDaysAgo
      }
      case "custom": {
        if (!customStartDate && !customEndDate) return true
        const start = customStartDate ? new Date(customStartDate) : new Date(0)
        const end = customEndDate ? new Date(customEndDate) : new Date(9999, 11, 31)
        end.setHours(23, 59, 59, 999)
        return itemDate >= start && itemDate <= end
      }
      case "all":
      default:
        return true
    }
  }

  // Filter and Sort tasks based on active Tab, Period, Category, Priority, Search & Sort
  const filteredTasks = useMemo(() => {
    const list = tasks.filter((t) => {
      // 1. Tab Status Filter
      if (activeTab === "pending") {
        if (!["ASSIGNED", "IN_PROGRESS", "OPEN", "VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED"].includes(t.status)) {
          return false
        }
      } else if (activeTab === "approvals") {
        if (!["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"].includes(t.status)) {
          return false
        }
      }

      // 2. Period Filter
      if (!isDateInPeriod(t.completedAt || t.createdAt || t.deadline)) {
        return false
      }

      // 3. Category Filter
      if (categoryFilter !== "ALL" && t.category !== categoryFilter) {
        return false
      }

      // 4. Priority Filter
      if (priorityFilter !== "ALL" && (t.priority || "MEDIUM") !== priorityFilter) {
        return false
      }

      // 5. Search Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = t.title.toLowerCase().includes(q)
        const matchDesc = t.description?.toLowerCase().includes(q)
        const matchFaculty = t.assignedToName?.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchFaculty) return false
      }

      return true
    })

    // Sorting Logic (Default: Highest Priority First, then Date)
    return list.sort((a, b) => {
      if (sortBy === "PRIORITY_DESC") {
        const pA = getPriorityWeight(a.priority)
        const pB = getPriorityWeight(b.priority)
        if (pB !== pA) return pB - pA

        const dateA = a.deadline ? new Date(a.deadline).getTime() : new Date(a.createdAt).getTime()
        const dateB = b.deadline ? new Date(b.deadline).getTime() : new Date(b.createdAt).getTime()
        return dateA - dateB
      }
      if (sortBy === "DEADLINE_ASC") {
        const dA = a.deadline ? new Date(a.deadline).getTime() : 9999999999999
        const dB = b.deadline ? new Date(b.deadline).getTime() : 9999999999999
        return dA - dB
      }
      if (sortBy === "DEADLINE_DESC") {
        const dA = a.deadline ? new Date(a.deadline).getTime() : 0
        const dB = b.deadline ? new Date(b.deadline).getTime() : 0
        return dB - dA
      }
      if (sortBy === "CREATED_DESC") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (sortBy === "REWARD_DESC") {
        return b.creditValue - a.creditValue
      }
      return 0
    })
  }, [tasks, activeTab, periodFilter, customStartDate, customEndDate, categoryFilter, priorityFilter, searchQuery, sortBy])

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = tasks.length
    const pendingCount = tasks.filter((t) =>
      ["ASSIGNED", "IN_PROGRESS", "OPEN", "VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED"].includes(t.status)
    ).length
    const urgentPendingCount = tasks.filter((t) =>
      ["ASSIGNED", "IN_PROGRESS", "OPEN", "VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED"].includes(t.status) &&
      (t.priority || "").toUpperCase() === "URGENT"
    ).length
    const approvalsCount = tasks.filter((t) =>
      ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"].includes(t.status)
    ).length
    const totalTokens = tasks.reduce((sum, t) => sum + t.creditValue, 0)

    return { total, pendingCount, urgentPendingCount, approvalsCount, totalTokens }
  }, [tasks])

  const renderPriorityBadge = (priorityVal?: string) => {
    const p = (priorityVal || "MEDIUM").toUpperCase()
    switch (p) {
      case "URGENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-destructive/10 text-destructive border border-destructive/25">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            Urgent
          </span>
        )
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/25">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            High
          </span>
        )
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Low
          </span>
        )
      case "MEDIUM":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/25">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            Medium
          </span>
        )
    }
  }

  // Approve action
  const handleApproveTask = async (taskId: string) => {
    setIsProcessing(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/lead/approve-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, approverUserId: leadUserId }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to approve task.")
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: "LEAD_SIGNED" } : t))
      )
      setFeedback({ type: "success", text: "Task verified and approved for WORK credit release." })
      router.refresh()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to approve task." })
    } finally {
      setIsProcessing(false)
    }
  }

  // Reject action
  const handleConfirmReject = async () => {
    if (!rejectModalTask) return
    setIsProcessing(true)
    setFeedback(null)
    try {
      const res = await fetch("/api/lead/reject-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: rejectModalTask.id,
          rejectionReason: rejectReason || "Submission returned for revisions by HOD.",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to reject task.")
      }

      setTasks((prev) =>
        prev.map((t) => (t.id === rejectModalTask.id ? { ...t, status: "IN_PROGRESS" } : t))
      )
      setRejectModalTask(null)
      setRejectReason("")
      setFeedback({ type: "success", text: "Task returned to faculty member." })
      router.refresh()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to reject task." })
    } finally {
      setIsProcessing(false)
    }
  }

  // Open assign modal
  const handleOpenAssignModal = (task: DepartmentTask) => {
    setAssigningTask(task)
    setAssignFacultyId(task.assignedToId || facultyMembers[0]?.id || "")
    setAssignDate(task.deadline ? task.deadline.slice(0, 10) : new Date().toISOString().slice(0, 10))
    setAssignError(null)
  }

  // Confirm assign with collision prevention
  const handleConfirmAssign = async () => {
    if (!assigningTask || !assignFacultyId) return
    setIsAssigning(true)
    setAssignError(null)

    // Inline pre-validation check against currently loaded tasks
    const targetDate = assignDate || (assigningTask.deadline ? assigningTask.deadline.slice(0, 10) : "")
    if (targetDate) {
      const conflict = tasks.find((t) => {
        if (t.id === assigningTask.id) return false
        if (t.assignedToId !== assignFacultyId) return false
        if (!["ASSIGNED", "IN_PROGRESS", "PENDING_VERIFICATION", "LEAD_SIGNED", "CLOSED"].includes(t.status)) return false
        const tDate = t.deadline ? t.deadline.slice(0, 10) : ""
        return tDate === targetDate && t.title.toLowerCase().trim() === assigningTask.title.toLowerCase().trim()
      })

      if (conflict) {
        const facName = facultyMembers.find((f) => f.id === assignFacultyId)?.name || "This faculty member"
        setAssignError(
          `Collision detected: ${facName} is already assigned to "${conflict.title}" on ${targetDate}. Multiple assignments for the same task on the same date are prohibited.`
        )
        setIsAssigning(false)
        return
      }
    }

    try {
      const res = await fetch("/api/tasks/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: assigningTask.id,
          facultyId: assignFacultyId,
          deadline: assignDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to assign task.")
      }

      const assignedFac = facultyMembers.find((f) => f.id === assignFacultyId)
      setTasks((prev) =>
        prev.map((t) =>
          t.id === assigningTask.id
            ? {
                ...t,
                status: "ASSIGNED",
                assignedToId: assignFacultyId,
                assignedToName: assignedFac?.name,
                assignedToEmail: assignedFac?.email,
                deadline: assignDate,
              }
            : t
        )
      )

      setFeedback({
        type: "success",
        text: `Task "${assigningTask.title}" successfully assigned to ${assignedFac?.name}.`,
      })
      setAssigningTask(null)
      router.refresh()
    } catch (err: any) {
      setAssignError(err.message || "Failed to assign task.")
    } finally {
      setIsAssigning(false)
    }
  }

  const resetAllFilters = () => {
    setSearchQuery("")
    setCategoryFilter("ALL")
    setPriorityFilter("ALL")
    setPeriodFilter("this_month")
    setCustomStartDate("")
    setCustomEndDate("")
    setSortBy("PRIORITY_DESC")
  }

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    categoryFilter !== "ALL" ||
    priorityFilter !== "ALL" ||
    periodFilter !== "this_month"

  return (
    <div className="space-y-6 w-full">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. CLEAN HEADER & ACTION BAR                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              {deptName}
            </span>
            <span className="text-xs text-muted-foreground font-light">Accountability Portal</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground mt-1">
            Task Management
          </h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5 font-light">
            Review pending deliverables, track existing assignments, and verify department commitments.
          </p>
        </div>

        {/* Primary Action Button */}
        <Link href={`/${orgId}/lead/tasks/new`}>
          <Button size="default" className="rounded-xl font-semibold gap-2 shadow-sm bg-primary hover:bg-primary/90 h-10 px-5">
            <Plus className="h-4 w-4" />
            Post New Task
          </Button>
        </Link>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SLEEK HORIZONTAL METRIC BAR                                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xs flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Pending Tasks</p>
            <p className="text-2xl font-extrabold text-amber-500 mt-0.5 font-mono">{metrics.pendingCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xs flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Verification Queue</p>
            <p className="text-2xl font-extrabold text-emerald-500 mt-0.5 font-mono">{metrics.approvalsCount}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500">
            <CheckSquare className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xs flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Total Assignments</p>
            <p className="text-2xl font-extrabold text-foreground mt-0.5 font-mono">{metrics.total}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border/60 bg-card/50 backdrop-blur-xs flex items-center justify-between shadow-2xs">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">WORK Reward Pool</p>
            <p className="text-2xl font-extrabold text-primary mt-0.5 font-mono">
              {metrics.totalTokens.toFixed(1)}{" "}
              <span className="text-xs font-normal text-muted-foreground">WORK</span>
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Coins className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs ${
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
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. MAIN WORKSPACE CARD: TABS + TOOLBAR + TABLE                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card className="rounded-3xl border-border/70 bg-card/60 backdrop-blur-md shadow-sm overflow-hidden">
        {/* TOP SEGMENTED TAB SWITCHER */}
        <div className="border-b border-border/50 bg-muted/20 px-6 pt-4 pb-0 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-3">
            <button
              onClick={() => setActiveTab("pending")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "pending"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              Pending Tasks
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "pending" ? "bg-black/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {metrics.pendingCount}
              </span>
              {metrics.urgentPendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-destructive text-white text-[9px] font-bold animate-pulse">
                  {metrics.urgentPendingCount} Urgent
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("existing")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "existing"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Existing Tasks
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "existing" ? "bg-black/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {metrics.total}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("view_all")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "view_all"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              View All
            </button>

            <button
              onClick={() => setActiveTab("approvals")}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "approvals"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              Approvals Queue
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                activeTab === "approvals" ? "bg-black/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {metrics.approvalsCount}
              </span>
            </button>
          </div>
        </div>

        {/* UNIFIED FILTER & SORT TOOLBAR */}
        <div className="p-4 md:p-5 border-b border-border/40 bg-background/40 flex flex-wrap items-center justify-between gap-4">
          {/* Left: Filter Controls with Generous Sizing */}
          <div className="flex flex-wrap items-center gap-3">
            {/* 1. Priority Filter (w-48) */}
            <div className="flex items-center gap-2 shrink-0 bg-background/90 px-3.5 h-10 rounded-xl border border-border/60 shadow-2xs w-48">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Priority:</span>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="h-full border-0 bg-transparent p-0 text-xs font-semibold focus:ring-0 shadow-none flex-1 truncate">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent className="min-w-48">
                  <SelectItem value="ALL">All Priorities</SelectItem>
                  <SelectItem value="URGENT">🔴 Urgent</SelectItem>
                  <SelectItem value="HIGH">🟠 High</SelectItem>
                  <SelectItem value="MEDIUM">🔵 Medium</SelectItem>
                  <SelectItem value="LOW">🟢 Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 2. Category Filter (w-64) */}
            <div className="flex items-center gap-2 shrink-0 bg-background/90 px-3.5 h-10 rounded-xl border border-border/60 shadow-2xs w-64">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Category:</span>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-full border-0 bg-transparent p-0 text-xs font-semibold focus:ring-0 shadow-none flex-1 truncate">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent className="min-w-64">
                  <SelectItem value="ALL">All Categories</SelectItem>
                  <SelectItem value="STRUCTURED">Structured (Lecture / Lab)</SelectItem>
                  <SelectItem value="UNSTRUCTURED">Unstructured (Audit / NAAC)</SelectItem>
                  <SelectItem value="LABORATORY">Laboratory Session</SelectItem>
                  <SelectItem value="EXAM">Examination</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. Timeframe Filter (w-52) */}
            <div className="flex items-center gap-2 shrink-0 bg-background/90 px-3.5 h-10 rounded-xl border border-border/60 shadow-2xs w-52">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Period:</span>
              <Select value={periodFilter} onValueChange={(v) => setPeriodFilter(v as TaskPeriodFilter)}>
                <SelectTrigger className="h-full border-0 bg-transparent p-0 text-xs font-semibold focus:ring-0 shadow-none flex-1 truncate">
                  <SelectValue placeholder="This Month" />
                </SelectTrigger>
                <SelectContent className="min-w-52">
                  <SelectItem value="this_month">This Month</SelectItem>
                  <SelectItem value="this_week">This Week</SelectItem>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="yesterday">Yesterday</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={resetAllFilters}
                className="h-10 text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1.5 shrink-0 px-3"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            )}
          </div>

          {/* Right: Search & Sorting with Generous Widths */}
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            {/* 4. Sort Selector (w-64) */}
            <div className="flex items-center gap-2 shrink-0 bg-background/90 px-3.5 h-10 rounded-xl border border-border/60 shadow-2xs w-64">
              <span className="text-xs font-semibold text-muted-foreground shrink-0">Sort:</span>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="h-full border-0 bg-transparent p-0 text-xs font-semibold focus:ring-0 shadow-none flex-1 truncate text-primary">
                  <SelectValue placeholder="Sort Order" />
                </SelectTrigger>
                <SelectContent className="min-w-64">
                  <SelectItem value="PRIORITY_DESC">⚡ Highest Priority First</SelectItem>
                  <SelectItem value="DEADLINE_ASC">⏳ Earliest Due Date</SelectItem>
                  <SelectItem value="DEADLINE_DESC">📅 Latest Due Date</SelectItem>
                  <SelectItem value="CREATED_DESC">🕒 Recently Created</SelectItem>
                  <SelectItem value="REWARD_DESC">🪙 Highest WORK Reward</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search Input (w-72) */}
            <div className="relative w-72 shrink-0">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search tasks or faculty..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9.5 pr-8 h-10 rounded-xl text-xs bg-background/90 border-border/60 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Custom Date Picker (Only if Custom Range selected) */}
        {periodFilter === "custom" && (
          <div className="p-3 bg-muted/20 border-b border-border/40 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">From:</span>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="h-8 rounded-lg text-xs w-36"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">To:</span>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="h-8 rounded-lg text-xs w-36"
              />
            </div>
          </div>
        )}

        {/* TABLE CONTENT */}
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/10">
              <TableRow className="border-b border-border/50 text-xs hover:bg-transparent">
                <TableHead className="py-3.5 pl-6 font-semibold">Task Title & Scope</TableHead>
                <TableHead className="py-3.5 font-semibold">Priority</TableHead>
                <TableHead className="py-3.5 font-semibold">Assigned Faculty</TableHead>
                <TableHead className="py-3.5 font-semibold">Category</TableHead>
                <TableHead className="py-3.5 font-semibold">Reward Value</TableHead>
                <TableHead className="py-3.5 font-semibold">Due Date</TableHead>
                <TableHead className="py-3.5 font-semibold">Status</TableHead>
                <TableHead className="py-3.5 pr-6 font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody className="divide-y divide-border/30">
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16">
                    <div className="max-w-sm mx-auto text-center space-y-3">
                      <div className="h-12 w-12 rounded-2xl bg-muted/40 flex items-center justify-center mx-auto text-muted-foreground">
                        <ClipboardList className="h-6 w-6 opacity-60" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground">No tasks found</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {hasActiveFilters
                            ? "No tasks match your active filters. Try resetting the filters."
                            : activeTab === "pending"
                            ? "Great job! There are no pending tasks waiting in this department."
                            : "No tasks have been assigned yet."}
                        </p>
                      </div>
                      <div className="pt-2 flex items-center justify-center gap-2">
                        {hasActiveFilters ? (
                          <Button size="sm" variant="outline" onClick={resetAllFilters} className="rounded-xl text-xs">
                            Clear Filters
                          </Button>
                        ) : (
                          <Link href={`/${orgId}/lead/tasks/new`}>
                            <Button size="sm" className="rounded-xl text-xs gap-1.5 shadow-xs">
                              <Plus className="h-3.5 w-3.5" /> Create First Task
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => {
                  const isAwaitingReview = [
                    "VERIFICATION_PENDING",
                    "PENDING_VERIFICATION",
                    "SUBMITTED",
                    "IN_REVIEW",
                  ].includes(task.status)

                  const isApproved = ["LEAD_SIGNED", "APPROVED", "CLOSED", "VERIFIED"].includes(task.status)

                  return (
                    <TableRow key={task.id} className="hover:bg-muted/20 text-xs transition-colors">
                      {/* Title & Description */}
                      <TableCell className="py-4 pl-6 max-w-sm">
                        <div className="space-y-1">
                          <p className="font-semibold text-foreground/90">{task.title}</p>
                          {task.description && (
                            <p className="text-[11px] text-muted-foreground font-light line-clamp-1">
                              {task.description}
                            </p>
                          )}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {task.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="text-[9px] px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground font-medium"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableCell>

                      {/* Priority */}
                      <TableCell className="py-4">
                        {renderPriorityBadge(task.priority)}
                      </TableCell>

                      {/* Assigned Faculty */}
                      <TableCell className="py-4">
                        {task.assignedToName ? (
                          <div>
                            <p className="font-medium text-foreground/90">{task.assignedToName}</p>
                            {task.assignedToEmail && (
                              <p className="text-[10px] text-muted-foreground font-light">{task.assignedToEmail}</p>
                            )}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-medium text-amber-600 bg-amber-500/10 border-amber-500/30">
                            Open Task Pool
                          </Badge>
                        )}
                      </TableCell>

                      {/* Category */}
                      <TableCell className="py-4">
                        <Badge variant="secondary" className="text-[10px] uppercase font-mono py-0 px-2">
                          {task.category}
                        </Badge>
                      </TableCell>

                      {/* Reward */}
                      <TableCell className="py-4 font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        +{task.creditValue.toFixed(1)} WORK
                      </TableCell>

                      {/* Date */}
                      <TableCell className="py-4 text-muted-foreground font-light">
                        {task.deadline ? (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-primary/70" />
                            {new Date(task.deadline).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        ) : task.createdAt ? (
                          new Date(task.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="py-4">
                        {isApproved ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                          </span>
                        ) : isAwaitingReview ? (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-medium">
                            <Clock className="h-3.5 w-3.5" /> Review Pending
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-medium">
                            {task.status}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="py-4 pr-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {(task.proofUrl || task.proofText) && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setInspectingTask(task)}
                              className="h-8 text-xs text-muted-foreground hover:text-foreground rounded-xl"
                            >
                              <FileText className="h-3.5 w-3.5 mr-1 text-primary" /> View Proof
                            </Button>
                          )}

                          {/* Assign / Reassign Button */}
                          {!isApproved && (!task.assignedToId || task.status === "OPEN" || task.status === "ASSIGNED") && facultyMembers.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenAssignModal(task)}
                              disabled={isProcessing || isAssigning}
                              className="h-8 text-xs text-primary border-primary/25 hover:bg-primary/10 rounded-xl"
                            >
                              <UserCheck className="h-3.5 w-3.5 mr-1" />
                              {task.assignedToId ? "Reassign" : "Assign"}
                            </Button>
                          )}

                          {isAwaitingReview && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setRejectModalTask(task)}
                                disabled={isProcessing}
                                className="h-8 text-xs text-destructive border-destructive/25 hover:bg-destructive/10 rounded-xl"
                              >
                                Reject
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleApproveTask(task.id)}
                                disabled={isProcessing}
                                className="h-8 text-xs rounded-xl shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                Approve
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. PROOF INSPECTION MODAL                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!inspectingTask} onOpenChange={(open) => !open && setInspectingTask(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Submission Proof Details
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspectingTask?.title} — {inspectingTask?.assignedToName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50 space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Reward Value:</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                  +{inspectingTask?.creditValue.toFixed(1)} WORK
                </span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Priority:</span>
                <span>{renderPriorityBadge(inspectingTask?.priority)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Category:</span>
                <span className="font-medium text-foreground">{inspectingTask?.category}</span>
              </div>
            </div>

            {inspectingTask?.proofText && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Faculty Submission Remarks</Label>
                <p className="p-3 rounded-xl bg-muted/20 border border-border/40 text-muted-foreground text-xs leading-relaxed">
                  {inspectingTask.proofText}
                </p>
              </div>
            )}

            {inspectingTask?.proofUrl && (
              <div className="pt-2">
                <Button asChild size="sm" variant="outline" className="w-full rounded-xl text-xs gap-1.5">
                  <a href={inspectingTask.proofUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" /> Open Verification Attachment
                  </a>
                </Button>
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setInspectingTask(null)}
              className="rounded-xl text-xs w-full"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. REJECT MODAL                                               */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!rejectModalTask} onOpenChange={(open) => !open && setRejectModalTask(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Return Task Submission
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide feedback for {rejectModalTask?.assignedToName} explaining why this task submission was returned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="rejectReasonNotes" className="text-xs font-semibold">
              Feedback / Reason
            </Label>
            <Textarea
              id="rejectReasonNotes"
              placeholder="e.g. Please update the student evaluation sheet before final sign-off."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              className="rounded-xl text-xs"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setRejectModalTask(null)}
              disabled={isProcessing}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={isProcessing}
              className="rounded-xl text-xs"
            >
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm Return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 6. ASSIGN FACULTY MODAL (COLLISION PROTECTED)                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!assigningTask} onOpenChange={(open) => !open && setAssigningTask(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" /> Assign Task to Faculty
            </DialogTitle>
            <DialogDescription className="text-xs">
              Assign "{assigningTask?.title}" (+{assigningTask?.creditValue.toFixed(1)} WORK) with collision protection.
            </DialogDescription>
          </DialogHeader>

          {assignError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{assignError}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select Faculty Member</Label>
              <Select value={assignFacultyId} onValueChange={setAssignFacultyId}>
                <SelectTrigger className="rounded-xl text-xs">
                  <SelectValue placeholder="Select faculty member" />
                </SelectTrigger>
                <SelectContent>
                  {facultyMembers.map((fac) => (
                    <SelectItem key={fac.id} value={fac.id} className="text-xs">
                      {fac.name} {fac.designation ? `(${fac.designation})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Scheduled Date / Deadline</Label>
              <Input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setAssigningTask(null)}
              disabled={isAssigning}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleConfirmAssign}
              disabled={isAssigning || !assignFacultyId}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90"
            >
              {isAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
              Confirm Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
