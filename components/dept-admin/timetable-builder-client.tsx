"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Plus, Play, CheckCircle2, Clock, Users, BookOpen, AlertCircle, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

interface TimetableBuilderClientProps {
  orgId: string
  deptId: string
  deptName: string
  programmes: any[]
  subjects: any[]
  batches: any[]
  faculty: any[]
  initialAssignments: any[]
}

export function TimetableBuilderClient({
  orgId,
  deptId,
  deptName,
  programmes,
  subjects,
  batches,
  faculty,
  initialAssignments,
}: TimetableBuilderClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [activeTab, setActiveTab] = useState("grid")
  const [selectedBatchId, setSelectedBatchId] = useState<string>(batches[0]?.id || "")
  const [isCompiling, setIsCompiling] = useState(false)
  const [compileResult, setCompileResult] = useState<any | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Quick allocation state
  const [newFacultyId, setNewFacultyId] = useState(faculty[0]?.id || "")
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || "")
  const [newBatchId, setNewBatchId] = useState(batches[0]?.id || "")
  const [newDay, setNewDay] = useState("MON")
  const [newPeriod, setNewPeriod] = useState(1)
  const [newRoom, setNewRoom] = useState("LH-101")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const periods = [1, 2, 3, 4, 5, 6, 7, 8]

  const periodTimes: Record<number, { start: string; end: string }> = {
    1: { start: "09:00:00", end: "09:50:00" },
    2: { start: "09:50:00", end: "10:40:00" },
    3: { start: "10:50:00", end: "11:40:00" },
    4: { start: "11:40:00", end: "12:30:00" },
    5: { start: "13:30:00", end: "14:20:00" },
    6: { start: "14:20:00", end: "15:10:00" },
    7: { start: "15:20:00", end: "16:10:00" },
    8: { start: "16:10:00", end: "17:00:00" },
  }

  // Handle manual slot creation
  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setStatusMessage(null)

    try {
      // 1. Find or create subject assignment
      let assignment = initialAssignments.find(
        (a) => a.faculty_id === newFacultyId && a.subject_id === newSubjectId && a.batch_id === newBatchId
      )

      let assignmentId = assignment?.id

      if (!assignmentId) {
        const { data: newAssign, error: assignError } = await db
          .from("subject_assignments")
          .insert({
            organization_id: orgId,
            faculty_id: newFacultyId,
            subject_id: newSubjectId,
            batch_id: newBatchId,
            academic_year: "2025-2026",
            is_active: true,
          })
          .select("id")
          .single()

        if (assignError) throw assignError
        assignmentId = newAssign.id
      }

      // 2. Insert timetable slot
      const times = periodTimes[newPeriod] || { start: "09:00:00", end: "09:50:00" }
      const { error: slotError } = await db.from("timetable_slots").insert({
        organization_id: orgId,
        subject_assignment_id: assignmentId,
        day_of_week: newDay,
        period_number: newPeriod,
        start_time: times.start,
        end_time: times.end,
        room: newRoom,
        effective_from: new Date().toISOString().split("T")[0],
        is_active: true,
      })

      if (slotError) throw slotError

      setStatusMessage("Timetable slot added successfully!")
      router.refresh()
    } catch (err: any) {
      console.error("Add slot failed:", err)
      setStatusMessage(`Error: ${err.message || "Failed to add slot"}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Trigger monthly cycle task compilation
  const handleCompileMonth = async () => {
    setIsCompiling(true)
    setCompileResult(null)

    try {
      const now = new Date()
      const year = now.getFullYear()
      const month = now.getMonth() + 1

      // Call compiler API route
      const response = await fetch(`/api/engine/compile-schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, year, month }),
      })

      const data = await response.json()
      setCompileResult(data)
      router.refresh()
    } catch (err: any) {
      console.error("Compilation error:", err)
      setCompileResult({ success: false, error: err.message || "Compilation failed" })
    } finally {
      setIsCompiling(false)
    }
  }

  // Filter slots for active batch
  const activeBatchSlots: Record<string, Record<number, any>> = {}
  days.forEach((d) => (activeBatchSlots[d] = {}))

  initialAssignments
    .filter((a) => a.batch_id === selectedBatchId)
    .forEach((assignment) => {
      ;(assignment.timetable_slots || []).forEach((slot: any) => {
        if (slot.is_active && activeBatchSlots[slot.day_of_week]) {
          activeBatchSlots[slot.day_of_week][slot.period_number] = {
            ...slot,
            facultyName: assignment.users?.name,
            subjectCode: assignment.subjects?.code,
            subjectName: assignment.subjects?.name,
          }
        }
      })
    })

  return (
    <div className="space-y-6">
      {/* Top Banner: Compilation Command & Denominator Trigger */}
      <Card className="border-violet-500/30 bg-violet-950/10 backdrop-blur-xs">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-violet-400" />
              <h2 className="text-base font-semibold text-white">Monthly Schedule Task Compiler</h2>
            </div>
            <p className="text-xs text-white/60">
              Generates deterministic structured task instances from weekly timetable slots and establishes the 100% credit denominator baseline.
            </p>
          </div>
          <Button
            onClick={handleCompileMonth}
            disabled={isCompiling}
            className="bg-violet-600 hover:bg-violet-500 text-white font-medium shrink-0 flex items-center gap-2"
          >
            {isCompiling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Compiling Tasks...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Compile Current Month
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Compile Result Feedback Alert */}
      {compileResult && (
        <Card className={`border ${compileResult.success ? "border-emerald-500/40 bg-emerald-950/10" : "border-red-500/40 bg-red-950/10"}`}>
          <CardContent className="p-4 flex items-center gap-3">
            {compileResult.success ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-semibold text-white">
                {compileResult.success ? "Schedule Tasks Compiled Successfully!" : "Compilation Failed"}
              </p>
              <p className="text-white/60 mt-0.5">
                {compileResult.success
                  ? `Created/verified ${compileResult.totalTasksCreated || 0} structured task instances across ${compileResult.facultyCount || 0} faculty members. Target denominators updated.`
                  : compileResult.error || "An error occurred during task compilation."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="grid">Weekly Matrix</TabsTrigger>
          <TabsTrigger value="allocations">Faculty Allocations</TabsTrigger>
          <TabsTrigger value="add">Add Assignment</TabsTrigger>
        </TabsList>

        {/* TAB 1: Weekly Matrix Visualizer */}
        <TabsContent value="grid" className="space-y-4 pt-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <label className="text-xs font-semibold text-white/60 uppercase tracking-wider">Select Batch:</label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-violet-500"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id} className="bg-neutral-900 text-white">
                    {b.year_of_study}Y - Section {b.section} (Sem {b.current_semester})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.08] bg-white/[0.02]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                  <th className="p-3 font-semibold text-white/50 w-24">Day / Period</th>
                  {periods.map((p) => (
                    <th key={p} className="p-3 font-semibold text-white/70 text-center min-w-[120px]">
                      <div>Period {p}</div>
                      <div className="text-[10px] text-white/35 font-normal">
                        {periodTimes[p]?.start.slice(0, 5)} - {periodTimes[p]?.end.slice(0, 5)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {days.map((day) => (
                  <tr key={day} className="hover:bg-white/[0.01]">
                    <td className="p-3 font-bold text-violet-400 bg-white/[0.01]">{day}</td>
                    {periods.map((p) => {
                      const slot = activeBatchSlots[day]?.[p]
                      return (
                        <td key={p} className="p-2 text-center align-top">
                          {slot ? (
                            <div className="rounded-xl border border-violet-500/20 bg-violet-500/10 p-2 text-left space-y-1">
                              <p className="font-bold text-white text-[11px] truncate">{slot.subjectCode}</p>
                              <p className="text-[10px] text-white/60 truncate">{slot.facultyName}</p>
                              {slot.room && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] bg-white/[0.06] text-white/50">
                                  {slot.room}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="h-14 rounded-xl border border-dashed border-white/[0.04] flex items-center justify-center text-white/15">
                              –
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* TAB 2: Faculty Allocations List & Live Denominator Baseline */}
        <TabsContent value="allocations" className="space-y-4 pt-2">
          <Card className="border-white/[0.08] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">Department Faculty Work Baseline (Target Credits)</CardTitle>
              <CardDescription className="text-xs text-white/50">
                Live calculated credit denominators per faculty member based on active timetable assignments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-white/[0.04]">
                {faculty.map((f) => {
                  const facAssignments = initialAssignments.filter((a) => a.faculty_id === f.id)
                  const slotCount = facAssignments.reduce((acc, curr) => acc + (curr.timetable_slots?.length || 0), 0)
                  const estimatedTarget = f.target_credits || 50.0

                  return (
                    <div key={f.id} className="py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{f.name}</p>
                        <p className="text-xs text-white/40">{f.email} · {f.designation || "Faculty"}</p>
                      </div>
                      <div className="flex items-center gap-6 text-right">
                        <div>
                          <p className="text-xs text-white/40">Weekly Slots</p>
                          <p className="text-sm font-bold text-white">{slotCount} periods</p>
                        </div>
                        <div className="w-28 text-right">
                          <p className="text-xs text-white/40">Target Denominator</p>
                          <span className="text-sm font-bold text-emerald-400">{estimatedTarget} credits</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Quick Add Allocation Form */}
        <TabsContent value="add" className="space-y-4 pt-2">
          <Card className="border-white/[0.08] bg-white/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-white">Add Timetable Slot</CardTitle>
              <CardDescription className="text-xs text-white/50">
                Assign a faculty member to a subject, section batch, and weekly period slot.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddSlot} className="space-y-4 max-w-xl">
                {statusMessage && (
                  <div className="p-3 text-xs rounded-xl bg-white/[0.04] border border-white/[0.1] text-white">
                    {statusMessage}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/50 uppercase">Faculty Member</label>
                    <select
                      value={newFacultyId}
                      onChange={(e) => setNewFacultyId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-violet-500"
                    >
                      {faculty.map((f) => (
                        <option key={f.id} value={f.id} className="bg-neutral-900 text-white">
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/50 uppercase">Subject</label>
                    <select
                      value={newSubjectId}
                      onChange={(e) => setNewSubjectId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-violet-500"
                    >
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id} className="bg-neutral-900 text-white">
                          {s.code} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/50 uppercase">Academic Batch</label>
                    <select
                      value={newBatchId}
                      onChange={(e) => setNewBatchId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-violet-500"
                    >
                      {batches.map((b) => (
                        <option key={b.id} value={b.id} className="bg-neutral-900 text-white">
                          {b.year_of_study}Y - Sec {b.section} (Sem {b.current_semester})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/50 uppercase">Day of Week</label>
                    <select
                      value={newDay}
                      onChange={(e) => setNewDay(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-violet-500"
                    >
                      {days.map((d) => (
                        <option key={d} value={d} className="bg-neutral-900 text-white">
                          {d}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/50 uppercase">Period Number</label>
                    <select
                      value={newPeriod}
                      onChange={(e) => setNewPeriod(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.1] text-white text-xs focus:outline-none focus:border-violet-500"
                    >
                      {periods.map((p) => (
                        <option key={p} value={p} className="bg-neutral-900 text-white">
                          Period {p} ({periodTimes[p]?.start.slice(0, 5)} - {periodTimes[p]?.end.slice(0, 5)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-white/50 uppercase">Room / Lab</label>
                    <Input
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      placeholder="e.g. LH-101 or LAB-2"
                      className="bg-white/[0.04] border-white/[0.1] text-white text-xs"
                    />
                  </div>
                </div>

                <Button type="submit" disabled={isSaving} className="bg-violet-600 hover:bg-violet-500 text-white text-xs">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Assignment & Slot"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
