"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Users,
  Coins,
  FileCheck,
  Loader2,
  Sparkles,
  Search,
  Check,
  X,
  FileText,
  Clock,
  Filter,
  Layers,
  ArrowRight,
  ListTodo,
  UserCheck,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface TaskSalaryItem {
  id: string
  title: string
  facultyId: string
  facultyName: string
  facultyDesignation?: string
  facultyEmail?: string
  category: string
  creditValue: number
  completedAt: string
  status: string
  verificationMode?: string
  description?: string
  proofUrl?: string
  proofText?: string
}

export interface FacultySalaryProfile {
  id: string
  name: string
  email: string
  designation?: string
  progress_percentage: number
  earned_credits: number
  target_credits: number
  quality_score: number
  attendance_logged_count: number
  approved_leaves_count: number
  has_active_loan: boolean
  org_unit_name: string
  status: string
  endorsed?: boolean
}

export type PeriodFilter = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "all" | "custom"

interface HODSalaryApprovalConsoleProps {
  orgId: string
  leadUserId: string
  members: FacultySalaryProfile[]
  tasks?: TaskSalaryItem[]
  deptName?: string
}

export function HODSalaryApprovalConsole({
  orgId,
  leadUserId,
  members: initialMembers,
  tasks: initialTasks = [],
  deptName = "Department",
}: HODSalaryApprovalConsoleProps) {
  const router = useRouter()

  // Tab State
  const [activeTab, setActiveTab] = useState<"taskwise" | "facultywise">("taskwise")

  // Data State
  const [members, setMembers] = useState<FacultySalaryProfile[]>(initialMembers)
  const [tasks, setTasks] = useState<TaskSalaryItem[]>(initialTasks)

  // Periodical Filter State
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("this_month")
  const [customStartDate, setCustomStartDate] = useState("")
  const [customEndDate, setCustomEndDate] = useState("")

  // Search & Task status subfilter
  const [searchQuery, setSearchQuery] = useState("")
  const [taskStatusFilter, setTaskStatusFilter] = useState<"ALL" | "PENDING" | "APPROVED" | "CLOSED">("ALL")

  // Selection & Modal States
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [selectedFacultyIds, setSelectedFacultyIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Proof Inspection Modal
  const [inspectingTask, setInspectingTask] = useState<TaskSalaryItem | null>(null)
  const [rejectModalTask, setRejectModalTask] = useState<TaskSalaryItem | null>(null)
  const [rejectReason, setRejectReason] = useState("")

  // Helper date filtering logic
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
      case "last_week": {
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return itemDate >= twoWeeksAgo && itemDate < oneWeekAgo
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

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Period filter
      if (!isDateInPeriod(t.completedAt)) return false

      // Status filter
      if (taskStatusFilter === "PENDING") {
        if (!["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW", "ASSIGNED", "IN_PROGRESS"].includes(t.status))
          return false
      } else if (taskStatusFilter === "APPROVED") {
        if (!["LEAD_SIGNED", "APPROVED", "PEER_APPROVED"].includes(t.status)) return false
      } else if (taskStatusFilter === "CLOSED") {
        if (t.status !== "CLOSED") return false
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = t.title.toLowerCase().includes(q)
        const matchesFaculty = t.facultyName.toLowerCase().includes(q)
        const matchesCat = t.category.toLowerCase().includes(q)
        if (!matchesTitle && !matchesFaculty && !matchesCat) return false
      }

      return true
    })
  }, [tasks, periodFilter, customStartDate, customEndDate, taskStatusFilter, searchQuery])

  // Filtered Faculty
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      if (!searchQuery.trim()) return true
      const q = searchQuery.toLowerCase()
      return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
    })
  }, [members, searchQuery])

  // Summary counts for TaskWise
  const taskSummary = useMemo(() => {
    const total = filteredTasks.length
    const pending = filteredTasks.filter((t) =>
      ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"].includes(t.status)
    ).length
    const approved = filteredTasks.filter((t) =>
      ["LEAD_SIGNED", "APPROVED", "CLOSED"].includes(t.status)
    ).length
    const totalCredits = filteredTasks.reduce((acc, t) => acc + t.creditValue, 0)
    return { total, pending, approved, totalCredits }
  }, [filteredTasks])

  // Summary counts for FacultyWise
  const facultySummary = useMemo(() => {
    const total = filteredMembers.length
    const eligible = filteredMembers.filter((m) => m.progress_percentage >= 85).length
    const totalTokens = filteredMembers.reduce((acc, m) => acc + m.earned_credits, 0)
    const avgProgress = total > 0 ? Math.round(filteredMembers.reduce((acc, m) => acc + m.progress_percentage, 0) / total) : 0
    return { total, eligible, totalTokens, avgProgress }
  }, [filteredMembers])

  // ─────────────────────────────────────────────────────────────
  // Action Handlers
  // ─────────────────────────────────────────────────────────────

  // Batch task selection
  const handleSelectAllTasks = (checked: boolean) => {
    if (checked) {
      const pendingIds = filteredTasks
        .filter((t) => ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"].includes(t.status))
        .map((t) => t.id)
      setSelectedTaskIds(pendingIds)
    } else {
      setSelectedTaskIds([])
    }
  }

  const handleToggleTask = (id: string) => {
    setSelectedTaskIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  // Single / Batch Task Approve
  const handleApproveTasks = async (taskIds: string[]) => {
    if (taskIds.length === 0) return
    setIsProcessing(true)
    setFeedback(null)

    try {
      // Execute approvals in parallel or batch
      await Promise.all(
        taskIds.map((id) =>
          fetch("/api/lead/approve-proof", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId: id, approverUserId: leadUserId }),
          })
        )
      )

      setTasks((prev) =>
        prev.map((t) => (taskIds.includes(t.id) ? { ...t, status: "LEAD_SIGNED" } : t))
      )
      setSelectedTaskIds((prev) => prev.filter((id) => !taskIds.includes(id)))

      setFeedback({
        type: "success",
        text: `Successfully approved & signed off ${taskIds.length} task(s) for salary credits.`,
      })
      router.refresh()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to approve tasks." })
    } finally {
      setIsProcessing(false)
    }
  }

  // Task Reject
  const handleConfirmRejectTask = async () => {
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
      setFeedback({ type: "success", text: "Task submission rejected and returned to faculty member." })
      router.refresh()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to reject task." })
    } finally {
      setIsProcessing(false)
    }
  }

  // Faculty batch endorsement
  const handleSelectAllEligibleFaculty = (checked: boolean) => {
    if (checked) {
      const eligibleIds = filteredMembers.filter((m) => m.progress_percentage >= 85).map((m) => m.id)
      setSelectedFacultyIds(eligibleIds)
    } else {
      setSelectedFacultyIds([])
    }
  }

  const handleToggleFaculty = (id: string) => {
    setSelectedFacultyIds((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  const handleEndorseFacultySalary = async (ids: string[]) => {
    if (ids.length === 0) return
    setIsProcessing(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/lead/endorse-salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberIds: ids, action: "ENDORSE" }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to endorse faculty salary claims.")
      }

      setMembers((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, endorsed: true } : m))
      )
      setSelectedFacultyIds((prev) => prev.filter((id) => !ids.includes(id)))
      setFeedback({
        type: "success",
        text: data.message || `Endorsed ${ids.length} faculty salary claims for finance release.`,
      })
      router.refresh()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Failed to endorse salary." })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Header with View Toggle & Period Filter                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-2xl border border-muted/80 bg-background/60 backdrop-blur-xs shadow-2xs">
        {/* Left: View Tabs (TaskWise vs FacultyWise) */}
        <div className="flex items-center gap-2">
          <div className="flex bg-secondary/50 p-1 rounded-xl border border-secondary shadow-2xs">
            <button
              onClick={() => {
                setActiveTab("taskwise")
                setSelectedTaskIds([])
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all font-medium ${
                activeTab === "taskwise"
                  ? "bg-background text-primary shadow-3xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <ListTodo className="h-3.5 w-3.5" />
              TaskWise View ({tasks.length})
            </button>

            <button
              onClick={() => {
                setActiveTab("facultywise")
                setSelectedFacultyIds([])
              }}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all font-medium ${
                activeTab === "facultywise"
                  ? "bg-background text-primary shadow-3xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              Faculty Wise View ({members.length})
            </button>
          </div>
        </div>

        {/* Right: Periodical Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Period:
          </span>
          {(
            [
              { id: "today", label: "Today (Day-wise)" },
              { id: "yesterday", label: "Yesterday" },
              { id: "this_week", label: "This Week" },
              { id: "this_month", label: "This Month" },
              { id: "all", label: "All Time" },
              { id: "custom", label: "Custom Range" },
            ] as const
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodFilter(p.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                periodFilter === p.id
                  ? "bg-primary text-primary-foreground shadow-3xs"
                  : "bg-secondary/40 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker row if active */}
      {periodFilter === "custom" && (
        <Card className="p-3 rounded-xl border-dashed bg-muted/20 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <Label htmlFor="startDate" className="text-xs text-muted-foreground">From:</Label>
            <Input
              id="startDate"
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-8 rounded-lg text-xs w-36"
            />
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Label htmlFor="endDate" className="text-xs text-muted-foreground">To:</Label>
            <Input
              id="endDate"
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-8 rounded-lg text-xs w-36"
            />
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setCustomStartDate("")
              setCustomEndDate("")
            }}
            className="h-8 text-xs text-muted-foreground"
          >
            Clear Dates
          </Button>
        </Card>
      )}

      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center justify-between gap-2 shadow-2xs ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
              : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. SUMMARY METRICS (DYNAMIC FOR TAB & PERIOD)                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "taskwise" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Filtered Tasks
              </CardTitle>
              <ListTodo className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{taskSummary.total}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">In selected period</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Pending Verification
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {taskSummary.pending}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Awaiting HOD sign-off</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Approved & Signed
              </CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {taskSummary.approved}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Approved for salary release</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Total Credit Value
              </CardTitle>
              <Coins className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
                {taskSummary.totalCredits.toLocaleString()}{" "}
                <span className="text-xs font-normal text-muted-foreground">WORK</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Claimable reward volume</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Total Faculty
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{facultySummary.total}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{deptName} members</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Eligible (85%+ Target)
              </CardTitle>
              <ShieldCheck className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {facultySummary.eligible}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Ready for Finance release</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Average Progress
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-sky-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{facultySummary.avgProgress}%</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Department aggregate</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase">
                Earned Tokens Pool
              </CardTitle>
              <Coins className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {facultySummary.totalTokens.toLocaleString()}{" "}
                <span className="text-xs font-normal text-muted-foreground">WORK</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Total faculty balances</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. VIEW 1: TASKWISE VIEW                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "taskwise" && (
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <CardTitle className="text-lg font-light flex items-center gap-2">
                <ListTodo className="h-5 w-5 text-primary" />
                TaskWise Salary Verification & Approval Queue
              </CardTitle>
              <CardDescription className="font-light text-xs mt-0.5">
                Inspect individual lecture sessions and completed deliverable tasks to authorize token allocations.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Task Status Filters */}
              <div className="flex bg-secondary/60 p-0.5 rounded-xl border border-secondary text-xs">
                {(["ALL", "PENDING", "APPROVED", "CLOSED"] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTaskStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                      taskStatusFilter === st
                        ? "bg-background text-foreground shadow-3xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {st === "ALL" ? "All" : st === "PENDING" ? "Pending Sign-off" : st === "APPROVED" ? "Approved" : "Closed"}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search task / faculty..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 rounded-xl text-xs bg-background/80"
                />
              </div>

              {/* Batch Action */}
              {selectedTaskIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleApproveTasks(selectedTaskIds)}
                  disabled={isProcessing}
                  className="rounded-xl text-xs gap-1.5 shadow-xs"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  Approve Selected ({selectedTaskIds.length})
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedTaskIds.length > 0 &&
                        selectedTaskIds.length ===
                          filteredTasks.filter((t) =>
                            ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"].includes(t.status)
                          ).length
                      }
                      onChange={(e) => handleSelectAllTasks(e.target.checked)}
                      className="rounded border-muted cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="py-3 font-medium">Task & Faculty</TableHead>
                  <TableHead className="py-3 font-medium">Category</TableHead>
                  <TableHead className="py-3 font-medium">Date & Time</TableHead>
                  <TableHead className="py-3 font-medium">Credit Value</TableHead>
                  <TableHead className="py-3 font-medium">Status</TableHead>
                  <TableHead className="py-3 font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-light text-xs">
                      No tasks found for the selected period and status filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => {
                    const isPending = [
                      "VERIFICATION_PENDING",
                      "PENDING_VERIFICATION",
                      "SUBMITTED",
                      "IN_REVIEW",
                    ].includes(task.status)

                    const isApproved = ["LEAD_SIGNED", "APPROVED", "CLOSED"].includes(task.status)

                    return (
                      <TableRow key={task.id} className="hover:bg-muted/30 text-xs transition-colors">
                        <TableCell>
                          {isPending ? (
                            <input
                              type="checkbox"
                              checked={selectedTaskIds.includes(task.id)}
                              onChange={() => handleToggleTask(task.id)}
                              className="rounded border-muted cursor-pointer"
                            />
                          ) : (
                            <span className="text-muted-foreground/40">•</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          <div>
                            <p className="font-medium text-foreground/90">{task.title}</p>
                            <p className="text-[11px] text-muted-foreground font-light">
                              {task.facultyName} {task.facultyDesignation ? `• ${task.facultyDesignation}` : ""}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <Badge variant="outline" className="text-[10px] font-normal uppercase py-0">
                            {task.category}
                          </Badge>
                        </TableCell>

                        <TableCell className="py-3 text-muted-foreground font-light">
                          {task.completedAt
                            ? new Date(task.completedAt).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "N/A"}
                        </TableCell>

                        <TableCell className="py-3 font-semibold text-primary font-mono">
                          {task.creditValue} WORK
                        </TableCell>

                        <TableCell className="py-3">
                          {isApproved ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                              <CheckCircle2 className="h-3 w-3" /> Signed Off
                            </span>
                          ) : isPending ? (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                              <Clock className="h-3 w-3" /> Pending Review
                            </span>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {task.status}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {(task.proofUrl || task.proofText || task.description) && (
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setInspectingTask(task)}
                                className="h-7 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                <FileText className="h-3 w-3 mr-1" /> Proof
                              </Button>
                            )}

                            {isPending && (
                              <>
                                <Button
                                  size="xs"
                                  variant="outline"
                                  onClick={() => setRejectModalTask(task)}
                                  disabled={isProcessing}
                                  className="h-7 text-xs text-destructive border-destructive/25 hover:bg-destructive/10"
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="xs"
                                  onClick={() => handleApproveTasks([task.id])}
                                  disabled={isProcessing}
                                  className="h-7 text-xs shadow-3xs"
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
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 4. VIEW 2: FACULTY WISE VIEW                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === "facultywise" && (
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b">
            <div>
              <CardTitle className="text-lg font-light flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Faculty Wise Salary Release Endorsement
              </CardTitle>
              <CardDescription className="font-light text-xs mt-0.5">
                Endorse teaching faculty meeting the 85% cryptographic verification threshold for institutional finance payout.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2.5">
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search faculty name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8 rounded-xl text-xs bg-background/80"
                />
              </div>

              {selectedFacultyIds.length > 0 && (
                <Button
                  size="sm"
                  onClick={() => handleEndorseFacultySalary(selectedFacultyIds)}
                  disabled={isProcessing}
                  className="rounded-xl text-xs gap-1.5 shadow-xs"
                >
                  {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Endorse Selected ({selectedFacultyIds.length})
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedFacultyIds.length > 0 &&
                        selectedFacultyIds.length === filteredMembers.filter((m) => m.progress_percentage >= 85).length
                      }
                      onChange={(e) => handleSelectAllEligibleFaculty(e.target.checked)}
                      className="rounded border-muted cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="py-3 font-medium">Faculty Member</TableHead>
                  <TableHead className="py-3 font-medium">Progress against Target (85% Req)</TableHead>
                  <TableHead className="py-3 font-medium">Earned Tokens</TableHead>
                  <TableHead className="py-3 font-medium">Attendance Logs</TableHead>
                  <TableHead className="py-3 font-medium">Release Status</TableHead>
                  <TableHead className="py-3 font-medium text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground font-light text-xs">
                      No faculty members found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => {
                    const isEligible = member.progress_percentage >= 85

                    return (
                      <TableRow key={member.id} className="hover:bg-muted/30 text-xs transition-colors">
                        <TableCell>
                          {isEligible ? (
                            <input
                              type="checkbox"
                              checked={selectedFacultyIds.includes(member.id)}
                              onChange={() => handleToggleFaculty(member.id)}
                              className="rounded border-muted cursor-pointer"
                            />
                          ) : (
                            <span className="text-muted-foreground/40">•</span>
                          )}
                        </TableCell>

                        <TableCell className="py-3">
                          <div>
                            <p className="font-medium text-foreground/90">{member.name}</p>
                            <p className="text-[11px] text-muted-foreground font-light">
                              {member.designation || "Faculty Member"} • {member.email}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="py-3">
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-mono font-medium">{member.progress_percentage}%</span>
                            <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  isEligible
                                    ? "bg-green-500"
                                    : member.progress_percentage >= 70
                                    ? "bg-amber-500"
                                    : "bg-destructive"
                                }`}
                                style={{ width: `${Math.min(100, member.progress_percentage)}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              ({member.earned_credits}/{member.target_credits})
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="py-3 font-semibold text-primary font-mono">
                          {member.earned_credits} WORK
                        </TableCell>

                        <TableCell className="py-3 text-muted-foreground font-mono">
                          {member.attendance_logged_count} sessions
                        </TableCell>

                        <TableCell className="py-3">
                          {member.endorsed ? (
                            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                              ✓ Endorsed to Finance
                            </Badge>
                          ) : isEligible ? (
                            <Badge variant="outline" className="bg-sky-500/10 text-sky-600 border-sky-500/30 text-[10px]">
                              Eligible for Release
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground text-[10px]">
                              Threshold Incomplete (&lt;85%)
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {isEligible && !member.endorsed && (
                              <Button
                                size="xs"
                                onClick={() => handleEndorseFacultySalary([member.id])}
                                disabled={isProcessing}
                                className="h-7 text-xs shadow-3xs"
                              >
                                Endorse Release
                              </Button>
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
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 5. PROOF INSPECTION MODAL                                     */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!inspectingTask} onOpenChange={(open) => !open && setInspectingTask(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-light flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-primary" />
              Submission Proof Details
            </DialogTitle>
            <DialogDescription className="font-light text-xs">
              {inspectingTask?.title} — submitted by {inspectingTask?.facultyName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="p-3 rounded-xl bg-secondary/40 border border-secondary space-y-1.5">
              <div className="flex justify-between text-muted-foreground">
                <span>Reward Value:</span>
                <span className="font-semibold text-primary font-mono">{inspectingTask?.creditValue} WORK</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Category:</span>
                <span className="font-medium text-foreground">{inspectingTask?.category}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Submitted At:</span>
                <span>
                  {inspectingTask?.completedAt
                    ? new Date(inspectingTask.completedAt).toLocaleString()
                    : "N/A"}
                </span>
              </div>
            </div>

            {inspectingTask?.description && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Task Description</Label>
                <p className="p-2.5 rounded-lg bg-muted/30 text-muted-foreground text-xs font-light">
                  {inspectingTask.description}
                </p>
              </div>
            )}

            {inspectingTask?.proofText && (
              <div className="space-y-1">
                <Label className="text-xs font-medium">Submitted Notes / Summary</Label>
                <p className="p-2.5 rounded-lg bg-muted/30 text-muted-foreground text-xs font-light">
                  {inspectingTask.proofText}
                </p>
              </div>
            )}

            {inspectingTask?.proofUrl && (
              <div className="pt-2">
                <Button asChild size="sm" variant="outline" className="w-full rounded-xl text-xs gap-1.5">
                  <a href={inspectingTask.proofUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" /> Open Submitted Attachment
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
      {/* 6. REJECT TASK MODAL                                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Dialog open={!!rejectModalTask} onOpenChange={(open) => !open && setRejectModalTask(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-light text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Reject Task Submission
            </DialogTitle>
            <DialogDescription className="font-light text-xs">
              Provide feedback for {rejectModalTask?.facultyName} explaining why this task submission was returned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Label htmlFor="rejectReason" className="text-xs">
              Reason for Rejection
            </Label>
            <Textarea
              id="rejectReason"
              placeholder="e.g. Please attach the student attendance sheet or signed verification form."
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
              onClick={handleConfirmRejectTask}
              disabled={isProcessing}
              className="rounded-xl text-xs"
            >
              {isProcessing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
