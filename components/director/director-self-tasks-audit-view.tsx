"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
  ShieldAlert,
  ShieldCheck,
  Building2,
  Users,
  Coins,
  CheckCircle2,
  AlertTriangle,
  Search,
  ExternalLink,
  Eye,
  Calendar,
  Layers,
  Sparkles,
  BarChart3,
  Download,
  FileSpreadsheet,
} from "lucide-react"
import { SelfTaskItem, DirectorSelfTaskAuditSummary } from "@/lib/workledger/self-tasks"

interface DirectorSelfTasksAuditViewProps {
  orgId: string
  summary: DirectorSelfTaskAuditSummary
  tasks: SelfTaskItem[]
}

export function DirectorSelfTasksAuditView({
  orgId,
  summary,
  tasks,
}: DirectorSelfTasksAuditViewProps) {
  const [activeTab, setActiveTab] = useState<"audit_register" | "faculty_report">("audit_register")
  const [searchQuery, setSearchQuery] = useState("")
  const [deptFilter, setDeptFilter] = useState("ALL")
  const [statusFilter, setStatusFilter] = useState("ALL")
  const [inspectingTask, setInspectingTask] = useState<SelfTaskItem | null>(null)

  const departments = Object.entries(summary.departmentBreakdown).map(([id, d]) => ({
    id,
    name: d.departmentName,
  }))

  const filteredTasks = tasks.filter((t) => {
    if (deptFilter !== "ALL" && t.departmentId !== deptFilter) return false
    if (statusFilter !== "ALL" && t.taskStatus !== statusFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchTitle = t.title.toLowerCase().includes(q)
      const matchFac = t.facultyName.toLowerCase().includes(q)
      const matchDept = t.departmentName.toLowerCase().includes(q)
      const matchArea = t.interestArea.toLowerCase().includes(q)
      if (!matchTitle && !matchFac && !matchDept && !matchArea) return false
    }
    return true
  })

  // Aggregate Faculty Self-Task Performance Report
  const facultyReportMap = new Map<
    string,
    {
      facultyId: string
      facultyName: string
      facultyEmail: string
      departmentId: string
      departmentName: string
      totalProposed: number
      pendingReview: number
      inProgress: number
      completed: number
      tokensEarned: number
      areas: Set<string>
    }
  >()

  tasks.forEach((t) => {
    const key = t.facultyId || t.facultyEmail || t.facultyName
    const existing = facultyReportMap.get(key) || {
      facultyId: t.facultyId,
      facultyName: t.facultyName,
      facultyEmail: t.facultyEmail,
      departmentId: t.departmentId,
      departmentName: t.departmentName,
      totalProposed: 0,
      pendingReview: 0,
      inProgress: 0,
      completed: 0,
      tokensEarned: 0,
      areas: new Set<string>(),
    }

    existing.totalProposed += 1
    if (t.taskStatus === "DRAFT" || t.proposalStatus === "PENDING") existing.pendingReview += 1
    if (t.taskStatus === "ASSIGNED" || t.taskStatus === "VERIFICATION_PENDING") existing.inProgress += 1
    if (t.taskStatus === "LEAD_SIGNED" || t.taskStatus === "CLOSED") {
      existing.completed += 1
      existing.tokensEarned += t.approvedCredits
    }
    if (t.interestArea) existing.areas.add(t.interestArea)

    facultyReportMap.set(key, existing)
  })

  const allFacultyReports = Array.from(facultyReportMap.values()).sort(
    (a, b) => b.tokensEarned - a.tokensEarned || b.totalProposed - a.totalProposed
  )

  const filteredFacultyReports = allFacultyReports.filter((r) => {
    if (deptFilter !== "ALL" && r.departmentId !== deptFilter) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchName = r.facultyName.toLowerCase().includes(q)
      const matchEmail = r.facultyEmail.toLowerCase().includes(q)
      const matchDept = r.departmentName.toLowerCase().includes(q)
      if (!matchName && !matchEmail && !matchDept) return false
    }
    return true
  })

  const downloadFacultyReportCSV = () => {
    const headers = [
      "Faculty Name",
      "Email",
      "Department",
      "Total Initiatives Proposed",
      "Under Review",
      "In Progress",
      "Verified & Completed",
      "Tokens Earned (WORK)",
      "Completion Rate %",
      "Areas of Interest",
    ]
    const rows = filteredFacultyReports.map((r) => [
      `"${r.facultyName.replace(/"/g, '""')}"`,
      `"${r.facultyEmail.replace(/"/g, '""')}"`,
      `"${r.departmentName.replace(/"/g, '""')}"`,
      r.totalProposed,
      r.pendingReview,
      r.inProgress,
      r.completed,
      r.tokensEarned.toFixed(2),
      r.totalProposed > 0 ? `${Math.round((r.completed / r.totalProposed) * 100)}%` : "0%",
      `"${Array.from(r.areas).join(", ")}"`,
    ])

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n")
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement("a")
    link.setAttribute("href", encodedUri)
    link.setAttribute("download", `faculty_self_tasks_report_${new Date().toISOString().split("T")[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-card via-card/90 to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Executive Institutional Governance</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
            Self-Tasking Anti-Favoritism & Transparency Audit
          </h1>
          <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
            Monitor and audit all faculty self-proposed initiatives across every department.
            Verify that HOD credit approvals adhere to fair institutional standards and that all rewarded tokens correspond to validated deliverables.
          </p>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50">
          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Total Proposals Org-Wide
            </span>
            <span className="text-xl font-black text-foreground">{summary.totalProposals}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider block">
              Disbursed Tokens
            </span>
            <span className="text-xl font-black text-emerald-400">
              +{summary.totalTokensDisbursed.toFixed(1)} <span className="text-xs font-semibold">WORK</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Avg Reward / Completed Task
            </span>
            <span className="text-xl font-black text-foreground">
              {summary.averageTokensPerCompletedTask.toFixed(1)} <span className="text-xs font-semibold text-muted-foreground">WORK</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20">
            <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block">
              Flagged For Audit Review
            </span>
            <span className="text-xl font-black text-amber-400">{summary.flaggedTasks.length}</span>
          </div>
        </div>
      </div>

      {/* 2. ANTI-FAVORITISM DEPARTMENT ALLOCATION DISTRIBUTION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> Department Allocation Distribution
          </h2>
          <span className="text-xs text-muted-foreground">Prevents disproportionate credit allocation across branches</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {Object.entries(summary.departmentBreakdown).map(([id, dept]) => (
            <Card key={id} className="rounded-2xl border-border/60 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-foreground truncate max-w-[160px]">
                  {dept.departmentName}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {dept.facultyCount} faculty
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                <span className="text-muted-foreground">Disbursed Volume:</span>
                <strong className="text-emerald-400 font-extrabold">+{dept.tokensDisbursed.toFixed(1)} WORK</strong>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Completed Initiatives:</span>
                <span className="font-semibold text-foreground">{dept.completedTasks} of {dept.totalTasks}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. FLAGGED INITIATIVES ALERT */}
      {summary.flaggedTasks.length > 0 && (
        <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Transparency Audit Flags ({summary.flaggedTasks.length})</span>
          </div>
          <div className="space-y-2">
            {summary.flaggedTasks.slice(0, 3).map(({ task, reason }) => (
              <div key={task.id} className="p-3 rounded-xl bg-background/80 border border-amber-500/20 text-xs flex items-center justify-between gap-2">
                <div>
                  <strong className="text-foreground">{task.title}</strong>
                  <span className="text-[11px] text-muted-foreground ml-2">
                    ({task.facultyName} • {task.departmentName})
                  </span>
                  <p className="text-[11px] text-amber-300/90 mt-0.5">{reason}</p>
                </div>
                <Button size="xs" variant="outline" onClick={() => setInspectingTask(task)} className="rounded-xl text-xs shrink-0">
                  Inspect Trail
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* VIEW MODE TABS & REPORT EXPORT */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="inline-flex p-1 rounded-2xl bg-muted/50 border border-border/60">
          <button
            onClick={() => setActiveTab("audit_register")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "audit_register"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Initiatives Register ({filteredTasks.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("faculty_report")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              activeTab === "faculty_report"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Faculty Initiatives Report ({filteredFacultyReports.length})</span>
          </button>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={downloadFacultyReportCSV}
          className="rounded-xl text-xs gap-1.5 font-bold shadow-2xs"
        >
          <Download className="h-3.5 w-3.5 text-primary" />
          <span>Export Report (CSV)</span>
        </Button>
      </div>

      {/* 4. SEARCH & FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search faculty, initiative, or dept..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 rounded-xl text-xs"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="rounded-xl text-xs w-44">
              <SelectValue placeholder="Department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">All Departments</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id} className="text-xs">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeTab === "audit_register" && (
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl text-xs w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All States</SelectItem>
                <SelectItem value="LEAD_SIGNED" className="text-xs">Verified & Credited</SelectItem>
                <SelectItem value="VERIFICATION_PENDING" className="text-xs">Under Verification</SelectItem>
                <SelectItem value="ASSIGNED" className="text-xs">In Progress</SelectItem>
                <SelectItem value="DRAFT" className="text-xs">Proposal Pending</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* 5. AUDIT ROSTER TABLE OR FACULTY REPORT TABLE */}
      {activeTab === "audit_register" ? (
        <Card className="rounded-2xl border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                <TableHead className="text-xs font-bold">Department</TableHead>
                <TableHead className="text-xs font-bold">Initiative Title</TableHead>
                <TableHead className="text-xs font-bold">Credits</TableHead>
                <TableHead className="text-xs font-bold">HOD Approver</TableHead>
                <TableHead className="text-xs font-bold">State</TableHead>
                <TableHead className="text-xs font-bold text-right">Audit Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                    No self-tasks found matching filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredTasks.map((task) => (
                  <TableRow key={task.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-xs">
                      <strong className="text-foreground block">{task.facultyName}</strong>
                      <span className="text-[10px] text-muted-foreground">{task.facultyEmail}</span>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {task.departmentName}
                    </TableCell>

                    <TableCell className="text-xs max-w-xs">
                      <div className="font-semibold text-foreground truncate">{task.title}</div>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 mt-0.5">
                        {task.interestArea}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-xs font-bold text-emerald-400 whitespace-nowrap">
                      +{task.approvedCredits.toFixed(1)} WORK
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {task.hodApprovedByName || "—"}
                    </TableCell>

                    <TableCell className="text-xs whitespace-nowrap">
                      {task.taskStatus === "LEAD_SIGNED" || task.taskStatus === "CLOSED" ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[9px] font-bold">
                          ✓ Verified
                        </Badge>
                      ) : task.taskStatus === "VERIFICATION_PENDING" ? (
                        <Badge variant="outline" className="bg-blue-500/15 text-blue-400 text-[9px]">
                          Reviewing Proof
                        </Badge>
                      ) : task.taskStatus === "ASSIGNED" ? (
                        <Badge variant="outline" className="bg-primary/15 text-primary text-[9px]">
                          In Progress
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[9px]">
                          {task.taskStatus}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell className="text-right whitespace-nowrap">
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={() => setInspectingTask(task)}
                        className="rounded-xl text-xs gap-1"
                      >
                        <Eye className="h-3 w-3" /> Inspect
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="rounded-2xl border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                <TableHead className="text-xs font-bold">Department</TableHead>
                <TableHead className="text-xs font-bold text-center">Proposed</TableHead>
                <TableHead className="text-xs font-bold text-center">Under Review</TableHead>
                <TableHead className="text-xs font-bold text-center">In Progress</TableHead>
                <TableHead className="text-xs font-bold text-center">Verified</TableHead>
                <TableHead className="text-xs font-bold text-right">Tokens Earned</TableHead>
                <TableHead className="text-xs font-bold">Primary Interests</TableHead>
                <TableHead className="text-xs font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFacultyReports.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-muted-foreground text-xs">
                    No faculty initiatives found matching filter criteria.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFacultyReports.map((report) => {
                  const completionRate =
                    report.totalProposed > 0
                      ? Math.round((report.completed / report.totalProposed) * 100)
                      : 0
                  return (
                    <TableRow key={report.facultyId} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs">
                        <strong className="text-foreground block">{report.facultyName}</strong>
                        <span className="text-[10px] text-muted-foreground font-mono">{report.facultyEmail}</span>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {report.departmentName}
                      </TableCell>

                      <TableCell className="text-xs font-bold text-center">
                        {report.totalProposed}
                      </TableCell>

                      <TableCell className="text-xs text-center text-amber-500 font-semibold">
                        {report.pendingReview}
                      </TableCell>

                      <TableCell className="text-xs text-center text-sky-500 font-semibold">
                        {report.inProgress}
                      </TableCell>

                      <TableCell className="text-xs text-center text-emerald-500 font-bold">
                        {report.completed}
                      </TableCell>

                      <TableCell className="text-xs font-bold text-right text-emerald-400 font-mono">
                        +{report.tokensEarned.toFixed(1)} WORK
                      </TableCell>

                      <TableCell className="text-xs max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {Array.from(report.areas).slice(0, 2).map((a) => (
                            <Badge key={a} variant="secondary" className="text-[9px] px-1.5 py-0">
                              {a}
                            </Badge>
                          ))}
                          {report.areas.size > 2 && (
                            <span className="text-[10px] text-muted-foreground">
                              +{report.areas.size - 2} more
                            </span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right whitespace-nowrap">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => {
                            setSearchQuery(report.facultyName)
                            setActiveTab("audit_register")
                          }}
                          className="rounded-xl text-xs gap-1 hover:bg-primary/10 hover:text-primary"
                        >
                          View Tasks ({report.totalProposed})
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* 6. INSPECTION AUDIT TRAIL MODAL */}
      <Dialog open={!!inspectingTask} onOpenChange={(open) => !open && setInspectingTask(null)}>
        <DialogContent className="sm:max-w-xl rounded-3xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <ShieldCheck className="h-5 w-5 text-primary" /> Full Audit Trail: {inspectingTask?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspectingTask?.facultyName} • {inspectingTask?.departmentName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Rationale */}
            <div className="p-3 rounded-2xl bg-muted/40 border space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Proposal Objectives</span>
              <p className="text-foreground text-xs leading-relaxed">{inspectingTask?.description}</p>
            </div>

            {/* Lifecycle Stages */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-2xl bg-background/80 border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">1. Proposal Approval</span>
                <div>Status: <strong>{inspectingTask?.proposalStatus}</strong></div>
                <div>HOD Approver: <strong>{inspectingTask?.hodApprovedByName || "—"}</strong></div>
                <div>Reward: <strong className="text-emerald-400">+{inspectingTask?.approvedCredits} WORK</strong></div>
                {inspectingTask?.hodApprovalComment && (
                  <p className="text-[11px] text-muted-foreground italic mt-1">"{inspectingTask.hodApprovalComment}"</p>
                )}
              </div>

              <div className="p-3 rounded-2xl bg-background/80 border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">2. Verification & Deliverables</span>
                <div>State: <strong>{inspectingTask?.taskStatus}</strong></div>
                <div>HOD Signer: <strong>{inspectingTask?.hodVerifiedByName || "—"}</strong></div>
                {inspectingTask?.proofUrl && (
                  <a
                    href={inspectingTask.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline font-bold text-xs pt-1 block"
                  >
                    <ExternalLink className="h-3 w-3" /> View Submitted Proof Document
                  </a>
                )}
              </div>
            </div>

            {inspectingTask?.proofDescription && (
              <div className="p-3 rounded-2xl bg-muted/40 border space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">Submitted Deliverables Summary</span>
                <p className="text-muted-foreground text-xs leading-relaxed">{inspectingTask.proofDescription}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInspectingTask(null)}
              className="rounded-xl text-xs"
            >
              Close Audit Trail
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
