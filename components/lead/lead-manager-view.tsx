"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, X, FileText } from "lucide-react"

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
}

export function LeadManagerView({ initialApprovals, initialVerifications, orgId }: LeadManagerViewProps) {
  const supabase = createClient()
  const db = supabase as any
  const [approvals, setApprovals] = useState<SalaryApproval[]>(initialApprovals)
  const [verifications, setVerifications] = useState<Verification[]>(initialVerifications)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

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
    <div className="space-y-6">
      {error && <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-xl">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl">{success}</div>}

      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader>
          <CardTitle className="text-xl font-light">Salary Transfer Approvals</CardTitle>
          <CardDescription className="font-light">Authorize faculty compensation pools</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm font-light">
            <thead>
              <tr className="border-b text-muted-foreground text-xs uppercase">
                <th className="py-3 px-4">Faculty Member</th>
                <th className="py-3 px-4">Target Progress</th>
                <th className="py-3 px-4">Tokens</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {approvals.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-muted-foreground font-light">No members in department.</td>
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
                        <span className="text-xs font-mono">{sa.progress}%</span>
                        <div className="w-32 bg-muted rounded-full h-2 overflow-hidden">
                          <div className={`h-full ${sa.progress >= 85 ? "bg-green-500" : sa.progress >= 70 ? "bg-amber-500" : "bg-destructive"}`} style={{ width: `${sa.progress}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium">{sa.tokens} WORK</td>
                    <td className="py-3 px-4 text-right flex justify-end gap-2">
                      <Button variant="outline" size="xs" className="rounded-lg text-destructive border-destructive/25 hover:bg-destructive/10 text-xs">Reject</Button>
                      <Button size="xs" className="rounded-lg text-xs shadow-3xs">Approve</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Task Completion Verifications */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader>
          <CardTitle className="text-xl font-light">Task Completion Verifications</CardTitle>
          <CardDescription className="font-light">Verify submitted proofs of work</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {verifications.length === 0 ? (
            <div className="col-span-2 text-center py-6 text-muted-foreground font-light">No pending verification requests.</div>
          ) : (
            verifications.map((v) => (
              <div key={v.id} className="p-5 rounded-2xl border border-muted/80 bg-background/60 shadow-2xs flex flex-col justify-between gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm text-foreground/90">{v.submittedBy}</span>
                    <Badge variant="outline" className="text-[9px] font-light">{v.deptName}</Badge>
                  </div>
                  <h4 className="text-sm font-normal text-foreground/90 mb-3">{v.taskTitle}</h4>
                  <div className="flex items-center justify-between bg-secondary/40 p-2.5 rounded-xl border border-secondary text-xs">
                    <span className="text-muted-foreground font-light">Reward</span>
                    <span className="font-semibold text-primary">{v.reward} tokens</span>
                  </div>
                </div>
                <div className="flex gap-2.5 mt-2">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl text-xs flex items-center justify-center gap-1">
                    <FileText className="h-4 w-4" /> View Proof
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRejectVerification(v.id)} disabled={actionLoading} className="rounded-xl h-9 w-9 p-0 shrink-0 text-destructive border-destructive/30">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button size="sm" onClick={() => handleApproveVerification(v.id)} disabled={actionLoading} className="rounded-xl h-9 w-9 p-0 shrink-0 shadow-xs">
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
