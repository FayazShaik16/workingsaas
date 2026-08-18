"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Users, Plus, Loader2, Layers } from "lucide-react"

interface Batch {
  id: string
  year_of_study: number
  current_semester: number
  section: string
  student_count: number
  academic_year: string
  program_id: string
  academic_programs?: { name: string; code: string }
}

interface BatchesClientProps {
  orgId: string
  programmes: { id: string; name: string; code: string }[]
  initialBatches: Batch[]
}

export function BatchesClient({ orgId, programmes, initialBatches }: BatchesClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [batches, setBatches] = useState<Batch[]>(initialBatches)
  const [showAddForm, setShowAddForm] = useState(false)
  const [programId, setProgramId] = useState(programmes[0]?.id || "")
  const [yearOfStudy, setYearOfStudy] = useState(1)
  const [semester, setSemester] = useState(1)
  const [section, setSection] = useState("A")
  const [studentCount, setStudentCount] = useState(60)
  const [academicYear, setAcademicYear] = useState("2025-2026")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!section.trim()) return

    setIsSaving(true)
    setErrorMsg(null)

    try {
      const { data, error } = await db
        .from("academic_batches")
        .insert({
          organization_id: orgId,
          program_id: programId || null,
          year_of_study: Number(yearOfStudy),
          current_semester: Number(semester),
          section: section.trim().toUpperCase(),
          student_count: Number(studentCount),
          academic_year: academicYear,
          is_active: true,
        })
        .select(`
          id,
          year_of_study,
          current_semester,
          section,
          student_count,
          academic_year,
          program_id,
          academic_programs (id, name, code)
        `)
        .single()

      if (error) throw error

      setBatches((prev) => [data, ...prev])
      setSection("A")
      setShowAddForm(false)
      router.refresh()
    } catch (err: any) {
      console.error("Failed to create batch:", err)
      setErrorMsg(err.message || "Failed to create batch")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Batches & Cohorts</h1>
          <p className="text-muted-foreground mt-1">Manage academic years, sections & enrolled student capacity</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-1.5 font-medium">
          <Plus className="h-4 w-4" /> {showAddForm ? "Cancel" : "Create Cohort"}
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-2 border-primary/30 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" /> Create Academic Batch / Section
            </CardTitle>
            <CardDescription className="text-xs">
              Configure student cohort, semester level, and section code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4 max-w-2xl">
              {errorMsg && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {errorMsg}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Programme</label>
                  <select
                    value={programId}
                    onChange={(e) => setProgramId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border text-xs focus:outline-none focus:border-primary"
                  >
                    {programmes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Year of Study</label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={yearOfStudy}
                    onChange={(e) => setYearOfStudy(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Current Semester</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={semester}
                    onChange={(e) => setSemester(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Section</label>
                  <Input
                    placeholder="e.g. A, B, or C"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                    required
                    className="text-xs uppercase font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Student Count</label>
                  <Input
                    type="number"
                    min={1}
                    max={250}
                    value={studentCount}
                    onChange={(e) => setStudentCount(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Academic Year</label>
                  <Input
                    placeholder="e.g. 2025-2026"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSaving} size="sm" className="font-semibold">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Save Student Batch
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
              <Users className="h-5 w-5 text-primary" /> Active Student Batches & Sections
            </CardTitle>
            <Badge variant="outline" className="font-bold text-xs">
              {batches.length} Cohorts
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-bold text-foreground">No Batches Configured</p>
              <p className="text-xs">Click &quot;Create Cohort&quot; above to initialize student sections.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-xs">Cohort / Section</TableHead>
                  <TableHead className="font-bold text-xs">Programme</TableHead>
                  <TableHead className="font-bold text-xs">Year & Semester</TableHead>
                  <TableHead className="font-bold text-xs">Enrolled Capacity</TableHead>
                  <TableHead className="font-bold text-xs">Academic Year</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((b) => (
                  <TableRow key={b.id} className="hover:bg-muted/30 transition">
                    <TableCell className="font-bold text-xs text-foreground">
                      Year {b.year_of_study} — Section {b.section}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {(b.academic_programs as any)?.code || "Programme"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-bold">
                        Sem {b.current_semester}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono font-bold text-xs text-primary">
                      {b.student_count} Students
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {b.academic_year}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
