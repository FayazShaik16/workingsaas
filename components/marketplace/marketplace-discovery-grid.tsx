"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
  Coins,
  Calendar,
  Layers,
  CheckCircle2,
  Clock,
  Building2,
  Search,
  Filter,
  Flame,
  Target,
  ShieldAlert,
  ArrowRight,
  Loader2,
  Tag,
  BookOpen,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface MarketplaceTask {
  id: string
  title: string
  description: string | null
  credit_value: number
  token_value?: number
  category: string
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
  userProgress: number
  userEarnedCredits: number
  userTargetCredits: number
  tasks: MarketplaceTask[]
}

export function MarketplaceDiscoveryGrid({
  orgId,
  userId,
  userProgress,
  userEarnedCredits,
  userTargetCredits,
  tasks: initialTasks,
}: MarketplaceDiscoveryGridProps) {
  const router = useRouter()

  const [tasks, setTasks] = useState<MarketplaceTask[]>(initialTasks)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDept, setSelectedDept] = useState<string>("ALL")
  const [selectedTag, setSelectedTag] = useState<string>("ALL")
  const [minReward, setMinReward] = useState<number>(0)
  const [fairnessOnly, setFairnessOnly] = useState<boolean>(false)

  // Drawer / Modal State
  const [activeTask, setActiveTask] = useState<MarketplaceTask | null>(null)
  const [pitchNote, setPitchNote] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [nominationStatus, setNominationStatus] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Calculate Shortfall
  const isBelowTarget = userProgress < 85
  const requiredCredits = userTargetCredits * 0.85
  const creditShortfall = Math.max(0, requiredCredits - userEarnedCredits)

  // Extract unique departments and tags
  const departments = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => {
      if (t.org_unit_name) set.add(t.org_unit_name)
    })
    return Array.from(set)
  }, [tasks])

  // Filter Tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchTitle = task.title.toLowerCase().includes(q)
        const matchDesc = task.description?.toLowerCase().includes(q)
        const matchDept = task.org_unit_name?.toLowerCase().includes(q)
        if (!matchTitle && !matchDesc && !matchDept) return false
      }

      // 2. Department
      if (selectedDept !== "ALL" && task.org_unit_name !== selectedDept) {
        return false
      }

      // 3. Minimum Reward
      const taskCredits = task.credit_value ?? task.token_value ?? 1.0
      if (minReward > 0 && taskCredits < minReward) {
        return false
      }

      // 4. Fairness Filter (highlight/filter tasks that can bridge the shortfall)
      if (fairnessOnly && isBelowTarget) {
        if (taskCredits < Math.min(2.0, creditShortfall)) {
          return false
        }
      }

      return true
    })
  }, [tasks, searchQuery, selectedDept, minReward, fairnessOnly, isBelowTarget, creditShortfall])

  const handleOpenNominationDrawer = (task: MarketplaceTask) => {
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
      }, 1500)
    } catch (err: any) {
      setNominationStatus({
        type: "error",
        message: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatDeadlineCountdown = (deadlineStr: string | null) => {
    if (!deadlineStr) return "Open Deadline"
    const diff = new Date(deadlineStr).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return "Overdue"
    if (days === 0) return "Due Today"
    if (days === 1) return "Due Tomorrow"
    return `In ${days} days`
  }

  return (
    <div className="space-y-6">
      {/* Fairness Priority Banner for Faculty < 85% */}
      {isBelowTarget && (
        <div className="p-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-foreground">
                  Fairness Filter: Autonomy Deficit Recovery
                </span>
                <Badge className="bg-amber-500 text-white font-mono text-[10px]">
                  {userProgress.toFixed(0)}% Progress
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
                You are currently <span className="font-bold text-foreground">{creditShortfall.toFixed(1)} credits</span> short of the 85% threshold needed to initiate salary release. Self-nominating for 1 or 2 unstructured tasks below will safely bridge your gap before the payroll snapshot.
              </p>
            </div>
          </div>

          <Button
            size="sm"
            variant={fairnessOnly ? "default" : "outline"}
            onClick={() => setFairnessOnly(!fairnessOnly)}
            className={`rounded-xl text-xs font-semibold shrink-0 ${
              fairnessOnly ? "bg-amber-600 hover:bg-amber-700 text-white" : "border-amber-500/40 text-amber-600"
            }`}
          >
            {fairnessOnly ? "✓ Showing Deficit-Bridging Tasks" : "🎯 Show Deficit-Bridging Tasks"}
          </Button>
        </div>
      )}

      {/* Filter Bar */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardContent className="p-4 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by keyword, accreditation criteria, committee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 text-xs rounded-xl h-9"
            />
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Select value={selectedDept} onValueChange={setSelectedDept}>
              <SelectTrigger className="rounded-xl text-xs h-9 min-w-36">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Minimum Reward Filter */}
            <Select
              value={String(minReward)}
              onValueChange={(val) => setMinReward(Number(val))}
            >
              <SelectTrigger className="rounded-xl text-xs h-9 min-w-32 font-mono">
                <SelectValue placeholder="Min Tokens" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Any Reward</SelectItem>
                <SelectItem value="2">≥ 2.0 Tokens</SelectItem>
                <SelectItem value="5">≥ 5.0 Tokens</SelectItem>
                <SelectItem value="8">≥ 8.0 Tokens</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredTasks.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted-foreground text-sm font-light space-y-2">
            <Sparkles className="h-8 w-8 mx-auto opacity-30" />
            <p className="font-bold text-foreground">No Tasks Found</p>
            <p className="text-xs">Try loosening your search query or department filters.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const taskCredits = task.credit_value ?? task.token_value ?? 1.0
            const isHighYield = taskCredits >= 5.0
            const bridgesDeficit = isBelowTarget && taskCredits >= creditShortfall
            const countdownText = formatDeadlineCountdown(task.deadline)
            const isOrgWide = task.visibility_scope === "ORGANIZATION" || task.org_unit_name === "Institution-Wide"

            return (
              <Card
                key={task.id}
                className={`rounded-2xl border transition-all flex flex-col justify-between hover:shadow-md ${
                  bridgesDeficit
                    ? "border-amber-500/50 bg-amber-500/5"
                    : isOrgWide
                    ? "border-primary/40 bg-primary/5"
                    : "border-muted/70 bg-background/60"
                }`}
              >
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <Badge
                      variant={isOrgWide ? "default" : "outline"}
                      className="text-[10px] font-medium rounded-md truncate max-w-44"
                    >
                      <Building2 className="h-3 w-3 mr-1 text-primary/70" />
                      {task.org_unit_name || "Institutional Pool"}
                    </Badge>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg">
                        +{taskCredits.toFixed(1)} WORK
                      </span>
                    </div>
                  </div>

                  <CardTitle className="text-base font-bold line-clamp-2 text-foreground">
                    {task.title}
                  </CardTitle>

                  {/* Deficit Callout */}
                  {bridgesDeficit && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      <Flame className="h-3.5 w-3.5" /> Closes your remaining {creditShortfall.toFixed(1)} token deficit!
                    </div>
                  )}
                </CardHeader>

                <CardContent className="pt-0 space-y-4">
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>
                  )}

                  {/* Metadata row */}
                  <div className="pt-2 border-t border-muted/50 flex items-center justify-between text-[11px] text-muted-foreground font-mono">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{countdownText}</span>
                    </div>
                    <span>By {task.creator_name || "Lead"}</span>
                  </div>

                  {/* Action Button */}
                  <div>
                    {task.applied_by_user ? (
                      <Button
                        size="sm"
                        disabled
                        variant="secondary"
                        className="w-full rounded-xl text-xs font-medium text-muted-foreground"
                      >
                        <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> Nomination Submitted
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleOpenNominationDrawer(task)}
                        className={`w-full rounded-xl text-xs font-semibold shadow-xs ${
                          bridgesDeficit
                            ? "bg-amber-600 hover:bg-amber-700 text-white"
                            : ""
                        }`}
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Nominate Myself (+{taskCredits.toFixed(1)})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Self-Nomination Drawer / Modal */}
      <Dialog open={!!activeTask} onOpenChange={(open) => !open && setActiveTask(null)}>
        <DialogContent className="max-w-lg rounded-2xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">Self-Nominate for Task</DialogTitle>
                <DialogDescription className="text-xs">
                  {activeTask?.org_unit_name || "Department"} · +{(activeTask?.credit_value ?? activeTask?.token_value ?? 1.0).toFixed(1)} WORK Tokens
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {activeTask && (
            <form onSubmit={handleNominateSubmit} className="space-y-4 pt-2">
              {nominationStatus && (
                <div
                  className={`p-3 text-xs rounded-xl border font-semibold ${
                    nominationStatus.type === "success"
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}
                >
                  {nominationStatus.message}
                </div>
              )}

              <div className="p-3.5 rounded-xl border border-muted/80 bg-muted/20 space-y-1.5">
                <span className="text-xs font-bold text-foreground block">{activeTask.title}</span>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed max-h-36 overflow-y-auto">
                  {activeTask.description}
                </p>
                <div className="flex items-center justify-between pt-2 border-t border-muted/60 text-[11px] font-mono text-muted-foreground">
                  <span>Deadline: {activeTask.deadline ? new Date(activeTask.deadline).toLocaleDateString() : "Flexible"}</span>
                  <span className="text-emerald-600 font-bold">Reward: +{(activeTask.credit_value ?? activeTask.token_value ?? 1.0).toFixed(1)} WORK</span>
                </div>
              </div>

              {/* Pitch Note */}
              <div className="space-y-1.5">
                <Label htmlFor="pitchNote" className="text-xs font-semibold">
                  Expression of Interest / Qualification Note (Optional)
                </Label>
                <Textarea
                  id="pitchNote"
                  placeholder="e.g. I have prior experience with NAAC Criterion 4 documentation and can complete this audit within 7 days."
                  value={pitchNote}
                  onChange={(e) => setPitchNote(e.target.value)}
                  rows={3}
                  disabled={isSubmitting}
                  className="rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveTask(null)}
                  disabled={isSubmitting}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="rounded-xl text-xs font-bold shadow-xs">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> Submit Nomination
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
