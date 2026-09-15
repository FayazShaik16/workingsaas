"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  HeartHandshake,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Coins,
  FileCheck,
  TrendingUp,
  Plus,
  Loader2,
  Calendar,
  ExternalLink,
  Info,
} from "lucide-react"
import { GeneralTaskTemplate, GeneralTaskLog } from "@/lib/workledger/general-tasks"
import { useRouter } from "next/navigation"

interface MemberGeneralTasksViewProps {
  orgId: string
  templates: GeneralTaskTemplate[]
  logs: GeneralTaskLog[]
  facultyName: string
}

export function MemberGeneralTasksView({
  orgId,
  templates: initialTemplates,
  logs: initialLogs,
  facultyName,
}: MemberGeneralTasksViewProps) {
  const router = useRouter()
  const [templates] = useState<GeneralTaskTemplate[]>(initialTemplates)
  const [logs, setLogs] = useState<GeneralTaskLog[]>(initialLogs)

  // Modal logging state
  const [loggingTemplate, setLoggingTemplate] = useState<GeneralTaskTemplate | null>(null)
  const [durationHours, setDurationHours] = useState<number>(1.5)
  const [sessionDate, setSessionDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState<string>("")
  const [proofUrl, setProofUrl] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  // Calculations
  const calculatedTokens = loggingTemplate
    ? Number((durationHours * loggingTemplate.hourlyRate).toFixed(2))
    : 0

  const totalHoursLogged = logs.reduce((acc, l) => acc + l.durationHours, 0)
  const totalTokensEarned = logs
    .filter((l) => l.status === "LEAD_SIGNED" || l.status === "CLOSED")
    .reduce((acc, l) => acc + l.credits, 0)
  const pendingLogs = logs.filter((l) => l.status === "VERIFICATION_PENDING" || l.status === "SUBMITTED")

  const handleOpenModal = (template: GeneralTaskTemplate) => {
    setLoggingTemplate(template)
    setDurationHours(1.0)
    setSessionDate(new Date().toISOString().slice(0, 10))
    setNotes("")
    setProofUrl("")
    setErrorMsg(null)
    setSuccessMsg(null)
  }

  const handleSubmitLog = async () => {
    if (!loggingTemplate) return
    if (!notes.trim()) {
      setErrorMsg("Please provide notes summarizing the students counselled or work accomplished.")
      return
    }
    if (durationHours <= 0) {
      setErrorMsg("Please specify a duration greater than 0 hours.")
      return
    }

    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/tasks/general/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateTaskId: loggingTemplate.id,
          durationHours,
          sessionDate,
          notes: notes.trim(),
          proofUrl: proofUrl.trim() || undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to log general task.")
      }

      setSuccessMsg(data.message)
      // Append new log optimistically
      const newLog: GeneralTaskLog = {
        id: data.log.id,
        parentTemplateId: loggingTemplate.id,
        templateTitle: loggingTemplate.title,
        generalCategory: loggingTemplate.generalCategory,
        facultyId: "",
        facultyName,
        facultyEmail: "",
        durationHours,
        hourlyRate: loggingTemplate.hourlyRate,
        credits: data.calculatedCredits,
        sessionDate,
        notes: notes.trim(),
        proofUrl: proofUrl.trim() || undefined,
        status: "VERIFICATION_PENDING",
        submittedAt: new Date().toISOString(),
      }
      setLogs((prev) => [newLog, ...prev])

      setTimeout(() => {
        setLoggingTemplate(null)
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to submit activity.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-card via-card/90 to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <HeartHandshake className="h-3.5 w-3.5" />
              <span>Voluntary & Extracurricular Productivity</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
              General Tasks & Productivity Ledger
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Log student academic counselling, mentoring, laboratory maintenance, and departmental activities.
              Rewards are dynamically proportional to the time you spend and are visible to Department Leadership and Higher Authorities for productivity accounting.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="px-4 py-3 rounded-2xl bg-background/80 border text-center min-w-[110px]">
              <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
                Time Logged
              </span>
              <span className="text-xl font-black text-foreground">
                {totalHoursLogged.toFixed(1)} <span className="text-xs font-medium text-muted-foreground">hrs</span>
              </span>
            </div>
            <div className="px-4 py-3 rounded-2xl bg-primary/10 border border-primary/25 text-center min-w-[110px]">
              <span className="text-[10px] text-primary uppercase font-bold tracking-wider block">
                Tokens Earned
              </span>
              <span className="text-xl font-black text-primary">
                +{totalTokensEarned.toFixed(2)} <span className="text-xs font-medium">WORK</span>
              </span>
            </div>
          </div>
        </div>

        {/* Psychological Motivation Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300/90 flex items-start gap-3">
          <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-200">How General Tasks Work:</span>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              These voluntary tasks are not required for your base scheduled classes, but completing them unlocks extra token compensation and showcases your institutional dedication in Department Head and Director evaluation reports.
            </p>
          </div>
        </div>
      </div>

      {/* 2. AVAILABLE GENERAL TASKS CATALOG */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Available General Tasks
            </h2>
            <p className="text-xs text-muted-foreground">
              Select an activity category below to log your session duration and claim proportional token rewards.
            </p>
          </div>
          <Badge variant="secondary" className="text-xs">
            {templates.length} Activities Open
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="rounded-2xl border-border/60 hover:border-primary/40 transition-all hover:shadow-md flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary border-primary/20">
                    {tpl.generalCategory}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                    <Coins className="h-3 w-3" />
                    <span>+{tpl.hourlyRate} WORK / hr</span>
                  </div>
                </div>
                <CardTitle className="text-base font-bold text-foreground line-clamp-2">
                  {tpl.title}
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground line-clamp-3 mt-1.5 leading-relaxed">
                  {tpl.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="pt-3 border-t border-border/40 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    Scope: <strong className="text-foreground">{tpl.orgUnitName}</strong>
                  </span>
                  <Button
                    size="sm"
                    onClick={() => handleOpenModal(tpl)}
                    className="rounded-xl text-xs gap-1.5 bg-primary hover:bg-primary/90 shadow-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Log Session
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. LOGGED ACTIVITIES HISTORY */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-primary" /> My Activity Log & Settlement History
            </h2>
            <p className="text-xs text-muted-foreground">
              Track your logged hours, proof deliverables, and verification status from your department lead.
            </p>
          </div>
          {pendingLogs.length > 0 && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30 font-semibold">
              {pendingLogs.length} Pending Approval
            </Badge>
          )}
        </div>

        <Card className="rounded-2xl border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead className="text-xs font-bold">Date</TableHead>
                <TableHead className="text-xs font-bold">Activity / Category</TableHead>
                <TableHead className="text-xs font-bold">Duration</TableHead>
                <TableHead className="text-xs font-bold">Calculated Reward</TableHead>
                <TableHead className="text-xs font-bold">Notes & Summary</TableHead>
                <TableHead className="text-xs font-bold text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground text-xs">
                    <HeartHandshake className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                    No general tasks logged yet. Choose an activity above to record your student counseling or lab work!
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell className="text-xs font-medium text-foreground whitespace-nowrap">
                      {log.sessionDate}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="font-semibold text-foreground">{log.templateTitle}</div>
                      <Badge variant="secondary" className="text-[9px] px-1.5 py-0 mt-0.5">
                        {log.generalCategory}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium whitespace-nowrap">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3 text-primary" />
                        <span>{log.durationHours} hrs</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-emerald-400 whitespace-nowrap">
                      +{log.credits.toFixed(2)} WORK
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                      {log.notes}
                      {log.proofUrl && (
                        <a
                          href={log.proofUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline ml-2"
                        >
                          <ExternalLink className="h-3 w-3" /> View Proof
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.status === "LEAD_SIGNED" || log.status === "CLOSED" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[10px] font-semibold gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Approved & Credited
                        </Badge>
                      ) : log.status === "REJECTED" ? (
                        <Badge variant="destructive" className="text-[10px] font-semibold gap-1">
                          <AlertCircle className="h-3 w-3" /> Rejected
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px] font-semibold gap-1">
                          <Clock className="h-3 w-3" /> Under Review
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* 4. LOG ACTIVITY MODAL */}
      <Dialog open={!!loggingTemplate} onOpenChange={(open) => !open && setLoggingTemplate(null)}>
        <DialogContent className="sm:max-w-lg rounded-3xl border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
              <HeartHandshake className="h-5 w-5 text-primary" /> Log General Task Session
            </DialogTitle>
            <DialogDescription className="text-xs">
              {loggingTemplate?.title} ({loggingTemplate?.generalCategory})
            </DialogDescription>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-4 py-2">
            {/* Dynamic Proportional Reward Matrix */}
            <div className="p-4 rounded-2xl bg-linear-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Hourly Base Rate:</span>
                <strong className="text-foreground">{loggingTemplate?.hourlyRate} WORK / hr</strong>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Logged Duration:</span>
                <strong className="text-foreground">{durationHours} hours</strong>
              </div>
              <div className="pt-2 border-t border-primary/20 flex items-center justify-between">
                <span className="text-xs font-bold text-foreground">Calculated Reward:</span>
                <span className="text-base font-extrabold text-primary">
                  +{calculatedTokens} WORK Tokens
                </span>
              </div>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Date of Activity</Label>
                <Input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Time Spent (Hours)</Label>
                <Input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="12"
                  value={durationHours}
                  onChange={(e) => setDurationHours(Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                  className="rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Summary / Counselling Notes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={3}
                placeholder="Detail the students counselled (e.g. roll numbers, subjects, backlog guidance) or specific maintenance conducted..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Evidence / Proof URL <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <Input
                type="url"
                placeholder="https://drive.google.com/... or institutional log link"
                value={proofUrl}
                onChange={(e) => setProofUrl(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoggingTemplate(null)}
              disabled={isSubmitting}
              className="rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitLog}
              disabled={isSubmitting || !notes.trim()}
              className="rounded-xl text-xs bg-primary hover:bg-primary/90 font-semibold"
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Sparkles className="h-3.5 w-3.5 mr-1.5" />}
              Submit for Accounting & Reward
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
