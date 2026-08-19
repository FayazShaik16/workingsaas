"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Coins, CheckCircle2, ShieldCheck, History, ArrowUpRight } from "lucide-react"

interface Transaction {
  id: string
  amount: number
  type: string
  status: string
  created_at?: string
  timestamp?: string
  notes?: string
}

export default function EarningsPage() {
  const params = useParams()
  const orgId = (params?.orgId as string) || ""
  const supabase = createClient()
  const db = supabase as any

  const [wallet, setWallet] = useState<any>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchEarnings = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        if (!authData?.user) throw new Error("Not authenticated")

        // Get PERSONAL wallet
        const { data: walletData, error: walletError } = await db
          .from("wallets")
          .select("*")
          .eq("owner_user_id", authData.user.id)
          .eq("purpose", "PERSONAL")
          .maybeSingle()

        if (walletError) {
          console.warn("[earnings] wallet query note:", walletError.message || walletError)
        }

        setWallet(walletData || { balance: 0, is_locked: false })

        // Get transaction history only if wallet exists
        if (walletData?.id) {
          const { data: txData, error: txError } = await db
            .from("token_transactions")
            .select("*")
            .eq("to_wallet_id", walletData.id)
            .order("created_at", { ascending: false })
            .limit(30)

          if (txError) {
            console.warn("[earnings] tx query note:", txError.message || txError)
          }

          setTransactions((txData as any) || [])
        } else {
          setTransactions([])
        }
      } catch (err: any) {
        const message = err?.message || (typeof err === "string" ? err : "Failed to fetch earnings")
        setError(message)
        console.error("[earnings] fetch failed:", message)
      } finally {
        setLoading(false)
      }
    }

    fetchEarnings()
  }, [supabase])

  const typeColors: { [key: string]: string } = {
    MINT: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    SALARY_TRANSFER: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    LOAN_ISSUE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    REVERSE_TRANSFER: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
    LOAN_REPAY: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    TASK_REWARD: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    BONUS: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    BURN: "bg-destructive/10 text-destructive border-destructive/20",
  }

  const statusColors: { [key: string]: string } = {
    PENDING: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    CONFIRMED: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    FAILED: "bg-destructive/10 text-destructive border-destructive/20",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
          My Earnings & Credit Ledger
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track your earned institutional credits, verified teaching sessions, and monthly salary release progress.
        </p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Available Credits</CardTitle>
              <CardDescription className="text-xs mt-0.5">Verified balance in your account</CardDescription>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Coins className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-primary font-mono">
                {Number(wallet?.balance || 0).toFixed(2)}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">credits</span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Account Status</CardTitle>
              <CardDescription className="text-xs mt-0.5">Institutional verification standing</CardDescription>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mt-1">
              {wallet?.is_locked ? (
                <Badge variant="destructive" className="text-xs font-semibold px-3 py-1">
                  🔒 Locked by Finance
                </Badge>
              ) : (
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-xs font-semibold px-3 py-1">
                  ✓ Active & Verified
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold text-muted-foreground">Completed Activities</CardTitle>
              <CardDescription className="text-xs mt-0.5">Verified sessions & approved tasks</CardDescription>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-foreground font-mono">
                {transactions.length}
              </span>
              <span className="text-xs font-semibold text-muted-foreground">events</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History Ledger */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="flex flex-row items-center justify-between pb-4 border-b">
          <div>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              Verified Activity History
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Itemized record of class attendance credits and completed departmental contributions
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground space-y-2">
              <Coins className="h-10 w-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">No credit transactions recorded yet</p>
              <p className="text-xs opacity-75">
                Attendance logs and completed tasks will appear here automatically upon HOD verification.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.map((tx: Transaction) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-4 rounded-xl border border-muted/50 bg-background/40 hover:bg-muted/20 transition"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] font-bold ${typeColors[tx.type] || "bg-muted text-muted-foreground"}`}>
                        {tx.type.replace(/_/g, " ")}
                      </Badge>
                      <Badge className={`text-[10px] font-bold ${statusColors[tx.status] || "bg-muted text-muted-foreground"}`}>
                        {tx.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at || tx.timestamp || Date.now()).toLocaleDateString(undefined, {
                        weekday: "short",
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {tx.notes && <p className="text-xs text-foreground/80 font-medium">{tx.notes}</p>}
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-base font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-0.5">
                      <ArrowUpRight className="h-4 w-4" />
                      +{Number(tx.amount || 0).toFixed(2)}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">Credits</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Educational Guidelines */}
      <Card className="rounded-2xl border-muted/60 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            How Institutional Work Credits Function
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground leading-relaxed">
          <p>
            • <strong>Teaching Sessions (75% structured load):</strong> Each scheduled lecture or lab period logged in your weekly schedule generates micro-credits upon HOD verification.
          </p>
          <p>
            • <strong>Departmental & Committee Work (25% unstructured load):</strong> Extra contributions, accreditation tasks, or committee duties can be claimed from the Task Marketplace.
          </p>
          <p>
            • <strong>Monthly Authorization:</strong> Reaching 85% of your personalized monthly target automatically releases salary disbursement authorization for the current billing cycle.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
