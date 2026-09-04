"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  Percent,
  Layers,
  Edit2,
  Trash2,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Check,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export interface WorkCycleItem {
  id: string
  organization_id: string
  name: string
  starts_on: string
  ends_on: string
  scheduled_weight_percentage: number
  salary_threshold_percentage: number
  salary_request_opens_day: number
  status: "ACTIVE" | "DRAFT" | "CLOSED" | string
  created_at?: string
}

interface Props {
  orgId: string
  initialCycles: WorkCycleItem[]
}

export function WorkCyclesManagerClient({ orgId, initialCycles }: Props) {
  const [cycles, setCycles] = useState<WorkCycleItem[]>(initialCycles)
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "DRAFT" | "CLOSED">("ALL")
  const [loading, setLoading] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Create Modal State
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [createName, setCreateName] = useState("")
  const [createStartsOn, setCreateStartsOn] = useState("")
  const [createEndsOn, setCreateEndsOn] = useState("")
  const [createSchedWeight, setCreateSchedWeight] = useState(75)
  const [createSalaryThresh, setCreateSalaryThresh] = useState(85)
  const [createOpensDay, setCreateOpensDay] = useState(26)
  const [createStatus, setCreateStatus] = useState<"ACTIVE" | "DRAFT">("ACTIVE")

  // Edit Modal State
  const [editingCycle, setEditingCycle] = useState<WorkCycleItem | null>(null)
  const [editName, setEditName] = useState("")
  const [editStartsOn, setEditStartsOn] = useState("")
  const [editEndsOn, setEditEndsOn] = useState("")
  const [editSchedWeight, setEditSchedWeight] = useState(75)
  const [editSalaryThresh, setEditSalaryThresh] = useState(85)
  const [editOpensDay, setEditOpensDay] = useState(26)
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "DRAFT" | "CLOSED">("ACTIVE")

  // Active Cycle
  const activeCycle = cycles.find((c) => c.status === "ACTIVE")

  const filteredCycles = cycles.filter((c) => {
    if (filter === "ALL") return true
    return c.status === filter
  })

  // Open Create Dialog with intelligent date defaults
  const handleOpenCreate = () => {
    const today = new Date()
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split("T")[0]
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      .toISOString()
      .split("T")[0]
    const monthName = today.toLocaleString("default", { month: "long" })

    setCreateName(`${monthName} ${today.getFullYear()} Accounting Cycle`)
    setCreateStartsOn(startOfMonth)
    setCreateEndsOn(endOfMonth)
    setCreateSchedWeight(75)
    setCreateSalaryThresh(85)
    setCreateOpensDay(26)
    setCreateStatus("ACTIVE")
    setShowCreateDialog(true)
  }

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) {
      toast.error("Cycle name is required.")
      return
    }
    if (!createStartsOn || !createEndsOn) {
      toast.error("Start and End dates are required.")
      return
    }
    if (new Date(createEndsOn) < new Date(createStartsOn)) {
      toast.error("End date cannot be earlier than start date.")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/admin/work-cycles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          starts_on: createStartsOn,
          ends_on: createEndsOn,
          scheduled_weight_percentage: Number(createSchedWeight),
          salary_threshold_percentage: Number(createSalaryThresh),
          salary_request_opens_day: Number(createOpensDay),
          status: createStatus,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to create work cycle.")
      }

      toast.success(json.message || "Work cycle created successfully.")
      const newCycle: WorkCycleItem = json.cycle

      if (createStatus === "ACTIVE") {
        setCycles((prev) => [
          newCycle,
          ...prev.map((c) => (c.id === newCycle.id ? c : { ...c, status: "CLOSED" as const })),
        ])
      } else {
        setCycles((prev) => [newCycle, ...prev])
      }

      setShowCreateDialog(false)
    } catch (err: any) {
      toast.error(err.message || "Failed to create cycle.")
    } finally {
      setLoading(false)
    }
  }

  // Open Edit Dialog
  const handleOpenEdit = (cycle: WorkCycleItem) => {
    setEditingCycle(cycle)
    setEditName(cycle.name)
    setEditStartsOn(cycle.starts_on)
    setEditEndsOn(cycle.ends_on)
    setEditSchedWeight(Number(cycle.scheduled_weight_percentage) || 75)
    setEditSalaryThresh(Number(cycle.salary_threshold_percentage) || 85)
    setEditOpensDay(Number(cycle.salary_request_opens_day) || 26)
    setEditStatus((cycle.status as any) || "ACTIVE")
  }

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingCycle) return

    if (!editName.trim()) {
      toast.error("Cycle name is required.")
      return
    }
    if (!editStartsOn || !editEndsOn) {
      toast.error("Start and End dates are required.")
      return
    }
    if (new Date(editEndsOn) < new Date(editStartsOn)) {
      toast.error("End date cannot be earlier than start date.")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/admin/work-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingCycle.id,
          name: editName.trim(),
          starts_on: editStartsOn,
          ends_on: editEndsOn,
          scheduled_weight_percentage: Number(editSchedWeight),
          salary_threshold_percentage: Number(editSalaryThresh),
          salary_request_opens_day: Number(editOpensDay),
          status: editStatus,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to update work cycle.")
      }

      toast.success(json.message || "Work cycle updated successfully.")
      const updated: WorkCycleItem = json.cycle

      setCycles((prev) =>
        prev.map((c) => {
          if (c.id === updated.id) return updated
          if (editStatus === "ACTIVE" && c.status === "ACTIVE") {
            return { ...c, status: "CLOSED" }
          }
          return c
        })
      )

      setEditingCycle(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to update cycle.")
    } finally {
      setLoading(false)
    }
  }

  // Quick Action: Set Active
  const handleSetActive = async (cycle: WorkCycleItem) => {
    try {
      setActionLoadingId(cycle.id)
      const res = await fetch("/api/admin/work-cycles", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cycle.id,
          status: "ACTIVE",
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to set active cycle.")
      }

      toast.success(`Cycle "${cycle.name}" is now the active cycle.`)
      setCycles((prev) =>
        prev.map((c) => (c.id === cycle.id ? { ...c, status: "ACTIVE" } : { ...c, status: "CLOSED" }))
      )
    } catch (err: any) {
      toast.error(err.message || "Failed to set active cycle.")
    } finally {
      setActionLoadingId(null)
    }
  }

  // Quick Action: Delete
  const handleDelete = async (cycle: WorkCycleItem) => {
    if (!confirm(`Are you sure you want to delete the work cycle "${cycle.name}"?`)) {
      return
    }

    try {
      setActionLoadingId(cycle.id)
      const res = await fetch(`/api/admin/work-cycles?id=${cycle.id}`, {
        method: "DELETE",
      })

      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete cycle.")
      }

      toast.success("Work cycle deleted.")
      setCycles((prev) => prev.filter((c) => c.id !== cycle.id))
    } catch (err: any) {
      toast.error(err.message || "Failed to delete cycle.")
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Work Cycles
            </h1>
            <Badge variant="outline" className="text-xs font-mono">
              System Admin
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure institutional monthly accounting periods, target formulas (75/25 model), and salary settlement thresholds.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleOpenCreate} className="gap-1.5 text-xs shadow-sm">
            <Plus className="h-4 w-4" />
            <span>New Work Cycle</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Cycle Card */}
        <Card className="border-l-4 border-l-emerald-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Current Active Cycle</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeCycle ? (
              <>
                <div className="text-base font-bold text-foreground truncate">{activeCycle.name}</div>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {activeCycle.starts_on} → {activeCycle.ends_on}
                </p>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-amber-500 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" />
                  <span>No Active Cycle</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Create or activate a cycle below.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Scheduled Weight */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Scheduled Weight</span>
              <CalendarDays className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {activeCycle ? Number(activeCycle.scheduled_weight_percentage).toFixed(0) : "75"}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Structured timetable lectures denominator weight
            </p>
          </CardContent>
        </Card>

        {/* Unstructured Weight */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Unscheduled Weight</span>
              <Layers className="h-4 w-4 text-sky-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {activeCycle
                ? (100 - Number(activeCycle.scheduled_weight_percentage)).toFixed(0)
                : "25"}
              %
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ad-hoc institutional citizenship initiatives
            </p>
          </CardContent>
        </Card>

        {/* Salary Authorization Gate */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
              <span>Salary Release Gate</span>
              <ShieldCheck className="h-4 w-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {activeCycle ? Number(activeCycle.salary_threshold_percentage).toFixed(0) : "85"}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Target progress required (opens Day{" "}
              {activeCycle ? activeCycle.salary_request_opens_day : 26})
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs & Table Container */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span>Configured Work Cycles ({cycles.length})</span>
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Manage cycle active states, dates, and accounting rules dynamically.
            </CardDescription>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-md text-xs font-medium self-start sm:self-auto">
            {(["ALL", "ACTIVE", "DRAFT", "CLOSED"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded transition-colors ${
                  filter === tab
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab === "ALL" ? "All" : tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredCycles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs space-y-3">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No work cycles found</p>
              <p className="text-muted-foreground">
                {filter !== "ALL"
                  ? `No cycles matching status "${filter}".`
                  : "Click 'New Work Cycle' to define the first period."}
              </p>
              {filter === "ALL" && (
                <Button size="sm" onClick={handleOpenCreate} className="text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create Work Cycle
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                    <th className="py-3 px-4 font-semibold">Cycle Name</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Timeline</th>
                    <th className="py-3 px-4 font-semibold">Formula Ratio</th>
                    <th className="py-3 px-4 font-semibold">Salary Gate</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCycles.map((c) => {
                    const isActive = c.status === "ACTIVE"
                    const isDraft = c.status === "DRAFT"
                    const isActionLoading = actionLoadingId === c.id

                    return (
                      <tr
                        key={c.id}
                        className={`hover:bg-muted/30 transition-colors ${
                          isActive ? "bg-emerald-500/[0.02]" : ""
                        }`}
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground flex items-center gap-1.5">
                            <span>{c.name}</span>
                            {isActive && (
                              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            ID: {c.id.slice(0, 8)}...
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : isDraft ? (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
                              Draft
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Closed
                            </Badge>
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {c.starts_on} → {c.ends_on}
                        </td>

                        <td className="py-3 px-4 font-mono">
                          <span className="font-semibold text-foreground">
                            {Number(c.scheduled_weight_percentage).toFixed(0)}%
                          </span>{" "}
                          <span className="text-muted-foreground">Sched /</span>{" "}
                          <span className="text-muted-foreground">
                            {(100 - Number(c.scheduled_weight_percentage)).toFixed(0)}% Ad-hoc
                          </span>
                        </td>

                        <td className="py-3 px-4 font-mono">
                          <span className="font-bold text-foreground">
                            {Number(c.salary_threshold_percentage).toFixed(0)}%
                          </span>{" "}
                          <span className="text-muted-foreground text-[11px]">
                            (Day {c.salary_request_opens_day})
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isActive && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1"
                                disabled={isActionLoading}
                                onClick={() => handleSetActive(c)}
                              >
                                {isActionLoading ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 text-emerald-600" />
                                )}
                                <span>Set Active</span>
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEdit(c)}
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs px-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                              disabled={isActionLoading}
                              onClick={() => handleDelete(c)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Create Work Cycle */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleCreateSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Create New Work Cycle
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Define the operational timeframe and target formula weights for this cycle.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="create-name" className="text-xs">
                  Cycle Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-name"
                  placeholder="e.g. October 2026 Accounting Cycle"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-starts" className="text-xs">
                    Start Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-starts"
                    type="date"
                    value={createStartsOn}
                    onChange={(e) => setCreateStartsOn(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-ends" className="text-xs">
                    End Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="create-ends"
                    type="date"
                    value={createEndsOn}
                    onChange={(e) => setCreateEndsOn(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="create-sched-weight" className="text-xs">
                    Sched Weight %
                  </Label>
                  <Input
                    id="create-sched-weight"
                    type="number"
                    min="1"
                    max="99"
                    value={createSchedWeight}
                    onChange={(e) => setCreateSchedWeight(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-threshold" className="text-xs">
                    Salary Gate %
                  </Label>
                  <Input
                    id="create-threshold"
                    type="number"
                    min="0"
                    max="100"
                    value={createSalaryThresh}
                    onChange={(e) => setCreateSalaryThresh(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="create-open-day" className="text-xs">
                    Opens on Day
                  </Label>
                  <Input
                    id="create-open-day"
                    type="number"
                    min="1"
                    max="31"
                    value={createOpensDay}
                    onChange={(e) => setCreateOpensDay(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="create-status" className="text-xs">
                  Initial Status
                </Label>
                <select
                  id="create-status"
                  value={createStatus}
                  onChange={(e) => setCreateStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ACTIVE" className="bg-background text-foreground">
                    Active (Will automatically close other active cycles)
                  </option>
                  <option value="DRAFT" className="bg-background text-foreground">
                    Draft (Preparation mode)
                  </option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Create Cycle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Work Cycle */}
      <Dialog open={Boolean(editingCycle)} onOpenChange={(open) => !open && setEditingCycle(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground">
                Edit Work Cycle
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Adjust the dates, formula weights, or status for this cycle.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4 text-xs">
              <div className="space-y-1.5">
                <Label htmlFor="edit-name" className="text-xs">
                  Cycle Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-starts" className="text-xs">
                    Start Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-starts"
                    type="date"
                    value={editStartsOn}
                    onChange={(e) => setEditStartsOn(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-ends" className="text-xs">
                    End Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="edit-ends"
                    type="date"
                    value={editEndsOn}
                    onChange={(e) => setEditEndsOn(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="edit-sched-weight" className="text-xs">
                    Sched Weight %
                  </Label>
                  <Input
                    id="edit-sched-weight"
                    type="number"
                    min="1"
                    max="99"
                    value={editSchedWeight}
                    onChange={(e) => setEditSchedWeight(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-threshold" className="text-xs">
                    Salary Gate %
                  </Label>
                  <Input
                    id="edit-threshold"
                    type="number"
                    min="0"
                    max="100"
                    value={editSalaryThresh}
                    onChange={(e) => setEditSalaryThresh(Number(e.target.value))}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-open-day" className="text-xs">
                    Opens on Day
                  </Label>
                  <Input
                    id="edit-open-day"
                    type="number"
                    min="1"
                    max="31"
                    value={editOpensDay}
                    onChange={(e) => setEditOpensDay(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-status" className="text-xs">
                  Status
                </Label>
                <select
                  id="edit-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="ACTIVE" className="bg-background text-foreground">
                    Active (Primary active cycle)
                  </option>
                  <option value="DRAFT" className="bg-background text-foreground">
                    Draft (Preparation)
                  </option>
                  <option value="CLOSED" className="bg-background text-foreground">
                    Closed (Archived)
                  </option>
                </select>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditingCycle(null)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
