"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileSpreadsheet, Upload, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

interface ImportClientProps {
  orgId: string
  faculty: { id: string; email: string; name: string }[]
  subjects: { id: string; code: string; name: string }[]
  batches: { id: string; section: string; year_of_study: number }[]
}

export function ImportClient({ orgId, faculty, subjects, batches }: ImportClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<{ success: boolean; count?: number; error?: string } | null>(null)

  const handleDownloadSample = () => {
    const csvContent =
      "faculty_email,subject_code,year_of_study,section,day_of_week,period_number,room\n" +
      "faculty1@college.edu,CS301,3,A,MON,1,LH-101\n" +
      "faculty1@college.edu,CS301,3,A,WED,3,LH-101\n" +
      "faculty2@college.edu,CS302,3,B,TUE,2,LAB-1\n"

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "timetable_import_template.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleProcessImport = async () => {
    if (!file) return
    setIsProcessing(true)
    setResult(null)

    try {
      const text = await file.text()
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

      if (lines.length <= 1) {
        throw new Error("CSV file is empty or missing data rows.")
      }

      const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
      let importedSlots = 0

      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim())
        if (cols.length < 6) continue

        const row: Record<string, string> = {}
        header.forEach((h, idx) => {
          row[h] = cols[idx] || ""
        })

        const facultyMember = faculty.find((f) => f.email.toLowerCase() === row.faculty_email?.toLowerCase())
        const subject = subjects.find((s) => s.code.toUpperCase() === row.subject_code?.toUpperCase())
        const batch = batches.find(
          (b) =>
            b.section.toUpperCase() === row.section?.toUpperCase() &&
            Number(b.year_of_study) === Number(row.year_of_study || 1)
        )

        if (!facultyMember || !subject || !batch) {
          continue
        }

        // 1. Upsert Subject Assignment
        const { data: assignment, error: assignError } = await db
          .from("subject_assignments")
          .upsert(
            {
              organization_id: orgId,
              faculty_id: facultyMember.id,
              subject_id: subject.id,
              batch_id: batch.id,
              academic_year: "2025-2026",
              is_active: true,
            },
            { onConflict: "organization_id,faculty_id,subject_id,batch_id" }
          )
          .select("id")
          .single()

        const assignmentId = assignment?.id

        if (assignmentId) {
          const period = Number(row.period_number) || 1
          const day = row.day_of_week?.toUpperCase() || "MON"
          const room = row.room || "LH-101"

          // 2. Insert Timetable Slot
          await db.from("timetable_slots").insert({
            organization_id: orgId,
            subject_assignment_id: assignmentId,
            day_of_week: day,
            period_number: period,
            start_time: `${String(8 + period).padStart(2, "0")}:00:00`,
            end_time: `${String(8 + period).padStart(2, "0")}:50:00`,
            room,
            effective_from: new Date().toISOString().split("T")[0],
            is_active: true,
          })

          importedSlots++
        }
      }

      setResult({ success: true, count: importedSlots })
      setFile(null)
      router.refresh()
    } catch (err: any) {
      console.error("CSV import error:", err)
      setResult({ success: false, error: err.message || "Failed to process CSV import" })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk Faculty & Timetable Import</h1>
        <p className="text-muted-foreground mt-1">
          Upload structured CSV spreadsheets to bulk-allocate subjects, faculty assignments, and weekly class slots.
        </p>
      </div>

      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
            <FileSpreadsheet className="h-5 w-5 text-primary" /> CSV Data Ingestion Wizard
          </CardTitle>
          <CardDescription className="text-xs">
            Supports standardized CSV format: faculty_email, subject_code, year_of_study, section, day_of_week, period_number, room
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-5">
          <div className="border-2 border-dashed rounded-2xl p-8 text-center space-y-3 bg-muted/10 hover:bg-muted/30 transition cursor-pointer">
            <Upload className="h-10 w-10 text-primary mx-auto opacity-70" />
            <div>
              <p className="text-sm font-bold text-foreground">
                {file ? file.name : "Select your Timetable CSV file"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">Supports UTF-8 formatted .csv files up to 10MB</p>
            </div>
            <label className="inline-block">
              <input type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
              <Button size="sm" variant="outline" type="button" asChild>
                <span>{file ? "Change CSV File" : "Browse Files"}</span>
              </Button>
            </label>
          </div>

          {result && (
            <Card
              className={`border-2 ${
                result.success ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5"
              }`}
            >
              <CardContent className="p-4 flex items-center gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                )}
                <div className="text-xs">
                  <p className="font-bold text-foreground">
                    {result.success ? "CSV Import Completed Successfully!" : "Import Error"}
                  </p>
                  <p className="text-muted-foreground mt-0.5">
                    {result.success
                      ? `Successfully imported and mapped ${result.count || 0} timetable slot assignments.`
                      : result.error}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-2">
            <Button onClick={handleDownloadSample} variant="ghost" size="sm" className="gap-1.5 text-xs font-semibold">
              <Download className="h-4 w-4" /> Download Sample CSV Template
            </Button>
            <Button
              onClick={handleProcessImport}
              disabled={!file || isProcessing}
              size="sm"
              className="gap-1.5 font-bold"
            >
              {isProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
              {isProcessing ? "Processing CSV..." : "Execute Bulk Ingestion"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
