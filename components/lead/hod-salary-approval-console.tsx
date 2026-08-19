"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ShieldCheck,
  Calendar,
  Users,
  Coins,
  FileCheck,
  Loader2,
  Sparkles,
  Search,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface FacultySalaryProfile {
  id: string
  name: string
  email: string
  designation?: string
  progress_percentage: number
  earned_credits: number
  target_credits: number
  quality_score: number
  attendance_logged_count: number
  approved_leaves_count: number
  has_active_loan: boolean
  org_unit_name: string
  status: string
  endorsed?: boolean
}

interface HODSalaryApprovalConsoleProps {
  orgId: string
  leadUserId: string
  members: FacultySalaryProfile[]
}

export function HODSalaryApprovalConsole({
  orgId,
  leadUserId,
  members: initialMembers,
}: HODSalaryApprovalConsoleProps) {
  const router = useRouter()

  const [members, setMembers] = useState<FacultySalaryProfile[]>(initialMembers)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)
  const [inspectedMember, setInspectedMember] = useState<FacultySalaryProfile | null>(null)

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)
  })

  const eligibleMembers = filteredMembers.filter((m) => m.progress_percentage >= 85)
  const eligibleCount = members.filter((m) => m.progress_percentage >= 85).length
  const totalCount = members.length

  const handleSelectAllEligible = (checked: boolean) => {
    if (checked) {
      setSelectedIds(eligibleMembers.map((m) => m.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleToggleMember = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const handleExecuteEndorsement = async (ids: string[]) => {
    if (ids.length === 0) return

    setIsProcessing(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/lead/endorse-salary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memberIds: ids,
          action: "ENDORSE",
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to endorse salary release.")
      }

      setMembers((prev) =>
        prev.map((m) => (ids.includes(m.id) ? { ...m, endorsed: true } : m))
      )
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)))

      setFeedback({
        type: "success",
        text: data.message || `Endorsed ${ids.length} faculty salary claims.`,
      })

      router.refresh()
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "An unexpected error occurred.",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Eligible for Release
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono">
              {eligibleCount} / {totalCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">≥85% Verified Proof Threshold</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Deficit / Work Loan
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
              {totalCount - eligibleCount}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">&lt;85% Requires Loan Bridge</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Department Clearance
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-foreground font-mono">
              {totalCount > 0 ? Math.round((eligibleCount / totalCount) * 100) : 0}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Payroll Readiness Ratio</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Credits Earned
            </CardTitle>
            <ShieldCheck className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-violet-600 dark:text-violet-400 font-mono">
              {members.reduce((sum, m) => sum + Number(m.earned_credits || 0), 0).toFixed(1)}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">Verified Teaching Work Load</p>
          </CardContent>
        </Card>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold ${
            feedback.type === "success"
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
              : "bg-destructive/10 text-destructive border-destructive/20"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Main Table Card */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="pb-3 border-b border-muted/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Monthly Departmental Salary Approval Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Cryptographically verify faculty teaching load and structured commitments before endorsing salary release to Finance.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => handleExecuteEndorsement(selectedIds)}
              disabled={selectedIds.length === 0 || isProcessing}
              className="rounded-xl text-xs h-8 font-semibold shadow-xs"
            >
              {isProcessing ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
              )}
              Endorse Selected ({selectedIds.length})
            </Button>

            <Button
              size="sm"
              onClick={() =>
                handleExecuteEndorsement(eligibleMembers.map((m) => m.id))
              }
              disabled={eligibleMembers.length === 0 || isProcessing}
              className="rounded-xl text-xs h-8 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Endorse All Eligible ({eligibleCount})
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm font-light">
              No faculty members found in this department.
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-muted/20">
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={
                        eligibleMembers.length > 0 &&
                        eligibleMembers.every((m) => selectedIds.includes(m.id))
                      }
                      onChange={(e) => handleSelectAllEligible(e.target.checked)}
                      className="rounded h-3.5 w-3.5 text-primary"
                    />
                  </TableHead>
                  <TableHead className="text-xs font-bold">Faculty Member</TableHead>
                  <TableHead className="text-xs font-bold">Work Progress & Target</TableHead>
                  <TableHead className="text-xs font-bold">Teaching Attendance</TableHead>
                  <TableHead className="text-xs font-bold">Leaves</TableHead>
                  <TableHead className="text-xs font-bold">Eligibility</TableHead>
                  <TableHead className="text-xs font-bold text-right">Digital Endorsement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((m) => {
                  const progress = Number(m.progress_percentage || 0)
                  const isEligible = progress >= 85
                  const isSelected = selectedIds.includes(m.id)

                  return (
                    <TableRow key={m.id} className="hover:bg-muted/20 text-xs">
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!isEligible}
                          onChange={() => handleToggleMember(m.id)}
                          className="rounded h-3.5 w-3.5 text-primary disabled:opacity-30"
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <div className="font-bold text-foreground">{m.name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{m.email}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full ${
                                  isEligible
                                    ? "bg-emerald-500"
                                    : progress >= 70
                                    ? "bg-amber-500"
                                    : "bg-destructive"
                                }`}
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                            <span className="font-bold font-mono text-xs">{progress}%</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground font-mono">
                            {m.earned_credits} / {m.target_credits} WORK
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {m.attendance_logged_count} Sessions
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-muted-foreground">
                          {m.approved_leaves_count} Days
                        </span>
                      </TableCell>
                      <TableCell>
                        {m.endorsed ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            ✓ Endorsed
                          </Badge>
                        ) : isEligible ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Eligible (≥85%)
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">
                            Deficit ({progress}%)
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {m.endorsed ? (
                          <span className="text-[11px] text-emerald-600 font-bold">Forwarded to Finance</span>
                        ) : isEligible ? (
                          <Button
                            size="xs"
                            onClick={() => handleExecuteEndorsement([m.id])}
                            disabled={isProcessing}
                            className="rounded-lg text-xs font-semibold shadow-2xs"
                          >
                            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Endorse Signature
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            onClick={() => setInspectedMember(m)}
                            className="rounded-lg text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
                          >
                            Inspect Deficit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Deficit Inspection Modal */}
      <Dialog open={!!inspectedMember} onOpenChange={() => setInspectedMember(null)}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-500" />
              Faculty Deficit & Work-Loan Inspection
            </DialogTitle>
            <DialogDescription className="text-xs">
              {inspectedMember?.name} ({inspectedMember?.email})
            </DialogDescription>
          </DialogHeader>

          {inspectedMember && (
            <div className="space-y-3 pt-2 text-xs">
              <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Progress:</span>
                  <span className="font-bold text-foreground font-mono">{inspectedMember.progress_percentage}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Credits Earned:</span>
                  <span className="font-bold text-foreground font-mono">{inspectedMember.earned_credits} WORK</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target Denominator:</span>
                  <span className="font-bold text-foreground font-mono">{inspectedMember.target_credits} WORK</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-amber-500/30">
                  <span className="font-bold text-amber-800 dark:text-amber-300">Deficit to 85% Gate:</span>
                  <span className="font-bold text-amber-600 font-mono">
                    {Math.max(0, Math.ceil(inspectedMember.target_credits * 0.85) - inspectedMember.earned_credits)} WORK
                  </span>
                </div>
              </div>

              <p className="text-muted-foreground leading-relaxed text-[11px]">
                This faculty member has not yet achieved the 85% threshold. They may bridge this gap by requesting a work-loan or completing unstructured open pool tasks before the payroll snapshot cutoff.
              </p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button size="sm" onClick={() => setInspectedMember(null)} className="rounded-xl text-xs">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
