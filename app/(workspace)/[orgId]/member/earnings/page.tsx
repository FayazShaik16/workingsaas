import { requireAuth } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getMemberMonthlyProgress } from "@/lib/workledger/progress"
import { getOrgCycleContext } from "@/lib/workledger/current-cycle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Coins, CheckCircle2, ShieldCheck, History, Sparkles, Calendar } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberEarningsPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()

  const admin = createAdminClient()
  const db = admin as any

  const ctx = await getOrgCycleContext(orgId)
  const progress = await getMemberMonthlyProgress(orgId, user.id, ctx.monthStart)

  // Fetch credit ledger entries
  const { data: ledgerEntries } = await db
    .from("credit_ledger_entries")
    .select("id, credit_type, credit_amount, occurred_at, reference_id, metadata")
    .eq("organization_id", orgId)
    .eq("user_id", user.id)
    .order("occurred_at", { ascending: false })
    .limit(50)

  const entries = ledgerEntries || []

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          My Work Credit Ledger
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Itemized record of recorded scheduled work sessions and approved institutional initiatives.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Earned This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary font-mono">
              {progress.rawEarnedCredits.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">credits</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Scheduled: {progress.scheduledEarnedCredits.toFixed(1)} cr · Initiatives: {progress.unscheduledEarnedCredits.toFixed(1)} cr
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Monthly Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground font-mono">
              {progress.displayProgressPercentage !== null ? `${progress.displayProgressPercentage.toFixed(0)}%` : "0%"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Target: {progress.totalTargetCredits.toFixed(1)} WORK credits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Salary Authorization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold text-foreground mt-1">
              {progress.salaryEligible ? (
                <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs">
                  85% Met (Eligible)
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {progress.creditsToThreshold?.toFixed(1)} cr to 85% Threshold
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Claims open: {progress.salaryRequestOpenDate || "Day 26"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Itemized Ledger Table */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Immutable Credit Ledger Entries ({entries.length})
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Every work event generates a single, irreversible credit entry with complete cryptographic and timestamp auditing.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
              <History className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No credit entries recorded yet.</p>
              <p className="text-muted-foreground">
                Self-complete scheduled sessions or submit initiative reports to generate ledger entries.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                    <th className="py-3 px-4 font-semibold">Activity Type</th>
                    <th className="py-3 px-4 font-semibold">Date & Time</th>
                    <th className="py-3 px-4 font-semibold">Reference ID</th>
                    <th className="py-3 px-4 font-semibold text-right">Credits Awarded</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {entries.map((entry: any) => {
                    const isScheduled = entry.credit_type === "STRUCTURED_SELF_COMPLETION"

                    return (
                      <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            {isScheduled ? (
                              <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            )}
                            <span>{isScheduled ? "Scheduled Work Session (Self-Completed)" : "Institutional Initiative (Approved)"}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground font-mono text-[11px]">
                          {new Date(entry.occurred_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                          {entry.reference_id?.slice(0, 8)}...
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-primary text-right">
                          +{Number(entry.credit_amount).toFixed(1)} cr
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
    </div>
  )
}
