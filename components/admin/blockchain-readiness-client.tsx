"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ShieldCheck,
  AlertCircle,
  Coins,
  Fuel,
  RefreshCw,
  Layers,
  Network,
  ExternalLink,
} from "lucide-react"
import { toast } from "sonner"

interface ReadinessData {
  configured: boolean
  chainId?: number
  rpcReachable: boolean
  workTokenAddress?: string
  tokenSymbol?: string
  tokenDecimals?: number
  treasuryAddress?: string
  treasuryEthBalance?: string
  treasuryWorkBalance?: string
  statusMessage: string
}

export function BlockchainReadinessClient() {
  const [data, setData] = useState<ReadinessData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReadiness = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/admin/blockchain/readiness")
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      toast.error("Failed to query blockchain diagnostics.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReadiness()
  }, [])

  return (
    <div className="space-y-6">
      {/* ── Status Card ── */}
      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${data?.rpcReachable ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                {data?.rpcReachable ? <ShieldCheck className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Sepolia RPC Connection</CardTitle>
                <CardDescription className="text-xs">
                  {data?.statusMessage || "Checking network status..."}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-xs ${
                  data?.rpcReachable
                    ? "text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                    : "text-muted-foreground border-border bg-muted/40"
                }`}
              >
                {data?.rpcReachable ? "Connected (Chain ID 11155111)" : "Not Connected"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={fetchReadiness}
                disabled={loading}
                className="h-8 w-8"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>

        {data?.configured && data?.rpcReachable && (
          <CardContent className="space-y-6 pt-2 border-t text-xs">
            {/* Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-lg bg-muted/40 border space-y-1">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Network className="h-3.5 w-3.5" />
                  WORK Token Contract (ERC-20)
                </span>
                <p className="font-mono text-foreground font-semibold break-all text-[11px]">
                  {data.workTokenAddress}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Symbol: {data.tokenSymbol} | Decimals: {data.tokenDecimals}
                </p>
              </div>

              <div className="p-3.5 rounded-lg bg-muted/40 border space-y-1">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Treasury Vault Address
                </span>
                <p className="font-mono text-foreground font-semibold break-all text-[11px]">
                  {data.treasuryAddress}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Disbursement Key Active
                </p>
              </div>
            </div>

            {/* Balances */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-card/60 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                  <Coins className="h-4 w-4 text-amber-500" />
                  Treasury WORK Token Liquidity
                </div>
                <div className="text-xl font-bold tracking-tight text-foreground">
                  {data.treasuryWorkBalance} <span className="text-xs font-semibold text-muted-foreground">WORK</span>
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-card/60 space-y-1">
                <div className="flex items-center gap-2 text-muted-foreground font-medium">
                  <Fuel className="h-4 w-4 text-sky-500" />
                  Treasury ETH Gas Reserve
                </div>
                <div className="text-xl font-bold tracking-tight text-foreground">
                  {data.treasuryEthBalance} <span className="text-xs font-semibold text-muted-foreground">ETH</span>
                </div>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
