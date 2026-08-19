"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building2, Plus, Loader2, GraduationCap } from "lucide-react"

interface Programme {
  id: string
  name: string
  code: string
  created_at: string
}

interface ProgrammesClientProps {
  orgId: string
  deptId: string
  initialProgrammes: Programme[]
}

export function ProgrammesClient({ orgId, deptId, initialProgrammes }: ProgrammesClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const db = supabase as any

  const [programmes, setProgrammes] = useState<Programme[]>(initialProgrammes)
  const [showAddForm, setShowAddForm] = useState(false)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !code.trim()) return

    setIsSaving(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/dept-admin/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE_PROGRAM",
          payload: {
            orgId,
            deptId: deptId || null,
            name: name.trim(),
            code: code.trim().toUpperCase(),
          },
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to create programme")

      setProgrammes((prev) => [json.data, ...prev])
      setName("")
      setCode("")
      setShowAddForm(false)
      router.refresh()
    } catch (err: any) {
      console.error("Failed to create programme:", err)
      setErrorMsg(err.message || "Failed to create programme")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Academic Programmes & Degrees</h1>
          <p className="text-muted-foreground mt-1">Manage departmental academic offerings, curricula & credits</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-1.5 font-medium">
          <Plus className="h-4 w-4" /> {showAddForm ? "Cancel" : "Add Programme"}
        </Button>
      </div>

      {showAddForm && (
        <Card className="border-2 border-primary/30 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" /> Create Academic Programme
            </CardTitle>
            <CardDescription className="text-xs">
              Define a degree track (e.g. B.Tech Computer Science, M.Tech Data Science)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4 max-w-lg">
              {errorMsg && (
                <div className="p-3 text-xs rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
                  {errorMsg}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Programme Name</label>
                  <Input
                    placeholder="e.g. B.Tech Computer Science"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Programme Code</label>
                  <Input
                    placeholder="e.g. CSE or BTECH-CSE"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isSaving} size="sm" className="font-semibold">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                Save Programme
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
              <Building2 className="h-5 w-5 text-primary" /> Registered Programmes
            </CardTitle>
            <Badge variant="outline" className="font-bold text-xs">
              {programmes.length} Programmes
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {programmes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <GraduationCap className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-bold text-foreground">No Programmes Registered</p>
              <p className="text-xs">Click &quot;Add Programme&quot; above to create your department degrees.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead className="font-bold text-xs">Code</TableHead>
                  <TableHead className="font-bold text-xs">Programme Name</TableHead>
                  <TableHead className="font-bold text-xs">Status</TableHead>
                  <TableHead className="font-bold text-xs">Created Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {programmes.map((p) => (
                  <TableRow key={p.id} className="hover:bg-muted/30 transition">
                    <TableCell className="font-mono font-bold text-xs text-primary">{p.code}</TableCell>
                    <TableCell className="font-semibold text-foreground text-xs">{p.name}</TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                        ACTIVE
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground font-medium">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Active"}
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
