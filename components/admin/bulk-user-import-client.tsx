"use client"

import { useState, useRef } from "react"
import * as XLSX from "xlsx"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Users,
  Building2,
  ShieldCheck,
  RefreshCw,
  Loader2,
} from "lucide-react"

interface BulkUserImportClientProps {
  orgId: string
  scope: "DIRECTOR" | "DEPT_ADMIN"
  deptId?: string
  deptName?: string
}

type Step = "UPLOAD" | "MAPPING" | "PREVIEW" | "RESULTS"

interface RawRow {
  [key: string]: any
}

interface MappedUser {
  email: string
  name: string
  role: string
  department: string
  designation: string
  employeeId: string
  isValid: boolean
  errors: string[]
  isNewDept?: boolean
}

export function BulkUserImportClient({
  orgId,
  scope,
  deptId,
  deptName,
}: BulkUserImportClientProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>("UPLOAD")
  const [fileName, setFileName] = useState<string>("")
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<RawRow[]>([])

  // Column Mappings (Target Field -> Raw Header)
  const [mapping, setMapping] = useState<{
    email: string
    name: string
    role: string
    department: string
    designation: string
    employeeId: string
  }>({
    email: "",
    name: "",
    role: "",
    department: "",
    designation: "",
    employeeId: "",
  })

  const [mappedUsers, setMappedUsers] = useState<MappedUser[]>([])
  const [importing, setImporting] = useState(false)
  const [resultsData, setResultsData] = useState<any>(null)

  // 1. Download CSV Template
  const downloadTemplate = () => {
    const csvContent =
      "Email,Name,Role,Department,Designation,Employee ID\n" +
      "faculty.cse1@demo.workledger.in,Dr. Rajesh Sharma,Faculty,Computer Science & Engineering,Associate Professor,EMP-CSE-101\n" +
      "cse.hod@demo.workledger.in,Dr. Ananya Roy,HOD,Computer Science & Engineering,Professor & HOD,EMP-CSE-001\n" +
      "finance.lead@demo.workledger.in,Suresh Verma,Finance,Finance & Accounts,Finance Officer,EMP-FIN-010\n"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "faculty_import_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 2. Parse file on upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: "binary" })
        const wsName = wb.SheetNames[0]
        const ws = wb.Sheets[wsName]
        const data = XLSX.utils.sheet_to_json<RawRow>(ws, { header: 1 })

        if (!data || data.length < 2) {
          alert("File is empty or missing headers.")
          return
        }

        const rawHeaders = (data[0] as any[]).map((h) => String(h || "").trim())
        const rows = data.slice(1).map((rowArr: any) => {
          const rowObj: RawRow = {}
          rawHeaders.forEach((header, idx) => {
            rowObj[header] = rowArr[idx] !== undefined ? String(rowArr[idx]).trim() : ""
          })
          return rowObj
        }).filter((r) => Object.values(r).some((v) => v !== ""))

        setHeaders(rawHeaders)
        setRawRows(rows)

        // Intelligent Auto-Guessing
        const guess: typeof mapping = {
          email: "",
          name: "",
          role: "",
          department: "",
          designation: "",
          employeeId: "",
        }

        rawHeaders.forEach((h) => {
          const lower = h.toLowerCase()
          if (lower.includes("mail")) guess.email = h
          else if (lower.includes("dept") || lower.includes("department") || lower.includes("branch")) guess.department = h
          else if (lower.includes("role")) guess.role = h
          else if (lower.includes("desig") || lower.includes("title")) guess.designation = h
          else if (lower.includes("name") || lower.includes("faculty")) guess.name = h
          else if (lower.includes("id") || lower.includes("emp") || lower.includes("code")) guess.employeeId = h
        })

        setMapping(guess)
        setStep("MAPPING")
      } catch (err) {
        console.error("Parse error:", err)
        alert("Failed to parse sheet. Please ensure it is a valid CSV or XLSX file.")
      }
    }

    reader.readAsBinaryString(file)
  }

  // 3. Confirm Mapping & Generate Preview
  const generatePreview = () => {
    if (!mapping.email) {
      alert("Email column mapping is required.")
      return
    }

    const seenEmails = new Set<string>()
    const users: MappedUser[] = rawRows.map((row) => {
      const email = String(row[mapping.email] || "").trim().toLowerCase()
      const name = mapping.name ? String(row[mapping.name] || "").trim() : email.split("@")[0]
      const role = mapping.role ? String(row[mapping.role] || "").trim() : "Faculty"
      const department =
        scope === "DEPT_ADMIN" && deptName
          ? deptName
          : mapping.department
          ? String(row[mapping.department] || "").trim()
          : "General"
      const designation = mapping.designation ? String(row[mapping.designation] || "").trim() : "Assistant Professor"
      const employeeId = mapping.employeeId ? String(row[mapping.employeeId] || "").trim() : ""

      const errors: string[] = []
      if (!email || !email.includes("@")) {
        errors.push("Invalid email address")
      }
      if (seenEmails.has(email)) {
        errors.push("Duplicate in file")
      } else if (email) {
        seenEmails.add(email)
      }

      return {
        email,
        name,
        role,
        department,
        designation,
        employeeId,
        isValid: errors.length === 0,
        errors,
      }
    })

    setMappedUsers(users)
    setStep("PREVIEW")
  }

  // 4. Submit Import Payload
  const executeImport = async () => {
    setImporting(true)
    try {
      const validUsers = mappedUsers.filter((u) => u.isValid)
      const res = await fetch("/api/admin/bulk-import-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          users: validUsers,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Import request failed.")
      }

      setResultsData(json)
      setStep("RESULTS")
    } catch (err: any) {
      alert(err.message || "Failed to process import.")
    } finally {
      setImporting(false)
    }
  }

  // 5. Download failure report
  const downloadResultsCSV = () => {
    if (!resultsData?.results) return
    const csvContent =
      "Email,Name,Status,Warnings\n" +
      resultsData.results
        .map(
          (r: any) =>
            `"${r.email}","${r.name}","${r.status}","${(r.warnings || []).join("; ")}"`
        )
        .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `import_report_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex items-center justify-between border-b pb-4 text-xs font-bold">
        <div className={`flex items-center gap-2 ${step === "UPLOAD" ? "text-primary font-extrabold" : "text-muted-foreground"}`}>
          <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">1</span>
          Upload File
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
        <div className={`flex items-center gap-2 ${step === "MAPPING" ? "text-primary font-extrabold" : "text-muted-foreground"}`}>
          <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">2</span>
          Column Mapping
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
        <div className={`flex items-center gap-2 ${step === "PREVIEW" ? "text-primary font-extrabold" : "text-muted-foreground"}`}>
          <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">3</span>
          Validation Preview
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
        <div className={`flex items-center gap-2 ${step === "RESULTS" ? "text-primary font-extrabold" : "text-muted-foreground"}`}>
          <span className="w-6 h-6 rounded-full border flex items-center justify-center text-xs">4</span>
          Execution Report
        </div>
      </div>

      {/* STEP 1: UPLOAD */}
      {step === "UPLOAD" && (
        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Select Faculty Spreadsheet
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Upload .csv or .xlsx roster. Accounts will be provisioned with institutional security credentials.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="gap-1.5 text-xs font-bold shadow-xs"
              >
                <Download className="h-4 w-4" /> Download Sample CSV
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-8">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
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
                  Click to select or drag and drop your roster file
                </p>
                <p className="text-xs text-muted-foreground">
                  Supports Microsoft Excel (.xlsx) and Comma-Separated Values (.csv)
                </p>
              </div>
              <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                Multi-Department Auto-Grouping Supported
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 2: COLUMN MAPPING */}
      {step === "MAPPING" && (
        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="pb-4 border-b bg-muted/20">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-black text-foreground">
                  Match File Headers to WorkLedger Attributes
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  File: <span className="font-mono font-bold text-foreground">{fileName}</span> ({rawRows.length} rows detected)
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep("UPLOAD")}
                className="text-xs"
              >
                Upload Different File
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email (Required) */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Email Address <span className="text-destructive">*</span></span>
                  <Badge variant="outline" className="text-[9px]">Required</Badge>
                </label>
                <select
                  value={mapping.email}
                  onChange={(e) => setMapping({ ...mapping, email: e.target.value })}
                  className="w-full text-xs rounded-lg border bg-background p-2 font-medium"
                >
                  <option value="">-- Select Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Full Name */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <label className="text-xs font-bold text-foreground">Full Name</label>
                <select
                  value={mapping.name}
                  onChange={(e) => setMapping({ ...mapping, name: e.target.value })}
                  className="w-full text-xs rounded-lg border bg-background p-2 font-medium"
                >
                  <option value="">-- Select Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Department */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <label className="text-xs font-bold text-foreground">Department Unit</label>
                {scope === "DEPT_ADMIN" && deptName ? (
                  <div className="text-xs font-mono font-bold text-primary p-2 border rounded-lg bg-primary/5">
                    Locked to: {deptName}
                  </div>
                ) : (
                  <select
                    value={mapping.department}
                    onChange={(e) => setMapping({ ...mapping, department: e.target.value })}
                    className="w-full text-xs rounded-lg border bg-background p-2 font-medium"
                  >
                    <option value="">-- Select Header --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Role */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <label className="text-xs font-bold text-foreground">Role / Privilege Level</label>
                <select
                  value={mapping.role}
                  onChange={(e) => setMapping({ ...mapping, role: e.target.value })}
                  className="w-full text-xs rounded-lg border bg-background p-2 font-medium"
                >
                  <option value="">-- Select Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Designation */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <label className="text-xs font-bold text-foreground">Academic Designation</label>
                <select
                  value={mapping.designation}
                  onChange={(e) => setMapping({ ...mapping, designation: e.target.value })}
                  className="w-full text-xs rounded-lg border bg-background p-2 font-medium"
                >
                  <option value="">-- Select Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>

              {/* Employee ID */}
              <div className="p-4 rounded-xl border bg-muted/20 space-y-1.5">
                <label className="text-xs font-bold text-foreground">Employee / Faculty Code</label>
                <select
                  value={mapping.employeeId}
                  onChange={(e) => setMapping({ ...mapping, employeeId: e.target.value })}
                  className="w-full text-xs rounded-lg border bg-background p-2 font-medium"
                >
                  <option value="">-- Select Header --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("UPLOAD")}
                className="text-xs font-bold"
              >
                Back
              </Button>
              <Button
                size="sm"
                onClick={generatePreview}
                className="text-xs font-bold gap-1.5"
              >
                Continue to Preview <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 3: PREVIEW */}
      {step === "PREVIEW" && (
        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="pb-4 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Review Ingestion Plan ({mappedUsers.length} Users)
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Valid accounts: {mappedUsers.filter((u) => u.isValid).length} · Issues: {mappedUsers.filter((u) => !u.isValid).length}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("MAPPING")}
                className="text-xs font-bold"
              >
                Adjust Mappings
              </Button>
              <Button
                size="sm"
                disabled={importing || mappedUsers.filter((u) => u.isValid).length === 0}
                onClick={executeImport}
                className="text-xs font-bold gap-1.5 shadow-xs"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Provisioning Accounts...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" /> Execute Ingestion ({mappedUsers.filter((u) => u.isValid).length})
                  </>
                )}
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto max-h-[450px]">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Email</TableHead>
                    <TableHead className="text-xs font-bold">Name</TableHead>
                    <TableHead className="text-xs font-bold">Department</TableHead>
                    <TableHead className="text-xs font-bold">Role / Level</TableHead>
                    <TableHead className="text-xs font-bold">Designation</TableHead>
                    <TableHead className="text-xs font-bold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappedUsers.map((u, i) => (
                    <TableRow key={i} className="hover:bg-muted/20 text-xs">
                      <TableCell className="font-mono font-medium">{u.email}</TableCell>
                      <TableCell className="font-bold text-foreground">{u.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-medium">
                          {u.department}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase">
                          {u.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.designation}</TableCell>
                      <TableCell>
                        {u.isValid ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Valid
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            {u.errors.join(", ")}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 4: EXECUTION REPORT */}
      {step === "RESULTS" && resultsData && (
        <Card className="rounded-2xl border-2 shadow-md">
          <CardHeader className="pb-4 border-b bg-muted/20 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-foreground flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                Ingestion Completed Successfully
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {resultsData.createdCount} accounts created · {resultsData.linkedCount} linked · {resultsData.errorCount} failed
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={downloadResultsCSV}
                className="gap-1.5 text-xs font-bold shadow-xs"
              >
                <Download className="h-4 w-4" /> Download Report
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setStep("UPLOAD")
                  setRawRows([])
                  setMappedUsers([])
                  setResultsData(null)
                }}
                className="text-xs font-bold gap-1.5"
              >
                <RefreshCw className="h-4 w-4" /> Import Another File
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <span className="text-xs font-bold uppercase tracking-wider block">New Accounts Created</span>
                <span className="text-3xl font-black">{resultsData.createdCount}</span>
              </div>
              <div className="p-4 rounded-xl border bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400">
                <span className="text-xs font-bold uppercase tracking-wider block">Existing Accounts Linked</span>
                <span className="text-3xl font-black">{resultsData.linkedCount}</span>
              </div>
              <div className="p-4 rounded-xl border bg-muted/40 border-muted">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Errors / Skipped</span>
                <span className="text-3xl font-black text-foreground">{resultsData.errorCount}</span>
              </div>
            </div>

            {/* Results Table */}
            <div className="border rounded-xl overflow-hidden max-h-96 overflow-y-auto">
              <Table>
                <TableHeader className="bg-muted/40 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="text-xs font-bold">Email</TableHead>
                    <TableHead className="text-xs font-bold">Name</TableHead>
                    <TableHead className="text-xs font-bold">Status</TableHead>
                    <TableHead className="text-xs font-bold">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {resultsData.results?.map((r: any, idx: number) => (
                    <TableRow key={idx} className="hover:bg-muted/20 text-xs">
                      <TableCell className="font-mono font-semibold">{r.email}</TableCell>
                      <TableCell className="font-bold text-foreground">{r.name}</TableCell>
                      <TableCell>
                        {r.status === "created" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Created
                          </Badge>
                        ) : r.status === "linked" ? (
                          <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 text-[10px] font-bold">
                            Linked
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            Failed
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-[11px]">
                        {r.error || (r.warnings && r.warnings.join(", ")) || "Ready for first login"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
