"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
          rows: rows,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Dry run validation failed.")
      }

      setPreviewData(data)
    } catch (err: any) {
      setErrorMsg(err.message || "Validation failed.")
    } finally {
      setIsValidating(false)
    }
  }

  // Confirm Import
  const handleConfirmImport = async () => {
    if (!previewData || !parsedRows.length || !selectedCycleId) return
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
      if (!res.ok) {
        throw new Error(data.error || "Import execution failed.")
      }

      setImportResult(data)
      setPreviewData(null)
      setParsedRows([])
      setFileName(null)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message || "Import execution failed.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Instructions & Template Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader className="pb-3 border-b bg-muted/20">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              Canonical Timetable Format (XLSX / CSV)
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              WorkLedger uses normalized headers to map faculty schedules directly into recurring weekly templates.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="p-3 rounded-lg bg-muted/50 font-mono text-[11px] overflow-x-auto text-foreground">
              faculty_id,faculty_name,faculty_email,day,start_time,end_time,task_name,credits,description
            </div>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
              <li><strong className="text-foreground">day:</strong> MON, TUE, WED, THU, FRI, SAT</li>
              <li><strong className="text-foreground">times:</strong> 24-hour HH:MM format (e.g. 09:15, 14:30)</li>
              <li><strong className="text-foreground">faculty:</strong> Resolved by <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">faculty_email</code> or <code className="bg-muted px-1 py-0.5 rounded text-foreground font-mono">faculty_id</code></li>
              <li><strong className="text-foreground">credits:</strong> Numeric weight per session (e.g. 1.0)</li>
            </ul>
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Sample Template
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Download the official CSV template with standard column headers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground block">Select Target Work Cycle</label>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="w-full h-9 px-3 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {workCycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.status === "ACTIVE" ? "(Active)" : `(${c.status})`}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
          <div className="p-4 border-t bg-muted/20">
            <Button
              onClick={handleDownloadTemplate}
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download CSV Template</span>
            </Button>
          </div>
        </Card>
      </div>

      {/* 2. File Upload Box */}
      <Card className="p-8 text-center border-dashed">
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
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Upload className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {fileName ? `Selected: ${fileName}` : "Click to upload timetable (.xlsx or .csv)"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Supports normalized weekly timetables with faculty email / ID mapping.
            </p>
          </div>
          <Button
            size="sm"
            type="button"
            className="text-xs mt-2"
          >
            Browse Files
          </Button>
        </label>
      </Card>

      {errorMsg && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* 3. Dry-Run Validation Preview */}
      {isValidating && (
        <div className="py-8 text-center text-muted-foreground text-xs flex items-center justify-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span>Validating timetable rows and resolving faculty accounts...</span>
        </div>
      )}

      {previewData && !isValidating && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="p-4 text-center">
              <span className="text-xs text-muted-foreground block font-mono">Total Rows</span>
              <span className="text-2xl font-bold font-mono text-foreground">{previewData.totalRows}</span>
            </Card>

            <Card className="p-4 text-center border-emerald-500/30 bg-emerald-500/5">
              <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-mono">Valid Sessions</span>
              <span className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{previewData.validCount}</span>
            </Card>

            <Card className="p-4 text-center border-destructive/30 bg-destructive/5">
              <span className="text-xs text-destructive block font-mono">Rejected Rows</span>
              <span className="text-2xl font-bold font-mono text-destructive">{previewData.rejectedCount}</span>
            </Card>
          </div>

          {/* Valid Rows Preview Table */}
          {previewData.validCount > 0 && (
            <Card>
              <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    Valid Sessions Preview ({previewData.validCount} items)
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Preview of sessions to be imported as recurring weekly templates.
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={handleConfirmImport}
                  disabled={isImporting}
                  className="text-xs gap-1.5"
                >
                  {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  <span>Confirm & Import All</span>
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                        <th className="py-2.5 px-4 font-semibold">Faculty</th>
                        <th className="py-2.5 px-4 font-semibold">Day</th>
                        <th className="py-2.5 px-4 font-semibold">Time Slot</th>
                        <th className="py-2.5 px-4 font-semibold">Session Title</th>
                        <th className="py-2.5 px-4 font-semibold">Credits</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {previewData.validTemplatesPreview?.map((t: any, idx: number) => (
                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                          <td className="py-2.5 px-4 text-foreground font-medium">
                            {t._facultyName || t.assigned_to_id}
                            <span className="block text-[10px] text-muted-foreground font-mono">{t._facultyEmail}</span>
                          </td>
                          <td className="py-2.5 px-4 font-mono text-primary font-bold">{t.weekly_day}</td>
                          <td className="py-2.5 px-4 font-mono text-muted-foreground">
                            {t.start_time} – {t.end_time}
                          </td>
                          <td className="py-2.5 px-4 text-foreground font-medium">{t.title}</td>
                          <td className="py-2.5 px-4 font-mono font-bold text-foreground">+{t.credit_value}</td>
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
            <Card className="border-destructive/30">
              <CardHeader className="pb-3 border-b bg-destructive/5">
                <CardTitle className="text-sm font-bold text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Rejected Rows ({previewData.rejectedCount})
                </CardTitle>
                <CardDescription className="text-xs text-destructive/80">
                  These rows were rejected and will not be imported. Please correct them in your source file.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b bg-destructive/10 text-destructive font-mono text-[11px]">
                        <th className="py-2.5 px-4 font-semibold">Row #</th>
                        <th className="py-2.5 px-4 font-semibold">Faculty Info</th>
                        <th className="py-2.5 px-4 font-semibold">Task Name</th>
                        <th className="py-2.5 px-4 font-semibold">Rejection Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y text-foreground">
                      {previewData.rejectedRows?.map((r: any, idx: number) => (
                        <tr key={idx}>
                          <td className="py-2.5 px-4 font-mono text-destructive">{r.rowNumber}</td>
                          <td className="py-2.5 px-4 font-mono text-muted-foreground">
                            {r.row.faculty_email || r.row.faculty_id || "Missing"}
                          </td>
                          <td className="py-2.5 px-4">{r.row.task_name || "Missing"}</td>
                          <td className="py-2.5 px-4 font-medium text-destructive">{r.reason}</td>
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
        <Card className="border-emerald-500/30 bg-emerald-500/10 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground">Import Successfully Completed</h4>
              <p className="text-xs text-muted-foreground">{importResult.message}</p>
            </div>
          </div>
          <div className="pt-2 flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => router.push(`/${orgId}/dept-admin/schedules`)}
              className="text-xs"
            >
              View Schedules Matrix
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
