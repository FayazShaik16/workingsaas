"use client"

import { useState, useRef } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  CalendarDays,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  Users,
  BookOpen,
  AlertCircle,
  Loader2,
  Upload,
  FileSpreadsheet,
  Download,
  ArrowRight,
  ShieldCheck,
} from "lucide-react"
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

  // Quick manual allocation state
  const [newFacultyId, setNewFacultyId] = useState(faculty[0]?.id || "")
  const [newSubjectId, setNewSubjectId] = useState(subjects[0]?.id || "")
  const [newBatchId, setNewBatchId] = useState(batches[0]?.id || "")
  const [newDay, setNewDay] = useState("MON")
  const [newPeriod, setNewPeriod] = useState(1)
  const [newRoom, setNewRoom] = useState("LH-101")
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  // Import State
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importFileName, setImportFileName] = useState("")
  const [importRawRows, setImportRawRows] = useState<any[]>([])
  const [importHeaders, setImportHeaders] = useState<string[]>([])
  const [importMapping, setImportMapping] = useState({
    facultyEmail: "",
    day: "",
    periodNumber: "",
    startTime: "",
    endTime: "",
    activityType: "",
    subjectCode: "",
    subjectName: "",
    program: "",
    batchSection: "",
    room: "",
  })
  const [importPreviewRows, setImportPreviewRows] = useState<any[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importReport, setImportReport] = useState<any | null>(null)

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const periods = [1, 2, 3, 4, 5, 6, 7, 8]

  const periodTimes: Record<number, { start: string; end: string }> = {
    1: { start: "09:00:00", end: "09:50:00" },
    2: { start: "09:50:00", end: "10:40:00" },
    3: { start: "10:50:00", end: "11:40:00" },
    4: { start: "11:40:00", end: "12:30:00" },
    5: { start: "01:30:00", end: "02:20:00" },
    6: { start: "02:20:00", end: "03:10:00" },
    7: { start: "03:20:00", end: "04:10:00" },
    8: { start: "04:10:00", end: "05:00:00" },
  }

  // Flatten assignments into grid slot objects
  const slots: any[] = []
  for (const a of initialAssignments) {
    if (a.batch_id === selectedBatchId && a.timetable_slots) {
      for (const s of a.timetable_slots) {
        slots.push({
          id: s.id,
          day: s.day_of_week,
          period: s.period_number,
          room: s.room,
          subjectCode: a.subjects?.code,
          subjectName: a.subjects?.name,
          subjectType: a.subjects?.subject_type,
          facultyName: a.users?.name,
          facultyId: a.faculty_id,
        })
      }
    }
  }

  const getSlot = (day: string, period: number) => {
    return slots.find((s) => s.day === day && s.period === period)
  }

  // Quick Manual Allocation Handler
  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setStatusMessage(null)

    try {
      let assignmentId = ""
      const { data: existingAssignment } = await db
        .from("subject_assignments")
        .select("id")
        .eq("organization_id", orgId)
        .eq("faculty_id", newFacultyId)
        .eq("subject_id", newSubjectId)
        .eq("batch_id", newBatchId)
        .limit(1)
        .maybeSingle()

      if (existingAssignment) {
        assignmentId = existingAssignment.id
      } else {
        const { data: newAssignment, error: aError } = await db
          .from("subject_assignments")
          .insert({
            organization_id: orgId,
            faculty_id: newFacultyId,
            subject_id: newSubjectId,
            batch_id: newBatchId,
            academic_year: "2025-2026",
            semester: 5,
            is_active: true,
          })
          .select("id")
          .single()

        if (aError) throw aError
        assignmentId = newAssignment.id
      }

      const times = periodTimes[newPeriod] || { start: "09:00:00", end: "09:50:00" }

      const { error: slotError } = await db.from("timetable_slots").insert({
        organization_id: orgId,
        subject_assignment_id: assignmentId,
        faculty_id: newFacultyId,
        day_of_week: newDay,
        period_number: newPeriod,
        start_time: times.start,
        end_time: times.end,
        room: newRoom,
        is_active: true,
        effective_from: new Date().toISOString().split("T")[0],
      })

      if (slotError) throw slotError

      setStatusMessage("Slot successfully allocated to weekly timetable!")
      router.refresh()
    } catch (err: any) {
      console.error("Save slot error:", err)
      setStatusMessage(`Failed to save slot: ${err.message}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Monthly Task Compilation Trigger
  const handleCompileSchedule = async () => {
    setIsCompiling(true)
    setCompileResult(null)

    try {
      const now = new Date()
      const res = await fetch("/api/engine/compile-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId: orgId,
          year: now.getFullYear(),
          month: now.getMonth() + 1,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Schedule compilation failed.")

      setCompileResult(data)
      router.refresh()
    } catch (err: any) {
      console.error("Compile error:", err)
      setCompileResult({ success: false, error: err.message })
    } finally {
      setIsCompiling(false)
    }
  }

  // Timetable Spreadsheet Upload Handler
  const handleTimetableFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportFileName(file.name)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const wsName = wb.SheetNames[0]
        const ws = wb.Sheets[wsName]
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 })

        if (!data || data.length < 2) {
          alert("File is empty or missing headers.")
          return
        }

        const rawHeaders = (data[0] as any[]).map((h) => String(h || "").trim())
        const rows = data.slice(1).map((rowArr: any) => {
          const rowObj: any = {}
          rawHeaders.forEach((header, idx) => {
            rowObj[header] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : ""
          })
          return rowObj
        }).filter((r) => Object.values(r).some((v) => v !== ""))

        setImportHeaders(rawHeaders)
        setImportRawRows(rows)

        // Auto-guess mappings
        const guess: typeof importMapping = {
          facultyEmail: "",
          day: "",
          periodNumber: "",
          startTime: "",
          endTime: "",
          activityType: "",
          subjectCode: "",
          subjectName: "",
          program: "",
          batchSection: "",
          room: "",
        }

        rawHeaders.forEach((h) => {
          const lower = h.toLowerCase()
          if (lower.includes("mail") || lower.includes("faculty")) guess.facultyEmail = h
          else if (lower.includes("day")) guess.day = h
          else if (lower.includes("period") || lower.includes("slot")) guess.periodNumber = h
          else if (lower.includes("start")) guess.startTime = h
          else if (lower.includes("end")) guess.endTime = h
          else if (lower.includes("activity") || lower.includes("type")) guess.activityType = h
          else if (lower.includes("sub_code") || lower.includes("course_code") || lower.includes("subject code")) guess.subjectCode = h
          else if (lower.includes("sub_name") || lower.includes("course") || lower.includes("subject")) guess.subjectName = h
          else if (lower.includes("prog") || lower.includes("degree")) guess.program = h
          else if (lower.includes("sec") || lower.includes("batch")) guess.batchSection = h
          else if (lower.includes("room") || lower.includes("hall") || lower.includes("lab")) guess.room = h
        })

        setImportMapping(guess)
        setActiveTab("import-mapping")
      } catch (err) {
        console.error("Parse timetable error:", err)
        alert("Failed to parse timetable file.")
      }
    }

    reader.readAsBinaryString(file)
  }

  // Generate Timetable Preview
  const handleGenerateImportPreview = () => {
    if (!importMapping.facultyEmail) {
      alert("Faculty Email mapping is required.")
      return
    }

    const preview = importRawRows.map((r, i) => {
      const email = String(r[importMapping.facultyEmail] || "").trim()
      const day = importMapping.day ? String(r[importMapping.day] || "MON").trim() : "MON"
      const periodNumber = importMapping.periodNumber ? Number(r[importMapping.periodNumber] || 1) : 1
      const activityType = importMapping.activityType ? String(r[importMapping.activityType] || "TEACHING_LECTURE").trim() : "TEACHING_LECTURE"
      const subjectCode = importMapping.subjectCode ? String(r[importMapping.subjectCode] || "").trim() : ""
      const subjectName = importMapping.subjectName ? String(r[importMapping.subjectName] || "").trim() : ""
      const program = importMapping.program ? String(r[importMapping.program] || "BTECH-CSE").trim() : "BTECH-CSE"
      const batchSection = importMapping.batchSection ? String(r[importMapping.batchSection] || "3rd Yr CSE-A").trim() : "3rd Yr CSE-A"
      const room = importMapping.room ? String(r[importMapping.room] || "LH-101").trim() : "LH-101"

      const times = periodTimes[periodNumber] || { start: "09:00:00", end: "09:50:00" }

      return {
        rowIdx: i + 1,
        facultyEmail: email,
        day,
        periodNumber,
        startTime: importMapping.startTime ? String(r[importMapping.startTime] || times.start) : times.start,
        endTime: importMapping.endTime ? String(r[importMapping.endTime] || times.end) : times.end,
        activityType,
        subjectCode,
        subjectName,
        program,
        batchSection,
        room,
        isValid: Boolean(email && email.includes("@")),
      }
    })

    setImportPreviewRows(preview)
    setActiveTab("import-preview")
  }

  // Execute Timetable Import & Auto-Compile
  const handleExecuteTimetableImport = async () => {
    setIsImporting(true)
    try {
      const validSlots = importPreviewRows.filter((r) => r.isValid)
      const res = await fetch("/api/admin/import-timetable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          deptId,
          slots: validSlots,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Timetable ingestion failed.")

      setImportReport(data)
      setActiveTab("import-report")
      router.refresh()
    } catch (err: any) {
      alert(err.message || "Failed to import timetable.")
    } finally {
      setIsImporting(false)
    }
  }

  // Download Timetable Sample CSV Template
  const downloadTimetableSample = () => {
    const csvContent =
      "Faculty Email,Day,Period,Start Time,End Time,Activity Type,Subject Code,Subject Name,Program,Section,Room\n" +
      "faculty.cse1@demo.workledger.in,MON,1,09:00:00,09:50:00,TEACHING_LECTURE,CS301,Database Management Systems,BTECH-CSE,3rd Yr CSE-A,LH-101\n" +
      "faculty.cse1@demo.workledger.in,MON,2,09:50:00,10:40:00,CLASS_PREP,,,,,,Faculty Cabin 12\n" +
      "faculty.cse1@demo.workledger.in,TUE,3,10:50:00,11:40:00,TUTORIAL,CS301,DBMS Tutorial,BTECH-CSE,3rd Yr CSE-A,CR-204\n" +
      "faculty.cse1@demo.workledger.in,WED,5,13:30:00,15:10:00,TEACHING_LAB,CS302,Database Systems Lab,BTECH-CSE,3rd Yr CSE-A,Lab 3\n" +
      "faculty.cse1@demo.workledger.in,THU,6,14:20:00,15:10:00,CO_CURRICULAR,,,,,,Seminar Hall\n" +
      "faculty.cse1@demo.workledger.in,FRI,7,15:20:00,16:10:00,ADMIN_ASSIST,,,,,,Exam Cell\n"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "timetable_import_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Top Header Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <CalendarDays className="h-8 w-8 text-primary" />
            Timetable Matrix & Task Compiler
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure weekly period grids, import master loads, and compile proof-of-work credit baselines for {deptName}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadTimetableSample}
            className="text-xs font-bold gap-1.5 shadow-xs"
          >
            <Download className="h-4 w-4" /> Timetable Template
          </Button>
          <Button
            onClick={handleCompileSchedule}
            disabled={isCompiling}
            size="sm"
            className="bg-primary text-primary-foreground font-bold shadow-xs gap-2"
          >
            {isCompiling ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Compiling Engine...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" /> Compile Current Month
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/40 p-1 border">
          <TabsTrigger value="grid" className="text-xs font-bold">
            Weekly Master Grid
          </TabsTrigger>
          <TabsTrigger value="import" className="text-xs font-bold gap-1.5">
            <Upload className="h-3.5 w-3.5" /> Import Spreadsheet
          </TabsTrigger>
          <TabsTrigger value="allocate" className="text-xs font-bold gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Manual Slot Builder
          </TabsTrigger>
          {compileResult && (
            <TabsTrigger value="report" className="text-xs font-bold">
              Compilation Status
            </TabsTrigger>
          )}
        </TabsList>

        {/* TAB 1: WEEKLY GRID */}
        <TabsContent value="grid" className="space-y-4">
          <Card className="rounded-2xl border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground">
                  Academic Section Grid View
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Select a section batch to inspect recurring period allocations
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-muted-foreground">Select Batch:</span>
                <select
                  value={selectedBatchId}
                  onChange={(e) => setSelectedBatchId(e.target.value)}
                  className="text-xs font-bold p-1.5 border rounded-lg bg-background"
                >
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.academic_programs?.code} · Yr {b.year_of_study} ({b.section})
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>

            <CardContent className="p-4 overflow-x-auto">
              <div className="min-w-[700px]">
                <div className="grid grid-cols-9 gap-1.5 text-center text-xs font-bold text-muted-foreground pb-2 border-b">
                  <div className="p-2">Day / Time</div>
                  {periods.map((p) => (
                    <div key={p} className="p-2 bg-muted/40 rounded-lg">
                      P{p}
                      <span className="block text-[9px] font-mono text-muted-foreground font-normal">
                        {periodTimes[p]?.start.slice(0, 5)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2">
                  {days.map((day) => (
                    <div key={day} className="grid grid-cols-9 gap-1.5 items-center">
                      <div className="p-2 font-black text-xs text-foreground bg-muted/30 rounded-lg text-center">
                        {day}
                      </div>

                      {periods.map((p) => {
                        const slot = getSlot(day, p)
                        return (
                          <div
                            key={p}
                            className={`p-2 rounded-xl border text-left min-h-[70px] flex flex-col justify-between transition ${
                              slot
                                ? "bg-primary/5 border-primary/30 hover:border-primary"
                                : "bg-muted/10 border-dashed border-muted/80 text-muted-foreground"
                            }`}
                          >
                            {slot ? (
                              <>
                                <div>
                                  <span className="font-bold text-[11px] text-foreground block truncate">
                                    {slot.subjectCode}
                                  </span>
                                  <span className="text-[9px] text-muted-foreground block truncate">
                                    {slot.facultyName}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[8px] font-mono font-bold text-primary pt-1">
                                  <span>{slot.room}</span>
                                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-4">
                                    {slot.subjectType || "THEORY"}
                                  </Badge>
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center justify-center h-full text-[10px] text-muted-foreground/60 font-mono">
                                —
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: IMPORT SPREADSHEET */}
        <TabsContent value="import" className="space-y-4">
          <Card className="rounded-2xl border-2 shadow-sm">
            <CardHeader className="pb-4 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Import Full Faculty Weekly Timetable
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Upload CSV or Excel sheet with periods, teaching courses, class prep, tutorials, and admin slots.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTimetableSample}
                className="gap-1.5 text-xs font-bold shadow-xs"
              >
                <Download className="h-4 w-4" /> Download Sample CSV
              </Button>
            </CardHeader>

            <CardContent className="p-8">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv, .xlsx, .xls"
                onChange={handleTimetableFileUpload}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-2xl p-12 text-center hover:border-primary hover:bg-primary/5 transition cursor-pointer space-y-3"
              >
                <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <FileSpreadsheet className="h-7 w-7" />
                </div>
                <div className="space-y-1">
                  <p className="font-extrabold text-foreground text-sm">
                    Click to select your department timetable file (.csv / .xlsx)
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Automatically builds courses, batches, periods, and calculates target credit denominators
                  </p>
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                  75% Structured / 25% Unstructured Model Enabled
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUB-TAB: IMPORT MAPPING */}
        <TabsContent value="import-mapping" className="space-y-4">
          <Card className="rounded-2xl border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground">
                  Map Timetable Columns
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  File: <span className="font-mono font-bold text-foreground">{importFileName}</span> ({importRawRows.length} rows)
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab("import")} className="text-xs">
                Change File
              </Button>
            </CardHeader>

            <CardContent className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Faculty Email */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Faculty Email *</label>
                  <select
                    value={importMapping.facultyEmail}
                    onChange={(e) => setImportMapping({ ...importMapping, facultyEmail: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Day */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Day of Week (MON..SAT)</label>
                  <select
                    value={importMapping.day}
                    onChange={(e) => setImportMapping({ ...importMapping, day: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Period Number */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Period Number (1..8)</label>
                  <select
                    value={importMapping.periodNumber}
                    onChange={(e) => setImportMapping({ ...importMapping, periodNumber: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Activity Type */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Activity Type</label>
                  <select
                    value={importMapping.activityType}
                    onChange={(e) => setImportMapping({ ...importMapping, activityType: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Subject Code */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Subject Code</label>
                  <select
                    value={importMapping.subjectCode}
                    onChange={(e) => setImportMapping({ ...importMapping, subjectCode: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Subject Name */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Subject Name</label>
                  <select
                    value={importMapping.subjectName}
                    onChange={(e) => setImportMapping({ ...importMapping, subjectName: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Program & Section */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Batch / Section</label>
                  <select
                    value={importMapping.batchSection}
                    onChange={(e) => setImportMapping({ ...importMapping, batchSection: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Room */}
                <div className="p-3.5 rounded-xl border bg-muted/20 space-y-1">
                  <label className="text-xs font-bold text-foreground">Room / Venue</label>
                  <select
                    value={importMapping.room}
                    onChange={(e) => setImportMapping({ ...importMapping, room: e.target.value })}
                    className="w-full text-xs p-2 border rounded-lg bg-background font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {importHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setActiveTab("import")} className="text-xs font-bold">
                  Back
                </Button>
                <Button size="sm" onClick={handleGenerateImportPreview} className="text-xs font-bold gap-1.5">
                  Continue to Preview <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUB-TAB: IMPORT PREVIEW */}
        <TabsContent value="import-preview" className="space-y-4">
          <Card className="rounded-2xl border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-black text-foreground">
                  Timetable Ingestion Preview ({importPreviewRows.length} Slots)
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Valid slots: {importPreviewRows.filter((r) => r.isValid).length} · Ready for ingestion
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setActiveTab("import-mapping")} className="text-xs font-bold">
                  Adjust Mapping
                </Button>
                <Button
                  size="sm"
                  disabled={isImporting || importPreviewRows.filter((r) => r.isValid).length === 0}
                  onClick={handleExecuteTimetableImport}
                  className="text-xs font-bold gap-1.5 shadow-xs"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Ingesting & Compiling...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Ingest & Compile ({importPreviewRows.filter((r) => r.isValid).length})
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-96">
                <Table>
                  <TableHeader className="bg-muted/40 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="text-xs font-bold">Faculty</TableHead>
                      <TableHead className="text-xs font-bold">Day / Period</TableHead>
                      <TableHead className="text-xs font-bold">Activity Type</TableHead>
                      <TableHead className="text-xs font-bold">Subject Code</TableHead>
                      <TableHead className="text-xs font-bold">Section</TableHead>
                      <TableHead className="text-xs font-bold">Room</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreviewRows.map((r, i) => (
                      <TableRow key={i} className="hover:bg-muted/20 text-xs">
                        <TableCell className="font-mono">{r.facultyEmail}</TableCell>
                        <TableCell className="font-bold text-foreground">
                          {r.day} · Period {r.periodNumber}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-bold">
                            {r.activityType}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-primary font-bold">
                          {r.subjectCode || "—"}
                        </TableCell>
                        <TableCell>{r.batchSection || "—"}</TableCell>
                        <TableCell className="font-mono">{r.room}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SUB-TAB: IMPORT REPORT */}
        <TabsContent value="import-report" className="space-y-4">
          {importReport && (
            <Card className="rounded-2xl border-2 shadow-md">
              <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    Timetable Ingestion & Monthly Compilation Report
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {importReport.importedSlotsCount} timetable slots saved · {importReport.facultyCompiledCount} faculty target baselines updated
                  </CardDescription>
                </div>
                <Button size="sm" onClick={() => setActiveTab("grid")} className="text-xs font-bold">
                  View Master Grid
                </Button>
              </CardHeader>

              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <span className="text-xs font-bold uppercase tracking-wider block">Timetable Slots Ingested</span>
                    <span className="text-3xl font-black">{importReport.importedSlotsCount}</span>
                  </div>
                  <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400">
                    <span className="text-xs font-bold uppercase tracking-wider block">Faculty Targets Calculated</span>
                    <span className="text-3xl font-black">{importReport.facultyCompiledCount}</span>
                  </div>
                </div>

                {importReport.compileResults && (
                  <div className="border rounded-xl overflow-hidden mt-4">
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow>
                          <TableHead className="text-xs font-bold">Faculty ID</TableHead>
                          <TableHead className="text-xs font-bold">Tasks Generated</TableHead>
                          <TableHead className="text-xs font-bold">Structured Credits (S)</TableHead>
                          <TableHead className="text-xs font-bold">Target Credits (S / 0.75)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importReport.compileResults.map((cr: any, idx: number) => (
                          <TableRow key={idx} className="text-xs">
                            <TableCell className="font-mono">{cr.facultyId}</TableCell>
                            <TableCell className="font-bold text-foreground">{cr.tasksCreated}</TableCell>
                            <TableCell className="font-mono text-blue-600 font-bold">{cr.structuredCredits} WORK</TableCell>
                            <TableCell className="font-mono text-emerald-600 font-black">{cr.targetCredits} WORK</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: MANUAL ALLOCATION */}
        <TabsContent value="allocate" className="space-y-4">
          <Card className="rounded-2xl border-2 shadow-sm">
            <CardHeader className="pb-3 border-b bg-muted/20">
              <CardTitle className="text-base font-black text-foreground">
                Manual Slot Builder
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Assign an individual faculty member to a period slot in {deptName}
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSaveSlot} className="space-y-4 max-w-xl">
                {statusMessage && (
                  <div className="p-3 text-xs rounded-xl bg-primary/10 border border-primary/20 text-primary font-semibold">
                    {statusMessage}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Select Faculty</label>
                  <select
                    value={newFacultyId}
                    onChange={(e) => setNewFacultyId(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg bg-background"
                  >
                    {faculty.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.email})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Select Subject / Course</label>
                  <select
                    value={newSubjectId}
                    onChange={(e) => setNewSubjectId(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg bg-background"
                  >
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold">Select Academic Batch</label>
                  <select
                    value={newBatchId}
                    onChange={(e) => setNewBatchId(e.target.value)}
                    className="w-full text-xs p-2 border rounded-lg bg-background"
                  >
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.academic_programs?.code} · Yr {b.year_of_study} ({b.section})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Day</label>
                    <select
                      value={newDay}
                      onChange={(e) => setNewDay(e.target.value)}
                      className="w-full text-xs p-2 border rounded-lg bg-background"
                    >
                      {days.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Period</label>
                    <select
                      value={newPeriod}
                      onChange={(e) => setNewPeriod(Number(e.target.value))}
                      className="w-full text-xs p-2 border rounded-lg bg-background"
                    >
                      {periods.map((p) => <option key={p} value={p}>Period {p}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold">Room</label>
                    <Input
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="font-bold text-xs gap-1.5"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" /> Allocate Slot
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: COMPILATION STATUS */}
        {compileResult && (
          <TabsContent value="report" className="space-y-4">
            <Card className="rounded-2xl border-2 shadow-md">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <CardTitle className="text-base font-black text-foreground flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  Monthly Compilation Result
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2 text-xs">
                  <p><strong>Faculty Count:</strong> {compileResult.facultyCount ?? 1}</p>
                  <p><strong>Tasks Generated:</strong> {compileResult.totalTasksCreated ?? compileResult.tasksCreated ?? 0}</p>
                  <pre className="p-3 bg-muted rounded-xl text-[11px] overflow-x-auto">
                    {JSON.stringify(compileResult, null, 2)}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}
