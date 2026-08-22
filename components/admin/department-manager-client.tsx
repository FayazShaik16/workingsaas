"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Plus,
  Users,
  ShieldCheck,
  RefreshCw,
  FolderTree,
} from "lucide-react"
import { toast } from "sonner"

interface DepartmentItem {
  id: string
  name: string
  code: string
  leadUserId: string | null
  leadName: string
  memberCount: number
  createdAt: string
}

interface UserItem {
  id: string
  name: string
  email: string
  designation?: string
}

interface Props {
  orgId: string
  initialDepartments: DepartmentItem[]
  availableUsers: UserItem[]
}

export function DepartmentManagerClient({ orgId, initialDepartments, availableUsers }: Props) {
  const [departments, setDepartments] = useState<DepartmentItem[]>(initialDepartments)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  // Form states
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [leadUserId, setLeadUserId] = useState("")

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error("Department name is required.")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/admin/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          code: code.trim() || undefined,
          leadUserId: leadUserId || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to create department.")
      }

      toast.success(json.message || "Department created successfully.")
      const newDept: DepartmentItem = {
        id: json.department.id,
        name: json.department.name,
        code: json.department.code || name.trim().slice(0, 4).toUpperCase(),
        leadUserId: json.department.lead_user_id || null,
        leadName: availableUsers.find((u) => u.id === json.department.lead_user_id)?.name || "Unassigned",
        memberCount: 0,
        createdAt: json.department.created_at || new Date().toISOString(),
      }

      setDepartments((prev) => [...prev, newDept])
      setName("")
      setCode("")
      setLeadUserId("")
      setShowForm(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to create department.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {departments.length} Department{departments.length === 1 ? "" : "s"}
          </Badge>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          size="sm"
          className="gap-1.5 text-xs"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancel" : "Create Department"}
        </Button>
      </div>

      {/* ── Create Department Form Card ── */}
      {showForm && (
        <Card className="border-border/60 bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">New Institutional Department</CardTitle>
            <CardDescription className="text-xs">
              Creates a direct organizational unit without artificial root or parent departments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dept-name" className="text-xs">Department Name *</Label>
                  <Input
                    id="dept-name"
                    placeholder="e.g. Computer Science and Engineering"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="dept-code" className="text-xs">Department Code (Optional)</Label>
                  <Input
                    id="dept-code"
                    placeholder="e.g. CSE"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="dept-lead" className="text-xs">Department Lead / HOD (Optional)</Label>
                <select
                  id="dept-lead"
                  value={leadUserId}
                  onChange={(e) => setLeadUserId(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">-- Assign Lead Later --</option>
                  {availableUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowForm(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading} className="gap-1 text-xs">
                  {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
                  Create Department
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* ── Departments List ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {departments.length === 0 ? (
          <div className="col-span-full py-12 rounded-xl border border-dashed text-center text-xs text-muted-foreground space-y-2">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="font-medium text-foreground">No departments created yet.</p>
            <p>Click &quot;Create Department&quot; above to add your first academic department.</p>
          </div>
        ) : (
          departments.map((dept) => (
            <Card key={dept.id} className="border-border/60 bg-card hover:border-border transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 min-w-0">
                    <CardTitle className="text-sm font-semibold truncate text-foreground">
                      {dept.name}
                    </CardTitle>
                    <span className="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
                      {dept.code}
                    </span>
                  </div>
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-1 text-xs">
                <div className="flex items-center justify-between text-muted-foreground border-t pt-2.5">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-sky-500" />
                    HOD / Lead:
                  </span>
                  <span className="font-medium text-foreground truncate max-w-[140px]">
                    {dept.leadName}
                  </span>
                </div>

                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-indigo-500" />
                    Assigned Faculty:
                  </span>
                  <span className="font-medium text-foreground font-mono">
                    {dept.memberCount}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
