"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Sparkles,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Building2,
  Search,
  ArrowRight,
  Loader2,
  Check,
  AlertCircle,
  FileCheck,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface MarketplaceTask {
  id: string
  title: string
  description: string | null
  credit_value: number
  category: string
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  status: string
  visibility_scope?: string
  deadline: string | null
  created_at: string
  creator_name?: string
  org_unit_name?: string
  org_unit_id?: string
  applied_by_user?: boolean
}

interface MarketplaceDiscoveryGridProps {
  orgId: string
  userId: string
  tasks: MarketplaceTask[]
  isProgressConfigured: boolean
}

export function MarketplaceDiscoveryGrid({
  orgId,
  userId,
  tasks: initialTasks,
  isProgressConfigured,
}: MarketplaceDiscoveryGridProps) {
  const router = useRouter()

  const [tasks, setTasks] = useState<MarketplaceTask[]>(initialTasks)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL")
  const [selectedScope, setSelectedScope] = useState<string>("ALL")

  // Nomination Dialog State
  const [activeTask, setActiveTask] = useState<MarketplaceTask | null>(null)
  const [pitchNote, setPitchNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nominationStatus, setNominationStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchTitle = task.title.toLowerCase().includes(query)
        const matchDesc = task.description?.toLowerCase().includes(query) || false
        const matchDept = task.org_unit_name?.toLowerCase().includes(query) || false
        if (!matchTitle && !matchDesc && !matchDept) return false
      }

      // 2. Priority Filter
      if (selectedPriority !== "ALL") {
        if ((task.priority || "MEDIUM").toUpperCase() !== selectedPriority) return false
      }

      // 3. Scope Filter
      if (selectedScope !== "ALL") {
        if (task.visibility_scope !== selectedScope) return false
      }

      return true
    })
  }, [tasks, searchQuery, selectedPriority, selectedScope])

  const handleOpenNomination = (task: MarketplaceTask) => {
    setActiveTask(task)
    setPitchNote("")
    setNominationStatus(null)
  }

  const handleNominateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeTask) return

    setIsSubmitting(true)
    setNominationStatus(null)

    try {
      const response = await fetch("/api/tasks/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: activeTask.id,
          pitchNote,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to submit self-nomination")
      }

      // Mark locally as applied
      setTasks((prev) =>
        prev.map((t) => (t.id === activeTask.id ? { ...t, applied_by_user: true } : t))
      )

      setNominationStatus({
        type: "success",
        message: data.message || "Self-nomination submitted successfully!",
      })

      setTimeout(() => {
        setActiveTask(null)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setNominationStatus({
        type: "error",
        message: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderPriorityBadge = (p?: string) => {
    const val = (p || "MEDIUM").toUpperCase()
    if (val === "URGENT") {
      return <Badge variant="destructive" className="text-[10px]">Urgent</Badge>
    }
    if (val === "HIGH") {
      return <Badge variant="secondary" className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">High</Badge>
    }
    return <Badge variant="outline" className="text-[10px]">Standard</Badge>
  }

  return (
    <div className="space-y-6">
      {/* Neutral Informational Hint */}
      {isProgressConfigured && (
        <div className="p-3.5 rounded-lg border bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>Approved initiatives contribute to this month’s unstructured work credits (25% target weight).</span>
        </div>
      )}

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search initiatives by title, description, or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            {/* Priority Select */}
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="h-9 px-3 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>

            {/* Scope Select */}
            <select
              value={selectedScope}
              onChange={(e) => setSelectedScope(e.target.value)}
              className="h-9 px-3 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="ALL">All Scopes</option>
              <option value="ORG_UNIT">Department Only</option>
              <option value="ORGANIZATION">Organization Wide</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-xs text-muted-foreground space-y-2">
            <Layers className="h-8 w-8 mx-auto text-muted-foreground/40" />
            <p className="font-semibold text-foreground">No open initiatives are available for your department.</p>
            <p className="text-muted-foreground">
              New tasks posted by your HOD or Director will appear here when available.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTasks.map((task) => {
            const isApplied = task.applied_by_user

            return (
              <Card key={task.id} className="flex flex-col justify-between hover:border-primary/40 transition-colors">
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {renderPriorityBadge(task.priority)}
                      <Badge variant="outline" className="text-[10px]">
                        {task.visibility_scope === "ORGANIZATION" ? "Org-Wide" : "Department"}
                      </Badge>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs font-bold shrink-0">
                      +{task.credit_value.toFixed(1)} cr
                    </Badge>
                  </div>

                  <div>
                    <CardTitle className="text-sm font-bold text-foreground line-clamp-1">{task.title}</CardTitle>
                    {task.org_unit_name && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{task.org_unit_name}</p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pb-4 space-y-3 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-muted-foreground line-clamp-3">
                    {task.description || "No specific instructions provided for this initiative."}
                  </p>

                  <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>{task.deadline ? `Due ${task.deadline}` : "Open deadline"}</span>
                    </div>
                    <span>{task.creator_name || "Lead"}</span>
                  </div>
                </CardContent>

                <div className="p-3 border-t bg-muted/20">
                  {isApplied ? (
                    <Button disabled variant="outline" size="sm" className="w-full text-xs gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Nomination Submitted</span>
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleOpenNomination(task)}
                      className="w-full text-xs gap-1.5"
                    >
                      <span>Self-Nominate</span>
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Nomination Dialog */}
      <Dialog open={Boolean(activeTask)} onOpenChange={(open) => !open && setActiveTask(null)}>
        <DialogContent className="sm:max-w-md">
          {activeTask && (
            <form onSubmit={handleNominateSubmit}>
              <DialogHeader>
                <DialogTitle className="text-base font-bold text-foreground">
                  Nominate for Initiative
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Submit your expression of interest to your department lead for this initiative.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4 text-xs">
                {nominationStatus && (
                  <div
                    className={`p-3 rounded-lg border flex items-center gap-2 ${
                      nominationStatus.type === "success"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600"
                        : "bg-destructive/10 border-destructive/30 text-destructive"
                    }`}
                  >
                    {nominationStatus.type === "success" ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0" />
                    )}
                    <span>{nominationStatus.message}</span>
                  </div>
                )}

                <div className="p-3 rounded-lg bg-muted/40 border space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-foreground text-sm">{activeTask.title}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      +{activeTask.credit_value.toFixed(1)} cr
                    </Badge>
                  </div>
                  {activeTask.description && (
                    <p className="text-muted-foreground text-xs line-clamp-2">{activeTask.description}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground">Pitch / Availability Note (Optional)</Label>
                  <Textarea
                    placeholder="Briefly state your experience, capacity, or plan for this task..."
                    value={pitchNote}
                    onChange={(e) => setPitchNote(e.target.value)}
                    className="text-xs min-h-[80px]"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveTask(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Confirm Nomination</span>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
