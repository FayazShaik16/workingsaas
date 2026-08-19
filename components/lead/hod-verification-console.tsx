"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
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
  CheckSquare,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Users,
  BookOpen,
  Calendar,
  AlertCircle,
  Loader2,
  ArrowRight,
  Sparkles,
  FileText,
  Filter,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface AttendanceRecordItem {
  id: string
  class_date: string
  students_present: number
  students_absent: number
  topics_covered: string | null
  status: "SUBMITTED" | "VERIFIED" | "REJECTED"
  created_at: string
  faculty: {
    id: string
    name: string
    email: string
    designation: string | null
  } | null
  slot: {
    id: string
    day_of_week: string
    period_number: number
    start_time: string
    end_time: string
    room: string | null
  } | null
  subject: {
    id: string
    code: string
    name: string
    credits: number
  } | null
  batch: {
    id: string
    section: string
    year_of_study: number
    current_semester: number
    program_code: string
  } | null
}

export interface UnstructuredTaskItem {
  id: string
  title: string
  credit_value: number
  status: string
  created_at: string
  assigned_to: {
    id: string
    name: string
    email: string
  } | null
  org_unit_name?: string
}

interface HODVerificationConsoleProps {
  orgId: string
  leadUserId: string
  initialAttendanceRecords: AttendanceRecordItem[]
  initialUnstructuredTasks: UnstructuredTaskItem[]
}

export function HODVerificationConsole({
  orgId,
  leadUserId,
  initialAttendanceRecords,
  initialUnstructuredTasks,
}: HODVerificationConsoleProps) {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState("attendance")
  const [attendanceList, setAttendanceList] = useState<AttendanceRecordItem[]>(initialAttendanceRecords)
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Rejection dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [targetRejectIds, setTargetRejectIds] = useState<string[]>([])
  const [rejectionReason, setRejectionReason] = useState("")

  // Topic detail dialog state
  const [topicDetailRecord, setTopicDetailRecord] = useState<AttendanceRecordItem | null>(null)

  // Filter attendance records
  const pendingAttendance = attendanceList.filter((r) => r.status === "SUBMITTED")
  const filteredAttendance = pendingAttendance.filter((r) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      r.faculty?.name?.toLowerCase().includes(q) ||
      r.faculty?.email?.toLowerCase().includes(q) ||
      r.subject?.name?.toLowerCase().includes(q) ||
      r.subject?.code?.toLowerCase().includes(q) ||
      r.topics_covered?.toLowerCase().includes(q)
    )
  })

  // Group by Faculty & Subject
  type FacultyGroup = {
    facultyId: string
    facultyName: string
    facultyEmail: string
    designation: string
    records: AttendanceRecordItem[]
    totalPresent: number
    totalTokens: number
  }

  const groupedByFaculty: Record<string, FacultyGroup> = {}

  filteredAttendance.forEach((record) => {
    const fId = record.faculty?.id || "unknown"
    if (!groupedByFaculty[fId]) {
      groupedByFaculty[fId] = {
        facultyId: fId,
        facultyName: record.faculty?.name || "Faculty Member",
        facultyEmail: record.faculty?.email || "",
        designation: record.faculty?.designation || "Assistant Professor",
        records: [],
        totalPresent: 0,
        totalTokens: 0,
      }
    }
    groupedByFaculty[fId].records.push(record)
    groupedByFaculty[fId].totalPresent += record.students_present
    groupedByFaculty[fId].totalTokens += 1.0
  })

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRecordIds(filteredAttendance.map((r) => r.id))
    } else {
      setSelectedRecordIds([])
    }
  }

  const handleToggleRecord = (id: string) => {
    setSelectedRecordIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  // Batch action trigger
  const handleExecuteBatchAction = async (action: "APPROVE" | "REJECT", idsToProcess: string[], reason?: string) => {
    if (idsToProcess.length === 0) return

    setIsProcessing(true)
    setStatusMessage(null)

    try {
      const response = await fetch("/api/lead/batch-verify-attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIds: idsToProcess,
          action,
          rejectionReason: reason,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to process batch verification")
      }

      // Update local state
      setAttendanceList((prev) =>
        prev.map((item) =>
          idsToProcess.includes(item.id)
            ? { ...item, status: action === "APPROVE" ? "VERIFIED" : "REJECTED" }
            : item
        )
      )

      setSelectedRecordIds((prev) => prev.filter((id) => !idsToProcess.includes(id)))
      setStatusMessage({
        type: "success",
        text: data.message || `Successfully processed ${idsToProcess.length} records.`,
      })

      if (rejectDialogOpen) {
        setRejectDialogOpen(false)
        setRejectionReason("")
      }

      router.refresh()
    } catch (err: any) {
      setStatusMessage({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleOpenRejectDialog = (ids: string[]) => {
    setTargetRejectIds(ids)
    setRejectionReason("")
    setRejectDialogOpen(true)
  }

  // Summary calculation
  const totalPendingTokens = pendingAttendance.length * 1.0
  const uniqueFacultyCount = Object.keys(groupedByFaculty).length

  return (
    <div className="space-y-6">
      {/* Monday Morning Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" /> Pending Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {pendingAttendance.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Class sessions awaiting sign-off</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 text-emerald-500" /> Liquidity to Disburse
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              +{totalPendingTokens.toFixed(1)} WORK
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Ready for PERSONAL wallet minting</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" /> Active Teaching Faculty
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground font-mono">
              {uniqueFacultyCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Staff members submitted logs</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-violet-500" /> Unstructured Proofs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 font-mono">
              {initialUnstructuredTasks.length}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Non-teaching deliverables</p>
          </CardContent>
        </Card>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl border text-sm font-medium ${
            statusMessage.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Main Tabs Console */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="attendance" className="rounded-lg text-xs font-semibold">
              Classroom Attendance Logs ({pendingAttendance.length})
            </TabsTrigger>
            <TabsTrigger value="unstructured" className="rounded-lg text-xs font-semibold">
              Unstructured Task Proofs ({initialUnstructuredTasks.length})
            </TabsTrigger>
          </TabsList>

          {activeTab === "attendance" && pendingAttendance.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenRejectDialog(selectedRecordIds)}
                disabled={selectedRecordIds.length === 0 || isProcessing}
                className="rounded-xl text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" /> Reject Selected ({selectedRecordIds.length})
              </Button>

              <Button
                size="sm"
                onClick={() => handleExecuteBatchAction("APPROVE", selectedRecordIds)}
                disabled={selectedRecordIds.length === 0 || isProcessing}
                className="rounded-xl text-xs h-8 font-semibold shadow-xs"
              >
                {isProcessing ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                )}
                Approve Selected ({selectedRecordIds.length})
              </Button>

              <Button
                size="sm"
                variant="default"
                onClick={() =>
                  handleExecuteBatchAction(
                    "APPROVE",
                    pendingAttendance.map((r) => r.id)
                  )
                }
                disabled={pendingAttendance.length === 0 || isProcessing}
                className="rounded-xl text-xs h-8 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" /> 1-Click Monday Clearance (All)
              </Button>
            </div>
          )}
        </div>

        {/* Tab 1: Attendance Triage Queue */}
        <TabsContent value="attendance" className="space-y-4">
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3 border-b border-muted/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <CheckSquare className="h-5 w-5 text-primary" />
                  Monday Morning Attendance Triage Table
                </CardTitle>
                <CardDescription className="text-xs">
                  Review student counts, topics delivered, and authorize immediate credit disbursement
                </CardDescription>
              </div>

              <div className="w-full md:w-64">
                <Input
                  placeholder="Filter by faculty, course, topic..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs rounded-xl h-8"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {Object.keys(groupedByFaculty).length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm font-light space-y-2">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto opacity-80" />
                  <p className="font-bold text-foreground">Attendance Queue Clean</p>
                  <p className="text-xs">All faculty teaching sessions have been verified and rewarded.</p>
                </div>
              ) : (
                <div className="divide-y divide-muted/40">
                  {Object.values(groupedByFaculty).map((group) => {
                    const groupRecordIds = group.records.map((r) => r.id)
                    const allGroupSelected = groupRecordIds.every((id) => selectedRecordIds.includes(id))

                    const toggleGroupSelection = () => {
                      if (allGroupSelected) {
                        setSelectedRecordIds((prev) => prev.filter((id) => !groupRecordIds.includes(id)))
                      } else {
                        setSelectedRecordIds((prev) => Array.from(new Set([...prev, ...groupRecordIds])))
                      }
                    }

                    return (
                      <div key={group.facultyId} className="p-5 space-y-3">
                        {/* Faculty Group Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/30 p-3 rounded-xl border border-muted/60">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={allGroupSelected}
                              onChange={toggleGroupSelection}
                              className="rounded h-4 w-4 text-primary border-muted-foreground"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{group.facultyName}</span>
                                <Badge variant="outline" className="text-[10px] font-normal">
                                  {group.designation}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{group.facultyEmail}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-mono">
                              {group.records.length} Sessions (+{group.totalTokens.toFixed(1)} WORK)
                            </Badge>
                            <Button
                              size="xs"
                              variant="outline"
                              onClick={() => handleExecuteBatchAction("APPROVE", groupRecordIds)}
                              disabled={isProcessing}
                              className="rounded-lg text-xs font-semibold"
                            >
                              Approve Faculty ({group.records.length})
                            </Button>
                          </div>
                        </div>

                        {/* Attendance Records Table for this Faculty */}
                        <div className="rounded-xl border border-muted/40 overflow-hidden">
                          <Table>
                            <TableHeader className="bg-muted/20">
                              <TableRow>
                                <TableHead className="w-10"></TableHead>
                                <TableHead className="text-xs font-bold">Class Date / Slot</TableHead>
                                <TableHead className="text-xs font-bold">Course / Subject</TableHead>
                                <TableHead className="text-xs font-bold">Batch & Section</TableHead>
                                <TableHead className="text-xs font-bold">Attendance</TableHead>
                                <TableHead className="text-xs font-bold">Topic Brief</TableHead>
                                <TableHead className="text-xs font-bold text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {group.records.map((record) => {
                                const isSelected = selectedRecordIds.includes(record.id)
                                return (
                                  <TableRow key={record.id} className="hover:bg-muted/20 text-xs">
                                    <TableCell>
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => handleToggleRecord(record.id)}
                                        className="rounded h-3.5 w-3.5 text-primary"
                                      />
                                    </TableCell>
                                    <TableCell className="font-mono">
                                      <div className="font-semibold text-foreground">{record.class_date}</div>
                                      <div className="text-[10px] text-muted-foreground">
                                        Period {record.slot?.period_number} ({record.slot?.start_time?.slice(0, 5)}–
                                        {record.slot?.end_time?.slice(0, 5)})
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="font-semibold text-foreground">{record.subject?.code}</div>
                                      <div className="text-[11px] text-muted-foreground truncate max-w-xs">
                                        {record.subject?.name}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <Badge variant="secondary" className="text-[10px]">
                                        {record.batch?.program_code} {record.batch?.year_of_study}Y-{record.batch?.section}
                                      </Badge>
                                      <div className="text-[10px] text-muted-foreground mt-0.5">
                                        Room: {record.slot?.room || "LH-101"}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                          {record.students_present} Present
                                        </span>
                                        <span className="text-muted-foreground">/</span>
                                        <span className="text-muted-foreground font-mono">
                                          {record.students_absent} Absent
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {record.topics_covered ? (
                                        <button
                                          onClick={() => setTopicDetailRecord(record)}
                                          className="text-left text-primary hover:underline truncate max-w-xs block font-medium"
                                        >
                                          {record.topics_covered}
                                        </button>
                                      ) : (
                                        <span className="text-muted-foreground italic">No topic notes</span>
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center justify-end gap-1.5">
                                        <Button
                                          size="xs"
                                          variant="outline"
                                          onClick={() => handleOpenRejectDialog([record.id])}
                                          disabled={isProcessing}
                                          className="rounded-lg h-7 px-2 text-destructive border-destructive/20 hover:bg-destructive/10"
                                        >
                                          Reject
                                        </Button>
                                        <Button
                                          size="xs"
                                          onClick={() => handleExecuteBatchAction("APPROVE", [record.id])}
                                          disabled={isProcessing}
                                          className="rounded-lg h-7 px-2.5 font-semibold shadow-2xs"
                                        >
                                          Approve (+1.0)
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Unstructured Task Proofs */}
        <TabsContent value="unstructured" className="space-y-4">
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3 border-b border-muted/40">
              <CardTitle className="text-lg font-bold">Unstructured Proof Reviews</CardTitle>
              <CardDescription className="text-xs">
                Inspect institutional and committee deliverables awaiting lead verification
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {initialUnstructuredTasks.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto opacity-70" />
                  <p className="font-bold text-foreground">No Unstructured Tasks Pending</p>
                  <p className="text-xs">All departmental tasks are up to date.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/20">
                    <TableRow>
                      <TableHead className="text-xs font-bold">Task Title</TableHead>
                      <TableHead className="text-xs font-bold">Assignee</TableHead>
                      <TableHead className="text-xs font-bold">Reward</TableHead>
                      <TableHead className="text-xs font-bold">Status</TableHead>
                      <TableHead className="text-xs font-bold text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {initialUnstructuredTasks.map((task) => (
                      <TableRow key={task.id} className="hover:bg-muted/20 text-xs">
                        <TableCell className="font-semibold text-foreground">{task.title}</TableCell>
                        <TableCell>
                          <div className="font-medium text-foreground">{task.assigned_to?.name || "Staff"}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {task.assigned_to?.email}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{Number(task.credit_value || 1).toFixed(1)} WORK
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                            {task.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="xs"
                            asChild
                            className="rounded-lg text-xs font-semibold shadow-2xs"
                          >
                            <a href={`/${orgId}/lead/verification/${task.id}`}>
                              Inspect Proof <ArrowRight className="h-3 w-3 ml-1" />
                            </a>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Reason Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-destructive flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Reject Attendance Record ({targetRejectIds.length})
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide feedback for the faculty member explaining why this attendance log is being returned.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Rejection Reason</label>
              <Input
                placeholder="e.g. Discrepancy in attendance roll vs student strength"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="text-xs rounded-xl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogOpen(false)}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleExecuteBatchAction("REJECT", targetRejectIds, rejectionReason)}
              disabled={isProcessing}
              className="rounded-xl text-xs font-semibold"
            >
              {isProcessing && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Confirm Rejection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Topic Detail Modal */}
      <Dialog open={!!topicDetailRecord} onOpenChange={() => setTopicDetailRecord(null)}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              Pedagogical & Attendance Summary
            </DialogTitle>
            <DialogDescription className="text-xs">
              {topicDetailRecord?.subject?.code} — {topicDetailRecord?.subject?.name} (
              {topicDetailRecord?.faculty?.name})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-muted/40 p-3 rounded-xl border border-muted/60 font-mono">
              <div>
                <span className="text-muted-foreground block text-[10px]">Session Date</span>
                <span className="font-semibold text-foreground">{topicDetailRecord?.class_date}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Attendance</span>
                <span className="font-semibold text-emerald-600">
                  {topicDetailRecord?.students_present} Present / {topicDetailRecord?.students_absent} Absent
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-muted/60 bg-background space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground uppercase">Topics Delivered</span>
              <p className="text-foreground leading-relaxed text-xs">
                {topicDetailRecord?.topics_covered || "No topic brief entered."}
              </p>
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              size="sm"
              onClick={() => setTopicDetailRecord(null)}
              className="rounded-xl text-xs font-semibold"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
