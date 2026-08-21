"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  ArrowRight,
  RefreshCw,
  FileText,
} from "lucide-react"
import * as XLSX from "xlsx"
import { useRouter } from "next/navigation"

interface TimetableImportCenterProps {
  orgId: string
  workCycles: Array<{ id: string; name: string; status: string }>
}

export function TimetableImportCenter({ orgId, workCycles }: TimetableImportCenterProps) {
  const router = useRouter()
  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    workCycles.find((c) => c.status === "ACTIVE")?.id || workCycles[0]?.id || ""
  )

  const [parsedRows, setParsedRows] = useState<any[]>([])
  const [fileName, setFileName] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [previewData, setPreviewData] = useState<any | null>(null)
  const [importResult, setImportResult] = useState<any | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Download Sample Template
  const handleDownloadTemplate = () => {
    const csvContent =
      "faculty_id,faculty_name,faculty_email,day,start_time,end_time,task_name,credits,description\n" +
      "MVGR-CSE-001,Mr. V Kiran Kumar,kiran@example.edu,MON,09:15,10:15,VII SE CSD,1.0,Lecture Hall 101\n" +
      "MVGR-CSE-001,Mr. V Kiran Kumar,kiran@example.edu,WED,10:15,11:15,V SE SEC-A,1.0,Classroom A\n" +
      "MVGR-CSE-001,Mr. V Kiran Kumar,kiran@example.edu,THU,09:15,10:15,V SE SEC-B,1.0,Classroom B\n" +
      "MVGR-CSE-001,Mr. V Kiran Kumar,kiran@example.edu,FRI,11:15,12:15,V SE SEC-A,1.0,Classroom A\n"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "timetable_import_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Handle File Upload & Parse
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setErrorMsg(null)
    setPreviewData(null)
    setImportResult(null)

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)

        if (!data || data.length === 0) {
          throw new Error("No data found in uploaded worksheet.")
        }

        setParsedRows(data)
        // Automatically run dry run validation
        runDryRunValidation(data)
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to parse file.")
      }
    }
    reader.readAsBinaryString(file)
  }

  // Dry Run Validation
  const runDryRunValidation = async (rows: any[]) => {
    if (!selectedCycleId) {
      setErrorMsg("Please select an active work cycle first.")
      return
    }

    setIsValidating(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/dept-admin/import-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workCycleId: selectedCycleId,
          dryRun: true,
          rows,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Dry run validation failed.")

      setPreviewData(data)
    } catch (err: any) {
      setErrorMsg(err.message || "Validation failed.")
    } finally {
      setIsValidating(false)
    }
  }

  // Confirm Final Import
  const handleConfirmImport = async () => {
    if (!parsedRows || parsedRows.length === 0 || !selectedCycleId) return

    setIsImporting(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/dept-admin/import-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workCycleId: selectedCycleId,
          dryRun: false,
          rows: parsedRows,
          autoGenerateMonth: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Import failed.")

      setImportResult(data)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || "Import execution failed.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Cycle Selector & Download Action */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2 rounded-2xl border-white/[0.08] bg-slate-900/40 p-5">
          <div className="space-y-3">
            <Label className="text-xs font-mono text-slate-300">Target Work Cycle *</Label>
            <select
              value={selectedCycleId}
              onChange={(e) => {
                setSelectedCycleId(e.target.value)
                if (parsedRows.length > 0) runDryRunValidation(parsedRows)
              }}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              {workCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.status === "ACTIVE" ? "(Active)" : `(${c.status})`}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400">
              Timetable sessions will be attached to this cycle and recurring instances will be synchronized.
            </p>
          </div>
        </Card>

        <Card className="rounded-2xl border-white/[0.08] bg-slate-900/40 p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Download size={13} className="text-violet-400" />
              Standard Template
            </h4>
            <p className="text-[11px] text-slate-400">
              Canonical headers: faculty_id, email, day, times, task_name, credits.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadTemplate}
            className="w-full mt-3 border-white/10 text-slate-200 hover:bg-white/10 text-xs rounded-xl gap-1.5"
          >
            <Download size={13} />
            <span>Download CSV Template</span>
          </Button>
        </Card>
      </div>

      {/* 2. File Upload Box */}
      <Card className="rounded-2xl border-white/[0.08] bg-slate-900/40 p-8 text-center border-dashed">
        <input
          type="file"
          id="timetable-file-input"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />
        <label
          htmlFor="timetable-file-input"
          className="cursor-pointer flex flex-col items-center justify-center space-y-3"
        >
          <div className="p-3 rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
            <Upload size={24} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">
              {fileName ? `Selected: ${fileName}` : "Click to upload timetable (.xlsx or .csv)"}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Supports normalized weekly timetables with faculty email / ID mapping.
            </p>
          </div>
          <Button
            size="sm"
            type="button"
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-xl shadow-md shadow-violet-600/20 mt-2"
          >
            Browse Files
          </Button>
        </label>
      </Card>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Dry-Run Validation Preview */}
      {isValidating && (
        <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
          <Loader2 size={16} className="animate-spin text-violet-400" />
          <span>Validating timetable rows and resolving faculty accounts...</span>
        </div>
      )}

      {previewData && !isValidating && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 rounded-2xl bg-slate-900/60 border-white/[0.08] text-center">
              <span className="text-xs text-slate-400 block font-mono">Total Rows</span>
              <span className="text-2xl font-bold font-mono text-white">{previewData.totalRows}</span>
            </Card>

            <Card className="p-4 rounded-2xl bg-emerald-950/20 border-emerald-500/30 text-center">
              <span className="text-xs text-emerald-400 block font-mono">Valid Sessions</span>
              <span className="text-2xl font-bold font-mono text-emerald-300">{previewData.validCount}</span>
            </Card>

            <Card className="p-4 rounded-2xl bg-rose-950/20 border-rose-500/30 text-center">
              <span className="text-xs text-rose-400 block font-mono">Rejected Rows</span>
              <span className="text-2xl font-bold font-mono text-rose-300">{previewData.rejectedCount}</span>
            </Card>
          </div>

          {/* Valid Rows Preview Table */}
          {previewData.validCount > 0 && (
            <Card className="rounded-2xl border-white/[0.08] bg-slate-900/40 overflow-hidden">
              <CardHeader className="pb-3 border-b border-white/[0.06] flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    Valid Sessions Preview ({previewData.validCount} items)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Preview of sessions to be imported as recurring weekly templates.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-emerald-600/30 gap-1.5"
                >
                  {isImporting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  <span>Confirm & Import All</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.06] bg-white/[0.02] text-slate-400 font-mono">
                        <th className="py-2.5 px-4">Faculty</th>
                        <th className="py-2.5 px-4">Day</th>
                        <th className="py-2.5 px-4">Time Slot</th>
                        <th className="py-2.5 px-4">Session Title</th>
                        <th className="py-2.5 px-4">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {previewData.validTemplatesPreview?.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-4 text-white">
                            {t._facultyName || t.assigned_to_id}
                            <span className="block text-[10px] text-slate-500 font-mono">{t._facultyEmail}</span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-violet-300 font-bold">{t.weekly_day}</td>
                          <td className="py-2.5 px-4 font-mono text-slate-300">
                            {t.start_time} – {t.end_time}
                          </td>
                          <td className="py-2.5 px-4 text-white font-medium">{t.title}</td>
                          <td className="py-2.5 px-4 font-mono text-indigo-300">+{t.credit_value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Rejected Rows Table */}
          {previewData.rejectedCount > 0 && (
            <Card className="rounded-2xl border-rose-500/20 bg-rose-950/10 overflow-hidden">
              <CardHeader className="pb-3 border-b border-rose-500/20">
                <CardTitle className="text-sm font-bold text-rose-300 flex items-center gap-2">
                  <AlertCircle size={15} className="text-rose-400" />
                  Rejected Rows ({previewData.rejectedCount})
                </CardTitle>
                <CardDescription className="text-xs text-rose-400/80">
                  These rows were rejected and will not be imported. Please correct them in your source file.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-rose-500/20 bg-rose-900/10 text-rose-300 font-mono">
                        <th className="py-2.5 px-4">Row #</th>
                        <th className="py-2.5 px-4">Faculty Info</th>
                        <th className="py-2.5 px-4">Task Name</th>
                        <th className="py-2.5 px-4">Rejection Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-500/10 text-rose-200">
                      {previewData.rejectedRows?.map((r: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-4 font-mono text-rose-400">{r.rowNumber}</td>
                          <td className="py-2.5 px-4 font-mono">
                            {r.row.faculty_email || r.row.faculty_id || "Missing"}
                          </td>
                          <td className="py-2.5 px-4">{r.row.task_name || "Missing"}</td>
                          <td className="py-2.5 px-4 font-medium text-rose-300">{r.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* 4. Import Success Banner */}
      {importResult && (
        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-950/20 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Import Successfully Completed</h4>
              <p className="text-xs text-emerald-300/90">{importResult.message}</p>
            </div>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => router.push(`/${orgId}/dept-admin/schedules`)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl"
            >
              View Schedules Matrix
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
