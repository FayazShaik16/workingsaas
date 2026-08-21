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
      const now = new Date()
      const res = await fetch("/api/dept-admin/import-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workCycleId: selectedCycleId,
          dryRun: false,
          rows: [], // will trigger generation
          autoGenerateMonth: true,
        }),
      })

      setGenMessage(`Active work instances successfully synchronized for this month.`)
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-3">
          {/* Work Cycle Selector */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 block mb-1">Work Cycle</label>
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
            >
              {workCycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.status === "ACTIVE" ? "(Active)" : `(${c.status})`}
                </option>
              ))}
            </select>
          </div>

          {/* Faculty Selector */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 block mb-1">Faculty Member</label>
            <select
              value={selectedFacultyId}
              onChange={(e) => setSelectedFacultyId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
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
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-xl shadow-md shadow-violet-600/20 gap-1.5"
          >
            <Plus size={14} />
            <span>Add Manual Slot</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateInstances}
            disabled={isGenerating}
            className="border-white/10 text-slate-200 hover:bg-white/10 text-xs rounded-xl gap-1.5"
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            <span>Sync Month Instances</span>
          </Button>
        </div>
      </div>

      {genMessage && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{genMessage}</span>
        </div>
      )}

      {/* Templates Table */}
      <Card className="rounded-2xl border-white/[0.08] bg-slate-900/40 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <CalendarDays size={16} className="text-violet-400" />
                Weekly Recurring Templates
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-0.5">
                {filteredTemplates.length} recurring weekly slot{filteredTemplates.length === 1 ? "" : "s"} defined.
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-mono text-[10px] bg-white/[0.04] text-slate-300 border-white/10">
              Trust-Based Timetable Model
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredTemplates.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <Layers size={28} className="mx-auto text-slate-600 opacity-60" />
              <p className="font-medium text-slate-300">No scheduled templates found</p>
              <p className="text-slate-500">
                Add a manual session above or upload an XLSX timetable via the Import Center.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.02] text-slate-400 font-mono">
                    <th className="py-3 px-4">Weekday</th>
                    <th className="py-3 px-4">Time Slot</th>
                    <th className="py-3 px-4">Session / Task Name</th>
                    <th className="py-3 px-4">Assigned Faculty</th>
                    <th className="py-3 px-4">Credits</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {filteredTemplates.map((t) => (
                    <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-bold text-violet-300 font-mono">
                        {t.weekly_day} ({DAY_LABELS[t.weekly_day] || t.weekly_day})
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {t.start_time?.slice(0, 5)} – {t.end_time?.slice(0, 5)}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        {t.title}
                        {t.description && (
                          <span className="block text-[11px] text-slate-500 font-normal">{t.description}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-300">
                        {t.users?.name || "Faculty Member"}
                        <span className="block text-[10px] text-slate-500 font-mono">{t.users?.email}</span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-300">
                        +{Number(t.credit_value).toFixed(1)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        >
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

      {/* Manual Add Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl border-white/10 bg-slate-950 text-slate-100 shadow-2xl">
          <form onSubmit={handleSaveManualTemplate}>
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-white">Add Scheduled Work Template</DialogTitle>
              <DialogDescription className="text-slate-400 text-xs">
                Create a recurring weekly session for a faculty member. No course/subject relational entity required.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {saveError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle size={14} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              {/* Faculty Selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Assigned Faculty Member *</Label>
                <select
                  value={addFacultyId}
                  onChange={(e) => setAddFacultyId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white focus:outline-none focus:border-violet-500"
                >
                  {facultyMembers.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} — {f.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Title / Session Name */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Session / Task Name *</Label>
                <Input
                  value={addTitle}
                  onChange={(e) => setAddTitle(e.target.value)}
                  placeholder="e.g. V SE SEC-A, VII SE CSD, Lab Mentorship"
                  className="bg-slate-900 border-white/10 text-xs text-white"
                  required
                />
              </div>

              {/* Weekday & Times Grid */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Weekday *</Label>
                  <select
                    value={addDay}
                    onChange={(e) => setAddDay(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white"
                  >
                    {WEEKDAYS.map((d) => (
                      <option key={d} value={d}>
                        {d} ({DAY_LABELS[d]})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">Start Time *</Label>
                  <Input
                    type="time"
                    value={addStartTime}
                    onChange={(e) => setAddStartTime(e.target.value)}
                    className="bg-slate-900 border-white/10 text-xs text-white"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-slate-300">End Time *</Label>
                  <Input
                    type="time"
                    value={addEndTime}
                    onChange={(e) => setAddEndTime(e.target.value)}
                    className="bg-slate-900 border-white/10 text-xs text-white"
                    required
                  />
                </div>
              </div>

              {/* Credits */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Credits per Session *</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  value={addCredits}
                  onChange={(e) => setAddCredits(e.target.value)}
                  className="bg-slate-900 border-white/10 text-xs text-white font-mono"
                  required
                />
              </div>

              {/* Optional Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-300">Description / Room / Location (Optional)</Label>
                <Textarea
                  value={addDesc}
                  onChange={(e) => setAddDesc(e.target.value)}
                  placeholder="e.g. Room LH-101, Computer Lab 2"
                  rows={2}
                  className="bg-slate-900 border-white/10 text-xs text-white resize-none"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSaving}
                className="border-white/10 text-slate-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium"
              >
                {isSaving ? (
                  <>
                    <Loader2 size={14} className="animate-spin mr-1.5" />
                    Saving...
                  </>
                ) : (
                  "Create Template"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
