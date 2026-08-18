"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, Check, X } from "lucide-react"

interface PendingLoan {
  id: string
  name: string
  department: string
  amount: number
  reason: string
}

interface DirectorActionsProps {
  initialPendingLoans: PendingLoan[]
}

export function DirectorActions({ initialPendingLoans }: DirectorActionsProps) {
  const supabase = createClient()
  const db = supabase as any

  const [pendingLoans, setPendingLoans] = useState<PendingLoan[]>(initialPendingLoans)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleApprove = async (loanId: string) => {
    setActionLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: updateError } = await db
        .from("loans")
        .update({ status: "ACTIVE" })
        .eq("id", loanId)

      if (updateError) throw updateError
      setSuccess("Loan request approved successfully!")
      setPendingLoans((prev) => prev.filter((l) => l.id !== loanId))
    } catch (err) {
      setError("Failed to approve loan request.")
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (loanId: string) => {
    setActionLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const { error: updateError } = await db
        .from("loans")
        .update({ status: "REJECTED" })
        .eq("id", loanId)

      if (updateError) throw updateError
      setSuccess("Loan request rejected.")
      setPendingLoans((prev) => prev.filter((l) => l.id !== loanId))
    } catch (err) {
      setError("Failed to reject loan request.")
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
      <CardHeader>
        <CardTitle className="text-lg font-light">Pending Loan Approvals</CardTitle>
        <CardDescription className="font-light">Approve or reject token loan advances</CardDescription>
      </CardHeader>

      {error && <div className="mx-6 mb-4 p-3 bg-destructive/10 text-destructive text-sm rounded-xl">{error}</div>}
      {success && <div className="mx-6 mb-4 p-3 bg-green-50 border border-green-200 text-green-800 text-sm rounded-xl">{success}</div>}

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {pendingLoans.length === 0 ? (
          <div className="col-span-2 text-center py-6 text-muted-foreground font-light">No pending loan requests.</div>
        ) : (
          pendingLoans.map((pl) => (
            <div key={pl.id} className="p-5 rounded-2xl border border-muted/80 bg-background/60 shadow-2xs flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm text-foreground/90">{pl.name}</span>
                  <Badge variant="outline" className="text-[9px] font-light">{pl.department}</Badge>
                </div>
                <div className="bg-secondary/40 p-3 rounded-xl border border-secondary mb-3">
                  <span className="text-[10px] text-muted-foreground uppercase block font-light">Tokens Requested</span>
                  <span className="text-lg font-semibold text-primary">{pl.amount} WORK</span>
                </div>
                <p className="text-xs text-muted-foreground font-light">{pl.reason}</p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" size="sm" onClick={() => handleReject(pl.id)} disabled={actionLoading} className="flex-1 rounded-xl border-destructive/30 hover:bg-destructive/10 text-destructive text-xs">
                  <X className="h-4 w-4 mr-1" /> Reject
                </Button>
                <Button size="sm" onClick={() => handleApprove(pl.id)} disabled={actionLoading} className="flex-1 rounded-xl text-xs">
                  {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />} Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
