"use client"

import { useState } from "react"
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
  CalendarDays,
  Clock,
  Plus,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Layers,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface TrustedScheduleManagerProps {
  orgId: string
  facultyMembers: Array<{ id: string; name: string; email: string; designation?: string; employee_id?: string }>
  workCycles: Array<{ id: string; name: string; status: string }>
  initialTemplates: any[]
}

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
const DAY_LABELS: Record<string, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
}

export function TrustedScheduleManager({
  orgId,
  facultyMembers,
  workCycles,
  initialTemplates,
}: TrustedScheduleManagerProps) {
  const router = useRouter()

  const [selectedCycleId, setSelectedCycleId] = useState<string>(
    workCycles.find((c) => c.status === "ACTIVE")?.id || workCycles[0]?.id || ""
  )
  const [selectedFacultyId, setSelectedFacultyId] = useState<string>("ALL")
  const [templates, setTemplates] = useState<any[]>(initialTemplates)

  // Manual Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [addFacultyId, setAddFacultyId] = useState(facultyMembers[0]?.id || "")
  const [addTitle, setAddTitle] = useState("")
  const [addDay, setAddDay] = useState("MON")
  const [addStartTime, setAddStartTime] = useState("09:15")
  const [addEndTime, setAddEndTime] = useState("10:15")
  const [addCredits, setAddCredits] = useState("1.0")
  const [addDesc, setAddDesc] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Generate Instances State
  const [isGenerating, setIsGenerating] = useState(false)
  const [genMessage, setGenMessage] = useState<string | null>(null)

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    if (selectedCycleId && t.work_cycle_id !== selectedCycleId) return false
    if (selectedFacultyId !== "ALL" && t.assigned_to_id !== selectedFacultyId) return false
    return true
  })

  // Handle Save Manual Template
  const handleSaveManualTemplate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addTitle || !addFacultyId || !selectedCycleId) {
      setSaveError("Please fill in all required fields.")
      return
    }

    if (addStartTime >= addEndTime) {
      setSaveError("Start time must be earlier than end time.")
      return
    }

    // Pre-check for time slot conflicts
    const conflictingTemplate = templates.find((t) => {
      if (t.status === "ARCHIVED") return false
      if (t.work_cycle_id !== selectedCycleId) return false
      if (t.assigned_to_id !== addFacultyId) return false
      if (t.weekly_day !== addDay) return false

      const tStart = (t.start_time || "").slice(0, 5)
      const tEnd = (t.end_time || "").slice(0, 5)
      return tStart < addEndTime && addStartTime < tEnd
    })

    if (conflictingTemplate) {
      setSaveError(
        `This faculty member already has an assigned task ("${conflictingTemplate.title || "Scheduled Work"}") at ${conflictingTemplate.start_time.slice(0, 5)}-${conflictingTemplate.end_time.slice(0, 5)} on ${addDay}. Multiple assignments for the same faculty at overlapping time slots are prohibited.`
      )
      return
    }

    setIsSaving(true)
    setSaveError(null)

    try {
      const res = await fetch("/api/dept-admin/import-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workCycleId: selectedCycleId,
          dryRun: false,
          rows: [
            {
              faculty_id: addFacultyId,
              day: addDay,
              start_time: addStartTime,
              end_time: addEndTime,
              task_name: addTitle,
              credits: parseFloat(addCredits) || 1.0,
              description: addDesc || null,
            },
          ],
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to create work template.")

      setIsAddModalOpen(false)
      setAddTitle("")
      setAddDesc("")
      router.refresh()
    } catch (err: any) {
      setSaveError(err.message || "Failed to save template.")
    } finally {
      setIsSaving(false)
    }
  }

  // Handle Generate Month Instances
  const handleGenerateInstances = async () => {
    if (!selectedCycleId) return
    setIsGenerating(true)
    setGenMessage(null)

    try {
      const res = await fetch("/api/dept-admin/import-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workCycleId: selectedCycleId,
          dryRun: false,
          rows: [],
          autoGenerateMonth: true,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate instances.")

      setGenMessage(`Active work instances synchronized successfully for this month (${data.instancesCreated || 0} instances created/verified).`)
      setTimeout(() => setGenMessage(null), 4000)
      router.refresh()
    } catch (err: any) {
      setGenMessage(`Generation error: ${err.message}`)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Filter & Action Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Work Cycle Selector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground block">Work Cycle</label>
              <select
                value={selectedCycleId}
                onChange={(e) => setSelectedCycleId(e.target.value)}
                className="h-8 px-3 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {workCycles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.status === "ACTIVE" ? "(Active)" : `(${c.status})`}
                  </option>
                ))}
              </select>
            </div>

            {/* Faculty Selector */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground block">Faculty Member</label>
              <select
                value={selectedFacultyId}
                onChange={(e) => setSelectedFacultyId(e.target.value)}
                className="h-8 px-3 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="ALL">All Faculty Members ({facultyMembers.length})</option>
                {facultyMembers.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={() => setIsAddModalOpen(true)}
              className="text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Manual Slot</span>
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateInstances}
              disabled={isGenerating}
              className="text-xs gap-1.5"
            >
              {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span>Sync Month Instances</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {genMessage && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{genMessage}</span>
        </div>
      )}

      {/* Templates Table */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Weekly Recurring Templates ({filteredTemplates.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Active schedule slots allocated to department faculty members.
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            75% Scheduled Target Weight
          </Badge>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
              <Layers className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="font-medium text-foreground">No scheduled templates found</p>
              <p className="text-muted-foreground">
                Add a manual session above or upload an XLSX timetable via the Import Center.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                    <th className="py-3 px-4 font-semibold">Faculty Member</th>
                    <th className="py-3 px-4 font-semibold">Weekday</th>
                    <th className="py-3 px-4 font-semibold">Time Slot</th>
                    <th className="py-3 px-4 font-semibold">Session Title</th>
                    <th className="py-3 px-4 font-semibold">Credit Value</th>
                    <th className="py-3 px-4 font-semibold">Description</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTemplates.map((t) => (
                    <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground">{t.users?.name || "Unassigned"}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{t.users?.email}</div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {t.weekly_day} ({DAY_LABELS[t.weekly_day] || t.weekly_day})
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {t.start_time?.slice(0, 5)} – {t.end_time?.slice(0, 5)}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{t.title}</td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        +{Number(t.credit_value).toFixed(1)} cr
                      </td>
                      <td className="py-3 px-4 text-muted-foreground truncate max-w-[200px]">
                        {t.description || "—"}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-500/10">
                          Active
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Add Dialog */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <form onSubmit={handleSaveManualTemplate}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Plus className="h-4 w-4 text-primary" />
                Add Recurring Weekly Session
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Creates a weekly recurring template for the selected faculty member and work cycle.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {saveError && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Faculty Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Assign Faculty Member *</Label>
                <select
                  value={addFacultyId}
                  onChange={(e) => setAddFacultyId(e.target.value)}
                  required
                  className="w-full h-9 px-3 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {facultyMembers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.email})
                    </option>
                  ))}
                </select>
              </div>

              {/* Session Title */}
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Session Title / Activity *</Label>
                <Input
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="e.g. CS301 - Data Structures Lecture (Room 402)"
                  required
                  className="h-9 text-xs"
                />
              </div>

              {/* Weekday & Credits */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground">Weekday *</Label>
                  <select
                    value={addDay}
                    onChange={(e) => setAddDay(e.target.value)}
                    className="w-full h-9 px-3 rounded-md bg-background border text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {DAY_LABELS[d]} ({d})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground">Credit Value *</Label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="10"
                    value={addCredits}
                    onChange={(e) => setAddCredits(e.target.value)}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Time Slots */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground">Start Time (24h) *</Label>
                  <Input
                    type="time"
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-foreground">End Time (24h) *</Label>
                  <Input
                    type="time"
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    required
                    className="h-9 text-xs font-mono"
                  />
                </div>
              </div>

              {/* Optional Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-foreground">Description / Notes (Optional)</Label>
                <Textarea
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  placeholder="Optional room number, batch notes, or course objectives..."
                  className="text-xs min-h-[60px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                size="sm"
                className="text-xs"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving} size="sm" className="text-xs gap-1.5">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                <span>Save Template</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
