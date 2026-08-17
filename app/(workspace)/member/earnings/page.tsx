"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

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
          .single()

        if (walletError && walletError.code !== "PGRST116") throw walletError

        setWallet(walletData)

        // Get transaction history
        const { data: txData, error: txError } = await db
          .from("token_transactions")
          .select("*")
          .eq("to_wallet_id", walletData?.id)
          .order("created_at", { ascending: false })
          .limit(20)

        if (txError && txError.code !== "PGRST116") throw txError

        setTransactions((txData as any) || [])
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch earnings"
        setError(message)
        console.error("[earnings] fetch failed:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchEarnings()
  }, [supabase])

  const typeColors: { [key: string]: string } = {
    MINT: "bg-green-50 text-green-700",
    SALARY_TRANSFER: "bg-blue-50 text-blue-700",
    LOAN_ISSUE: "bg-red-50 text-red-700",
    REVERSE_TRANSFER: "bg-orange-50 text-orange-700",
    LOAN_REPAY: "bg-purple-50 text-purple-700",
    TASK_REWARD: "bg-green-50 text-green-700",
    BONUS: "bg-yellow-50 text-yellow-700",
    BURN: "bg-red-100 text-red-800",
  }

  const statusColors: { [key: string]: string } = {
    PENDING: "bg-yellow-50 text-yellow-700",
    CONFIRMED: "bg-green-50 text-green-700",
    FAILED: "bg-red-50 text-red-700",
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Earnings & Credits</h1>
        <p className="text-muted-foreground mt-2">Track your token-backed credits and transactions</p>
      </div>

      {/* Wallet Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Current Balance</CardTitle>
            <CardDescription>Credits in your PERSONAL wallet</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-primary">{wallet?.balance?.toFixed(2) || "0.00"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Wallet Status</CardTitle>
            <CardDescription>Current wallet state</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {wallet?.is_locked ? (
                <span className="text-destructive">🔒 Locked</span>
              ) : (
                <span className="text-green-700">🔓 Active</span>
              )}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Total Transactions</CardTitle>
            <CardDescription>All-time transaction count</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{transactions.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Recent credit transfers and adjustments</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-muted-foreground">No transactions yet</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transactions.map((tx: Transaction) => (
                <div key={tx.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={typeColors[tx.type] || ""}>
                        {tx.type.replace(/_/g, " ")}
                      </Badge>
                      <Badge className={statusColors[tx.status] || ""}>
                        {tx.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(tx.created_at || tx.timestamp || Date.now()).toLocaleString()}
                    </p>
                    {tx.notes && <p className="text-xs text-muted-foreground mt-1">{tx.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">
                      +{tx.amount.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>How Credits Work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            • <strong>Earn:</strong> Complete assigned tasks to earn credits into your PERSONAL wallet
          </p>
          <p>
            • <strong>Monthly Target:</strong> Your organization has a monthly credit threshold. Meet it to signal salary release eligibility.
          </p>
          <p>
            • <strong>Loans:</strong> Fall short? A token-backed loan from the LOAN_POOL can bridge the gap.
          </p>
          <p>
            • <strong>Transactions:</strong> All credit movements (salary transfers, loan disbursements, task rewards) are logged here with immutable timestamps.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
