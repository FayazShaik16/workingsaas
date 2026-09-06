"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  FileSpreadsheet,
  Upload,
  Download,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  KeyRound,
  RefreshCw,
  FileText,
} from "lucide-react"
import { toast } from "sonner"

interface Props {
  orgId: string
}

export function BulkImportClient({ orgId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [preview, setPreview] = useState<any | null>(null)
  const [result, setResult] = useState<any | null>(null)

  // 1. Template Downloader
  const downloadPeopleTemplate = () => {
    const csvContent =
      "full_name,email,designation,role,department,faculty_id\n" +
      "Dr. R. HOD,hod.cse@mvgr.demo,Professor & HOD,ORG_UNIT_LEAD,CSE,CSE-HOD-001\n" +
      "Dept Schedule Admin,deptadmin.cse@mvgr.demo,Schedule Coordinator,DEPT_ADMIN,CSE,\n" +
      "Faculty One,faculty.one@mvgr.demo,Assistant Professor,MEMBER,CSE,CSE-FAC-001\n" +
      "Faculty Two,faculty.two@mvgr.demo,Assistant Professor,MEMBER,CSE,CSE-FAC-002\n" +
      "Director One,director@mvgr.demo,Director,DIRECTOR,,\n" +
      "Finance One,finance@mvgr.demo,Finance Administrator,FINANCE_ADMIN,,\n"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "people_import_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Downloaded people_import_template.csv")
  }

  const downloadTimetableTemplate = () => {
    const csvContent =
      "faculty_id,faculty_name,faculty_email,day,start_time,end_time,task_name,credits,description\n" +
      "CSE-FAC-001,Faculty One,faculty.one@mvgr.demo,MON,09:15,10:15,V SE SEC-A,1.0,Weekly scheduled academic session\n" +
      "CSE-FAC-001,Faculty One,faculty.one@mvgr.demo,WED,10:15,11:15,V SE SEC-B,1.0,Weekly scheduled academic session\n" +
      "CSE-FAC-001,Faculty One,faculty.one@mvgr.demo,FRI,11:15,12:15,VII SE CSD,1.0,Weekly scheduled academic session\n"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "timetable_import_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success("Downloaded timetable_import_template.csv")
  }

  // 2. CSV Parser
  const parseCSV = (text: string) => {
    const lines = text.split(/\r\n|\n/).filter((l) => l.trim().length > 0)
    if (lines.length < 2) return []

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""))
    const rows = []

    for (let i = 1; i < lines.length; i++) {
      const currentline = lines[i].split(",").map((c) => c.trim().replace(/['"]/g, ""))
      if (currentline.length === 0 || (currentline.length === 1 && !currentline[0])) continue

      const obj: any = {}
      for (let j = 0; j < header.length; j++) {
        obj[header[j]] = currentline[j] || ""
      }
      rows.push(obj)
    }
    return rows
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return

    setFile(selected)
    setResult(null)
    setParsing(true)

    try {
      const text = await selected.text()
      const rows = parseCSV(text)

      if (rows.length === 0) {
        toast.error("File is empty or could not be parsed.")
        setParsing(false)
        return
      }

      // Dry run preview
      const res = await fetch("/api/admin/bulk-import-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, dryRun: true }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to validate import file.")

      setPreview({ ...data, rawRows: rows })
      toast.success(`Validated ${data.validCount} rows successfully.`)
    } catch (err: any) {
      toast.error(err.message || "Failed to read CSV file.")
    } finally {
      setParsing(false)
    }
  }

  const executeImport = async () => {
    if (!preview?.rawRows) return

    try {
      setImporting(true)
      const res = await fetch("/api/admin/bulk-import-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.rawRows, dryRun: false }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Import failed.")

      setResult(data)
      setPreview(null)
      setFile(null)
      toast.success(data.message || "Bulk import executed successfully.")
    } catch (err: any) {
      toast.error(err.message || "Import execution error.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Action cards for Template Downloads */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-xl border border-muted/60 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-sky-500" /> People Import Template
            </CardTitle>
            <CardDescription className="text-xs">
              CSV template for bulk provisioning HODs, Faculty, Dept Admins, Directors, and Finance.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              onClick={downloadPeopleTemplate}
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5 h-8"
            >
              <Download className="h-3.5 w-3.5" /> Download People Import Template (.csv)
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-xl border border-muted/60 bg-card/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-500" /> Timetable Import Template
            </CardTitle>
            <CardDescription className="text-xs">
              CSV template for Department Admins to import recurring weekly faculty schedules.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button
              onClick={downloadTimetableTemplate}
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5 h-8"
            >
              <Download className="h-3.5 w-3.5" /> Download Timetable Import Template (.csv)
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* File Upload Zone */}
      <Card className="rounded-xl border border-muted/60 bg-card/50">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" /> Upload People Data File (.CSV)
          </CardTitle>
          <CardDescription className="text-xs">
            Select or drag your CSV file. The system will validate all roles, auto-detect missing departments, and present an interactive preview before creating records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative border-2 border-dashed rounded-xl p-8 text-center space-y-3 hover:bg-muted/40 transition">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <FileText className="h-10 w-10 text-muted-foreground mx-auto" />
            <div>
              <p className="text-xs font-semibold text-foreground">
                {file ? file.name : "Click to select or drop CSV file here"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Columns: full_name, email, designation, role, department, faculty_id
              </p>
            </div>
            {parsing && (
              <div className="flex items-center justify-center gap-2 text-xs text-primary font-medium">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Validating CSV structure...
              </div>
            )}
          </div>

          {/* Preview Panel */}
          {preview && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3 mr-1" /> {preview.validCount} Valid Row{preview.validCount === 1 ? "" : "s"}
                  </Badge>
                  {preview.rejectedCount > 0 && (
                    <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-600 border-rose-500/20">
                      <AlertCircle className="h-3 w-3 mr-1" /> {preview.rejectedCount} Invalid Row{preview.rejectedCount === 1 ? "" : "s"}
                    </Badge>
                  )}
                  {preview.newDepartments?.length > 0 && (
                    <Badge variant="outline" className="text-xs bg-sky-500/10 text-sky-600 border-sky-500/20">
                      <Building2 className="h-3 w-3 mr-1" /> +{preview.newDepartments.length} Department{preview.newDepartments.length === 1 ? "" : "s"} will be created ({preview.newDepartments.join(", ")})
                    </Badge>
                  )}
                </div>

                <Button
                  onClick={executeImport}
                  disabled={importing || preview.validCount === 0}
                  className="text-xs h-8 gap-1.5"
                >
                  {importing ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Provisioning Accounts...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Execute Bulk Ingestion ({preview.validCount} Users)
                    </>
                  )}
                </Button>
              </div>

              {/* Validation Summary Table */}
              <div className="max-h-60 overflow-y-auto rounded-lg border text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Name</th>
                      <th className="p-2.5">Email</th>
                      <th className="p-2.5">Role</th>
                      <th className="p-2.5">Department</th>
                      <th className="p-2.5">Faculty ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/30">
                    {preview.validRows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2.5 font-medium">{r.name}</td>
                        <td className="p-2.5 font-mono text-muted-foreground">{r.email}</td>
                        <td className="p-2.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {r.scopeLevel}
                          </Badge>
                        </td>
                        <td className="p-2.5 text-muted-foreground">{r.deptName || "Global"}</td>
                        <td className="p-2.5 font-mono text-[10px]">{r.facultyId || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Rejected Rows Notice */}
              {preview.rejectedRows?.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" /> Skipped Invalid Rows:
                  </p>
                  {preview.rejectedRows.map((rej: any, idx: number) => (
                    <p key={idx} className="text-[11px]">
                      • Row {rej.rowNumber}: {rej.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Success Result Summary */}
          {result && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-sm">
                <CheckCircle2 className="h-5 w-5" /> {result.message}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded-lg bg-background/60 border">
                  <p className="text-[11px] text-muted-foreground">Accounts Created</p>
                  <p className="text-base font-bold text-foreground">{result.createdCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-background/60 border">
                  <p className="text-[11px] text-muted-foreground">Existing Linked</p>
                  <p className="text-base font-bold text-foreground">{result.existingCount}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-background/60 border">
                  <p className="text-[11px] text-muted-foreground">New Departments</p>
                  <p className="text-base font-bold text-foreground">{result.createdDepartments?.length || 0}</p>
                </div>
                <div className="p-2.5 rounded-lg bg-background/60 border">
                  <p className="text-[11px] text-muted-foreground">Must Change Password</p>
                  <p className="text-base font-bold text-foreground">{result.passwordResetRequiredCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background/80 border text-xs text-muted-foreground">
                <KeyRound className="h-4 w-4 text-amber-500" />
                <span>
                  All newly created users have been provisioned with temporary credentials and will be prompted to set their permanent password on first login.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
