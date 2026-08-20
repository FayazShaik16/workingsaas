"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Loader2,
  Check,
  X,
  FileText,
  Wallet,
  PiggyBank,
  TrendingUp,
  Coins,
  ArrowRight,
  Sparkles,
  ClipboardList,
  CreditCard,
  Building2,
  CheckCircle2,
  Clock,
} from "lucide-react"
import Link from "next/link"

export interface DepartmentBudget {
  allocatedBudget: number
  spentBudget: number
  budgetCurrency: string
  budgetPeriod: string
  budgetNotes?: string
}

interface SalaryApproval {
  id: string
  name: string
  designation: string
  progress: number
  tokens: number
}

interface Verification {
  id: string
  submittedBy: string
  deptName: string
  taskTitle: string
  reward: number
  submittedAt: string
}

interface LeadManagerViewProps {
  initialApprovals: SalaryApproval[]
  initialVerifications: Verification[]
  orgId: string
  budget?: DepartmentBudget
  deptName?: string
}

export function LeadManagerView({
  initialApprovals,
  initialVerifications,
  orgId,
  budget,
  deptName = "Department",
}: LeadManagerViewProps) {
  const supabase = createClient()
  const db = supabase as any
  const [approvals, setApprovals] = useState<SalaryApproval[]>(initialApprovals)
  const [verifications, setVerifications] = useState<Verification[]>(initialVerifications)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Budget calculations
  const allocated = budget?.allocatedBudget || 0
  const spent = budget?.spentBudget || 0
  const currency = budget?.budgetCurrency || "WORK"
  const period = budget?.budgetPeriod || "MONTHLY"
  const remaining = Math.max(0, allocated - spent)
  const utilizationPercent = allocated > 0 ? Math.round((spent / allocated) * 100) : 0

  const handleApproveVerification = async (taskId: string) => {
    setActionLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: updateError } = await db
        .from("tasks")
        .update({ status: "LEAD_SIGNED" })
        .eq("id", taskId)

      if (updateError) throw updateError
      setSuccess("Task verification approved successfully!")
      setVerifications((prev) => prev.filter((v) => v.id !== taskId))
    } catch (err) {
      setError("Failed to approve verification.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectVerification = async (taskId: string) => {
    setActionLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: updateError } = await db
        .from("tasks")
        .update({ status: "OPEN" })
        .eq("id", taskId)

      if (updateError) throw updateError
      setSuccess("Task returned to Open status.")
      setVerifications((prev) => prev.filter((v) => v.id !== taskId))
    } catch (err) {
      setError("Failed to reject verification.")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl">{success}</div>}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. Department Allocated Budget Panel (Director Allocated)      */}
      {/* ───────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-light text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Department Financial & Token Budget
            </h2>
            <p className="text-xs text-muted-foreground font-light">
              Allocated by Institutional Director for {deptName} operations and faculty credit claims.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 shadow-2xs">
              <Link href={`/${orgId}/lead/tasks`}>
                <ClipboardList className="h-3.5 w-3.5 text-primary" />
                Task Management
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5 shadow-2xs border-amber-500/30 text-amber-600 dark:text-amber-400">
              <Link href={`/${orgId}/lead/tasks?tab=pending`}>
                <Clock className="h-3.5 w-3.5" />
                Pending Tasks
              </Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl text-xs gap-1.5 shadow-xs">
              <Link href={`/${orgId}/lead/salary`}>
                <CreditCard className="h-3.5 w-3.5" />
                Salary Approvals
              </Link>
            </Button>
          </div>
        </div>

        {/* 4 Dedicated Quick Access Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <Link href={`/${orgId}/lead/tasks/existing`} className="group">
            <Card className="rounded-2xl border-muted/70 bg-background/50 hover:bg-background/80 hover:border-primary/40 transition-all p-4 shadow-2xs group-hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <ClipboardList className="h-4 w-4 text-primary" /> Existing Tasks
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-light">
                Directory of all active and historical department assignments.
              </p>
            </Card>
          </Link>

          <Link href={`/${orgId}/lead/tasks/pending`} className="group">
            <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all p-4 shadow-2xs group-hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Pending Tasks
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-amber-600 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-light">
                Highest priority tasks first with date-wise filtering.
              </p>
            </Card>
          </Link>

          <Link href={`/${orgId}/lead/tasks`} className="group">
            <Card className="rounded-2xl border-muted/70 bg-background/50 hover:bg-background/80 hover:border-primary/40 transition-all p-4 shadow-2xs group-hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-primary" /> Task Management Hub
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-1 group-hover:text-primary transition-all" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-light">
                Triage, create, and verify all departmental tasks.
              </p>
            </Card>
          </Link>

          <Link href={`/${orgId}/lead/salary`} className="group">
            <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all p-4 shadow-2xs group-hover:shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" /> Salary Approvals
                </span>
                <ArrowRight className="h-3.5 w-3.5 text-emerald-600 group-hover:translate-x-1 transition-all" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-light">
                TaskWise & FacultyWise monthly endorsement release.
              </p>
            </Card>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-16 w-16 bg-primary/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Allocated Budget</span>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {allocated.toLocaleString()}{" "}
                <span className="text-xs font-normal text-muted-foreground uppercase">{currency}</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Badge variant="secondary" className="text-[10px] font-normal uppercase py-0 px-1.5">
                  {period}
                </Badge>
                <span className="text-[11px] text-muted-foreground font-light">Director Allocated</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-16 w-16 bg-amber-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Utilized / Disbursed</span>
                <Coins className="h-4 w-4 text-amber-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {spent.toLocaleString()}{" "}
                <span className="text-xs font-normal text-muted-foreground uppercase">{currency}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-light">
                {utilizationPercent}% of allocated budget claimed
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs relative overflow-hidden group">
            <div className="absolute top-0 right-0 h-16 w-16 bg-emerald-500/5 rounded-bl-full pointer-events-none group-hover:scale-110 transition-transform" />
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Remaining Pool</span>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {remaining.toLocaleString()}{" "}
                <span className="text-xs font-normal text-muted-foreground uppercase">{currency}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 font-light">
                Available for pending task sign-offs
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs flex flex-col justify-between">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                <span>Budget Status</span>
                <Wallet className="h-4 w-4 text-sky-500" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-light">Capacity Health</span>
                <span
                  className={`font-semibold text-xs ${
                    utilizationPercent >= 100
                      ? "text-destructive"
                      : utilizationPercent >= 80
                      ? "text-amber-500"
                      : "text-emerald-500"
                  }`}
                >
                  {utilizationPercent >= 100 ? "Cap Exceeded" : utilizationPercent >= 80 ? "Near Limit" : "Healthy"}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all rounded-full ${
                    utilizationPercent >= 100
                      ? "bg-destructive"
                      : utilizationPercent >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, utilizationPercent)}%` }}
                />
              </div>
              {budget?.budgetNotes && (
                <p className="text-[10px] text-muted-foreground italic line-clamp-1 pt-1">
                  Note: &ldquo;{budget.budgetNotes}&rdquo;
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2. Salary Release Quick Triage Section                         */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
          <div>
            <CardTitle className="text-xl font-light">Salary Endorsement Queue</CardTitle>
            <CardDescription className="font-light">
              Authorize monthly faculty salary release claims meeting the 85% verification threshold.
            </CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1">
            <Link href={`/${orgId}/lead/salary`}>
              Open Dual-View Salary Approval Console <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm font-light">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="py-3 px-4">Faculty Member</th>
                <th className="py-3 px-4">Target Progress</th>
                <th className="py-3 px-4">Earned Tokens</th>
                <th className="py-3 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-muted-foreground font-light">
                    No members assigned to this department.
                  </td>
                </tr>
              ) : (
                approvals.map((sa) => (
                  <tr key={sa.id} className="border-b hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-normal text-foreground/90">{sa.name}</p>
                        <p className="text-xs text-muted-foreground font-light">{sa.designation}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-mono font-medium">{sa.progress}%</span>
                        <div className="w-28 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              sa.progress >= 85
                                ? "bg-green-500"
                                : sa.progress >= 70
                                ? "bg-amber-500"
                                : "bg-destructive"
                            }`}
                            style={{ width: `${Math.min(100, sa.progress)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-primary">{sa.tokens} WORK</td>
                    <td className="py-3 px-4 text-right">
                      {sa.progress >= 85 ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                          Eligible (85%+)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px]">
                          In Progress
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. Task Completion Verifications Quick Section                */}
      {/* ───────────────────────────────────────────────────────────── */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4">
          <div>
            <CardTitle className="text-xl font-light">Pending Task Verifications</CardTitle>
            <CardDescription className="font-light">Verify submitted proofs of work and authorize token release.</CardDescription>
          </div>
          <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1">
            <Link href={`/${orgId}/lead/tasks`}>
              Manage All Tasks <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {verifications.length === 0 ? (
            <div className="col-span-2 text-center py-6 text-muted-foreground font-light">
              No pending verification requests in this department.
            </div>
          ) : (
            verifications.map((v) => (
              <div
                key={v.id}
                className="p-5 rounded-2xl border border-muted/80 bg-background/60 shadow-2xs flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-foreground/90">{v.submittedBy}</span>
                    <Badge variant="outline" className="text-[9px] font-light">
                      {v.deptName}
                    </Badge>
                  </div>
                  <h4 className="text-sm font-normal text-foreground/90 mb-3">{v.taskTitle}</h4>
                  <div className="flex items-center justify-between bg-secondary/40 p-2.5 rounded-xl border border-secondary text-xs">
                    <span className="text-muted-foreground font-light">Reward</span>
                    <span className="font-semibold text-primary">{v.reward} tokens</span>
                  </div>
                </div>
                <div className="flex gap-2.5 mt-2">
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="flex-1 rounded-xl text-xs flex items-center justify-center gap-1"
                  >
                    <Link href={`/${orgId}/lead/verification/${v.id}`}>
                      <FileText className="h-4 w-4" /> View Proof
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRejectVerification(v.id)}
                    disabled={actionLoading}
                    className="rounded-xl h-9 w-9 p-0 shrink-0 text-destructive border-destructive/30"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproveVerification(v.id)}
                    disabled={actionLoading}
                    className="rounded-xl h-9 w-9 p-0 shrink-0 shadow-xs"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
