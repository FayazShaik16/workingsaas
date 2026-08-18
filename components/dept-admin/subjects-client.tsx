"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { BookOpen, Plus, Loader2 } from "lucide-react"

interface Subject {
  id: string
  code: string
  name: string
  credits: number
  subject_type: string
  semester: number
  program_id: string
  academic_programs?: { name: string; code: string }
}

interface SubjectsClientProps {
  orgId: string
  programmes: { id: string; name: string; code: string }[]
  initialSubjects: Subject[]
}

export function SubjectsClient({ orgId, programmes, initialSubjects }: SubjectsClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects)
  const [showAddForm, setShowAddForm] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [credits, setCredits] = useState(3)
  const [subjectType, setSubjectType] = useState("THEORY")
  const [semester, setSemester] = useState(1)
  const [programId, setProgramId] = useState(programmes[0]?.id || "")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return

    setIsSaving(true)
    setErrorMsg(null)

    try {
      const { data, error } = await db
        .from("subjects")
        .insert({
          organization_id: orgId,
          program_id: programId || null,
          code: code.trim().toUpperCase(),
          name: name.trim(),
          credits: Number(credits),
          subject_type: subjectType,
          semester: Number(semester),
          is_active: true,
        })
        .select(`
          id,
          code,
          name,
          credits,
          subject_type,
          semester,
          program_id,
          academic_programs (id, name, code)
        `)
        .single()

      if (error) throw error

      setSubjects((prev) => [data, ...prev])
      setCode("")
      setName("")
      setCredits(3)
      setSemester(1)
      setShowAddForm(false)
      router.refresh()
    } catch (err: any) {
      console.error("Failed to create subject:", err)
      setErrorMsg(err.message || "Failed to create subject")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Courses & Curriculum Subjects</h1>
          <p className="text-muted-foreground mt-1">Manage departmental course codes, syllabus requirements & credit weights</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-1.5 font-medium">
          <Plus className="h-4 w-4" /> {showAddForm ? "Cancel" : "Add Subject"}
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-2 border-primary/30 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" /> Register New Subject / Course
            </CardTitle>
            <CardDescription className="text-xs">
              Define credit weight, lecture/lab format, and programme affiliation
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Course Code</label>
                  <Input
                    placeholder="e.g. CS301 or MEC204"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className="text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Subject Name</label>
                  <Input
                    placeholder="e.g. Data Structures & Algorithms"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
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
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Type</label>
                  <select
                    value={subjectType}
                    onChange={(e) => setSubjectType(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-card border text-xs focus:outline-none focus:border-primary"
                  >
                    <option value="THEORY">Theory Lecture</option>
                    <option value="LAB">Laboratory / Practical</option>
                    <option value="PROJECT">Major/Minor Project</option>
                    <option value="SEMINAR">Seminar / Viva</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Semester</label>
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
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Academic Credits</label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={credits}
                    onChange={(e) => setCredits(Number(e.target.value))}
                    required
                    className="text-xs"
                  />
                </div>
              </div>

              <Button type="submit" disabled={isSaving} size="sm" className="font-semibold">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Save Course Subject
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
              <BookOpen className="h-5 w-5 text-primary" /> Registered Courses & Syllabi
            </CardTitle>
            <Badge variant="outline" className="font-bold text-xs">
              {subjects.length} Subjects
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {subjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <BookOpen className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-bold text-foreground">No Subjects Registered</p>
              <p className="text-xs">Click &quot;Add Subject&quot; above to configure your curriculum.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-xs">Course Code</TableHead>
                  <TableHead className="font-bold text-xs">Subject Name</TableHead>
                  <TableHead className="font-bold text-xs">Programme</TableHead>
                  <TableHead className="font-bold text-xs">Format</TableHead>
                  <TableHead className="font-bold text-xs">Semester</TableHead>
                  <TableHead className="font-bold text-xs">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map((s) => (
                  <TableRow key={s.id} className="hover:bg-muted/30 transition">
                    <TableCell className="font-mono font-bold text-xs text-primary">{s.code}</TableCell>
                    <TableCell className="font-semibold text-foreground text-xs">{s.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {(s.academic_programs as any)?.code || "Core"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.subject_type === "THEORY" ? "default" : "secondary"}
                        className="text-[10px] font-bold"
                      >
                        {s.subject_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono font-medium">Sem {s.semester}</TableCell>
                    <TableCell className="font-mono font-bold text-xs text-emerald-600 dark:text-emerald-400">
                      {s.credits} Credits
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
