"use client"

import { useState } from "react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  HeartHandshake,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  FileCheck,
  TrendingUp,
  Plus,
  Loader2,
  Users,
  Building2,
  Search,
  ExternalLink,
  ShieldCheck,
  Calendar,
  XCircle,
  Eye,
} from "lucide-react"
import {
  GeneralTaskTemplate,
  GeneralTaskLog,
  GeneralProductivitySummary,
  FacultyProductivityRecord,
  GeneralTaskCategory,
} from "@/lib/workledger/general-tasks"
import { useRouter } from "next/navigation"

interface DepartmentOption {
  id: string
  name: string
}

interface GeneralTasksManagerViewProps {
  orgId: string
  roleTitle: "Director" | "Department Head (HOD)" | "Department Admin"
  scopeName?: string
  summary: GeneralProductivitySummary
  facultyRoster: FacultyProductivityRecord[]
  pendingApprovals: GeneralTaskLog[]
  templates: GeneralTaskTemplate[]
  departments?: DepartmentOption[]
  currentDeptId?: string
}

export function GeneralTasksManagerView({
  orgId,
  roleTitle,
  scopeName = "Department",
  summary: initialSummary,
  facultyRoster: initialRoster,
  pendingApprovals: initialPending,
  templates: initialTemplates,
  departments = [],
  currentDeptId,
}: GeneralTasksManagerViewProps) {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<"productivity" | "approvals" | "catalog">("productivity")
  const [summary, setSummary] = useState<GeneralProductivitySummary>(initialSummary)
  const [facultyRoster, setFacultyRoster] = useState<FacultyProductivityRecord[]>(initialRoster)
  const [pendingApprovals, setPendingApprovals] = useState<GeneralTaskLog[]>(initialPending)
  const [templates, setTemplates] = useState<GeneralTaskTemplate[]>(initialTemplates)

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("")

  // Create Template Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newCategory, setNewCategory] = useState<GeneralTaskCategory>("COUNSELLING")
  const [newHourlyRate, setNewHourlyRate] = useState<number>(0.5)
  const [newDescription, setNewDescription] = useState("")
  const [newDeptId, setNewDeptId] = useState<string>(currentDeptId || "ALL")
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Detail Inspector Modal for a faculty member
  const [inspectingFaculty, setInspectingFaculty] = useState<FacultyProductivityRecord | null>(null)

  // Approval Processing
  const [processingLogId, setProcessingLogId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Filtered faculty roster
  const filteredRoster = facultyRoster.filter((fac) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      fac.facultyName.toLowerCase().includes(q) ||
      fac.facultyEmail.toLowerCase().includes(q) ||
      (fac.departmentName && fac.departmentName.toLowerCase().includes(q))
    )
  })

  // Create General Task Template
  const handleCreateTemplate = async () => {
    if (!newTitle.trim()) {
      setCreateError("Please enter a title for the general task.")
      return
    }

    setIsCreating(true)
    setCreateError(null)

    try {
      const res = await fetch("/api/tasks/general/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          generalCategory: newCategory,
          hourlyRate: newHourlyRate,
          orgUnitId: newDeptId === "ALL" ? null : newDeptId,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to create general task.")
      }

      setCreateSuccess(data.message)
      const createdTpl: GeneralTaskTemplate = {
        id: data.task.id,
        title: data.task.title,
        description: data.task.description,
        generalCategory: newCategory,
        hourlyRate: newHourlyRate,
        minDurationHours: 0.5,
        maxDurationHours: 8.0,
        orgUnitId: data.task.org_unit_id,
        orgUnitName:
          departments.find((d) => d.id === data.task.org_unit_id)?.name || "Organization Wide",
        status: "OPEN",
        createdByRole: roleTitle,
        createdAt: new Date().toISOString(),
      }
      setTemplates((prev) => [...prev, createdTpl])

      setTimeout(() => {
        setIsCreateOpen(false)
        setNewTitle("")
        setNewDescription("")
        setCreateSuccess(null)
        router.refresh()
      }, 1000)
    } catch (err: any) {
      setCreateError(err.message || "Failed to create task.")
    } finally {
      setIsCreating(false)
    }
  }

  // Approve or Reject a session log
  const handleDecision = async (logId: string, decision: "APPROVE" | "REJECT") => {
    setProcessingLogId(logId)
    setFeedback(null)

    try {
      const res = await fetch("/api/tasks/general/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logTaskId: logId,
          decision,
          comment:
            decision === "APPROVE"
              ? `Approved by ${roleTitle} for productivity accounting.`
              : `Declined by ${roleTitle}.`,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || `Failed to ${decision.toLowerCase()} session.`)
      }

      setFeedback({ type: "success", text: data.message })

      // Remove from pending approvals
      const targetLog = pendingApprovals.find((l) => l.id === logId)
      setPendingApprovals((prev) => prev.filter((l) => l.id !== logId))

      if (decision === "APPROVE" && targetLog) {
        // Update summary metrics
        setSummary((prev) => ({
          ...prev,
          totalTokensAwarded: Number((prev.totalTokensAwarded + targetLog.credits).toFixed(2)),
          totalSessionsCompleted: prev.totalSessionsCompleted + 1,
        }))

        // Update faculty roster record
        setFacultyRoster((prev) =>
          prev.map((rec) => {
            if (rec.facultyId === targetLog.facultyId) {
              return {
                ...rec,
                totalSessions: rec.totalSessions + 1,
                totalTokensEarned: Number((rec.totalTokensEarned + targetLog.credits).toFixed(2)),
                logs: rec.logs.map((l) =>
                  l.id === logId ? { ...l, status: "LEAD_SIGNED" } : l
                ),
              }
            }
            return rec
          })
        )
      }

      router.refresh()
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Operation failed." })
    } finally {
      setProcessingLogId(null)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-card via-card/90 to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{roleTitle} • Productivity Accounting & Governance</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              General Tasks & Productivity Ledger
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Oversee voluntary faculty productivity (Student Counselling, Remedial Mentorship, Laboratory Maintenance).
              Review submitted sessions, approve proportional token awards, and track departmental extracurricular output for institutional audits.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-2xl text-xs gap-2 bg-primary hover:bg-primary/90 font-bold px-4 py-2.5 shadow-sm"
            >
              <Plus className="h-4 w-4" /> Create General Task
            </Button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50">
          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Total Hours Logged
            </span>
            <span className="text-xl font-black text-foreground">
              {summary.totalHoursLogged} <span className="text-xs text-muted-foreground font-normal">hrs</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20">
            <span className="text-[10px] text-primary uppercase font-bold tracking-wider block">
              Tokens Distributed
            </span>
            <span className="text-xl font-black text-primary">
              +{summary.totalTokensAwarded.toFixed(2)} <span className="text-xs font-semibold">WORK</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Contributing Faculty
            </span>
            <span className="text-xl font-black text-foreground">
              {summary.activeFacultyCount} <span className="text-xs text-muted-foreground font-normal">members</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <span className="text-[10px] text-amber-300 uppercase font-bold tracking-wider block">
              Pending Approvals
            </span>
            <span className="text-xl font-black text-amber-400">
              {pendingApprovals.length} <span className="text-xs font-semibold">sessions</span>
            </span>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-2 ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
            <span className="font-semibold">{feedback.text}</span>
          </div>
          <Button size="xs" variant="ghost" onClick={() => setFeedback(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* 2. TABS: PRODUCTIVITY ROSTER, APPROVALS, CATALOG */}
      <Tabs value={activeTab} onValueChange={(val: any) => setActiveTab(val)} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList className="bg-muted/60 p-1 rounded-2xl">
            <TabsTrigger value="productivity" className="rounded-xl text-xs font-semibold gap-1.5">
              <Users className="h-3.5 w-3.5" /> Faculty Productivity Roster
            </TabsTrigger>
            <TabsTrigger value="approvals" className="rounded-xl text-xs font-semibold gap-1.5 relative">
              <FileCheck className="h-3.5 w-3.5" />
              <span>Pending Sign-Offs</span>
              {pendingApprovals.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-black text-[10px] font-black">
                  {pendingApprovals.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="catalog" className="rounded-xl text-xs font-semibold gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> General Task Templates ({templates.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "productivity" && (
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search faculty name or dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 rounded-xl text-xs"
              />
            </div>
          )}
        </div>

        {/* TAB 1: FACULTY PRODUCTIVITY ROSTER */}
        <TabsContent value="productivity" className="space-y-4">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                  <TableHead className="text-xs font-bold">Department</TableHead>
                  <TableHead className="text-xs font-bold text-center">Total Hours Logged</TableHead>
                  <TableHead className="text-xs font-bold text-center">Approved Sessions</TableHead>
                  <TableHead className="text-xs font-bold text-center">Tokens Disbursed</TableHead>
                  <TableHead className="text-xs font-bold">Last Activity</TableHead>
                  <TableHead className="text-xs font-bold text-right">Accounting Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoster.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-muted-foreground text-xs">
                      <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      No faculty have logged general task activities yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoster.map((fac) => (
                    <TableRow key={fac.facultyId} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs">
                        <strong className="text-foreground block">{fac.facultyName}</strong>
                        <span className="text-[11px] text-muted-foreground">{fac.facultyDesignation || fac.facultyEmail}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {fac.departmentName || scopeName}
                      </TableCell>
                      <TableCell className="text-xs text-center font-bold text-foreground">
                        <Badge variant="outline" className="text-xs font-bold px-2 py-0.5">
                          {fac.totalHours.toFixed(1)} hrs
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-center font-semibold text-muted-foreground">
                        {fac.totalSessions}
                      </TableCell>
                      <TableCell className="text-xs text-center font-extrabold text-emerald-400">
                        +{fac.totalTokensEarned.toFixed(2)} WORK
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {fac.lastActiveDate || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => setInspectingFaculty(fac)}
                          className="rounded-xl text-xs gap-1"
                        >
                          <Eye className="h-3 w-3" /> View Sessions ({fac.logs.length})
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 2: PENDING APPROVALS QUEUE */}
        <TabsContent value="approvals" className="space-y-4">
          <Card className="rounded-2xl border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/30">
                  <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                  <TableHead className="text-xs font-bold">Task & Category</TableHead>
                  <TableHead className="text-xs font-bold">Session Date</TableHead>
                  <TableHead className="text-xs font-bold">Duration</TableHead>
                  <TableHead className="text-xs font-bold">Proportional Reward</TableHead>
                  <TableHead className="text-xs font-bold">Notes / Student Detail</TableHead>
                  <TableHead className="text-xs font-bold text-right">Decision</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingApprovals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-xs">
                      <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400/60" />
                      All general task claims have been reviewed! No pending approvals.
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingApprovals.map((log) => (
                    <TableRow key={log.id} className="hover:bg-muted/20 transition-colors">
                      <TableCell className="text-xs">
                        <strong className="text-foreground block">{log.facultyName}</strong>
                        <span className="text-[10px] text-muted-foreground">{log.departmentName}</span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-semibold text-foreground">{log.templateTitle}</div>
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 mt-0.5">
                          {log.generalCategory}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {log.sessionDate}
                      </TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1 text-foreground">
                          <Clock className="h-3 w-3 text-primary" />
                          <span>{log.durationHours} hrs</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-emerald-400 whitespace-nowrap">
                        +{log.credits.toFixed(2)} WORK
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {log.notes}
                        {log.proofUrl && (
                          <a
                            href={log.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline ml-2"
                          >
                            <ExternalLink className="h-3 w-3" /> Proof
                          </a>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="xs"
                            variant="destructive"
                            onClick={() => handleDecision(log.id, "REJECT")}
                            disabled={processingLogId === log.id}
                            className="rounded-xl text-[11px] h-7 px-2"
                          >
                            Decline
                          </Button>
                          <Button
                            size="xs"
                            onClick={() => handleDecision(log.id, "APPROVE")}
                            disabled={processingLogId === log.id}
                            className="rounded-xl text-[11px] h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            {processingLogId === log.id ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                            )}
                            Approve & Credit
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* TAB 3: GENERAL TASK TEMPLATES CATALOG */}
        <TabsContent value="catalog" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((tpl) => (
              <Card key={tpl.id} className="rounded-2xl border-border/60 hover:border-primary/40 transition-all flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border-primary/20">
                      {tpl.generalCategory}
                    </Badge>
                    <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      <Coins className="h-3 w-3" />
                      <span>+{tpl.hourlyRate} WORK / hr</span>
                    </div>
                  </div>
                  <CardTitle className="text-base font-bold text-foreground line-clamp-2">
                    {tpl.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground line-clamp-3 mt-1.5 leading-relaxed">
                    {tpl.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0 border-t border-border/40 py-3 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Scope: <strong className="text-foreground">{tpl.orgUnitName}</strong></span>
                  <Badge variant="secondary" className="text-[10px]">
                    {tpl.createdByRole || "Admin"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* 3. CREATE GENERAL TASK MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Plus className="h-5 w-5 text-primary" /> Create New General Task
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure a voluntary productivity activity available for faculty logging.
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          {createSuccess && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{createSuccess}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Activity Title</Label>
              <Input
                placeholder="e.g. Student Academic Counselling & Mentorship"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="rounded-xl text-xs font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Select value={newCategory} onValueChange={(val: any) => setNewCategory(val)}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COUNSELLING" className="text-xs">Student Counselling</SelectItem>
                    <SelectItem value="MENTORSHIP" className="text-xs">Academic Mentorship</SelectItem>
                    <SelectItem value="LAB_MAINTENANCE" className="text-xs">Lab Maintenance</SelectItem>
                    <SelectItem value="ACCREDITATION" className="text-xs">Accreditation Support</SelectItem>
                    <SelectItem value="EVENT" className="text-xs">Department Event</SelectItem>
                    <SelectItem value="OTHER" className="text-xs">Other Voluntary</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Hourly Rate (WORK/hr)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10"
                  value={newHourlyRate}
                  onChange={(e) => setNewHourlyRate(Math.max(0.1, parseFloat(e.target.value) || 0.5))}
                  className="rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            {departments.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Target Department</Label>
                <Select value={newDeptId} onValueChange={setNewDeptId}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">Organization Wide (All Depts)</SelectItem>
                    {departments.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id} className="text-xs">
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Description & Guidelines</Label>
              <Textarea
                rows={3}
                placeholder="Explain the objectives, expected counseling topics, and documentation requirements..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={isCreating}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleCreateTemplate}
              disabled={isCreating || !newTitle.trim()}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 font-semibold"
            >
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 4. FACULTY DETAIL INSPECTOR DRAWER / MODAL */}
      <Dialog open={!!inspectingFaculty} onOpenChange={(open) => !open && setInspectingFaculty(null)}>
        <DialogContent className="sm:max-w-2xl rounded-3xl border-border max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-primary" /> {inspectingFaculty?.facultyName} — Activity History
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspectingFaculty?.departmentName} • Total Logged: {inspectingFaculty?.totalHours} hrs • Disbursed: +{inspectingFaculty?.totalTokensEarned} WORK
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1">
            {inspectingFaculty?.logs.map((log) => (
              <div key={log.id} className="p-3.5 rounded-2xl bg-muted/40 border border-border/60 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">{log.templateTitle}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">{log.sessionDate}</span>
                    {log.status === "LEAD_SIGNED" || log.status === "CLOSED" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px]">Approved</Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-400 text-[9px]">Review Pending</Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span>Duration: <strong className="text-foreground">{log.durationHours} hrs</strong></span>
                  <span>Rate: {log.hourlyRate} WORK/hr</span>
                  <span className="text-emerald-400 font-bold">Reward: +{log.credits} WORK</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed pt-1 border-t border-border/40">
                  {log.notes}
                </p>
                {log.proofUrl && (
                  <a
                    href={log.proofUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-[10px] pt-1"
                  >
                    <ExternalLink className="h-3 w-3" /> View Submitted Proof Document
                  </a>
                )}
              </div>
            ))}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setInspectingFaculty(null)}
              className="rounded-xl text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
