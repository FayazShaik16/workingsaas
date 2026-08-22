"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Vault,
  Coins,
  Fuel,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
} from "lucide-react"
import { toast } from "sonner"

interface TreasuryData {
  configured: boolean
  treasuryAddress: string | null
  ethBalance: string
  workBalance: string
  network: string
  tokenAddress?: string
  message?: string
}

export function DirectorTreasuryView() {
  const [data, setData] = useState<TreasuryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const fetchTreasury = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/wallets/treasury")
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      toast.error("Failed to load treasury data.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTreasury()
  }, [])

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopied(true)
    toast.success("Treasury address copied to clipboard.")
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Querying Treasury pool on Sepolia...</p>
        </div>
      </div>
    )
  }

  if (!data?.configured) {
    return (
      <Card className="border-border/60 bg-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted text-muted-foreground">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Institutional Treasury Pool</CardTitle>
              <CardDescription>On-Chain Liquidity & Settlement Vault</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">Treasury wallet is not configured.</p>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              Configure `TREASURY_PRIVATE_KEY` and `WORK_TOKEN_ADDRESS` in server environment to enable automated on-chain salary settlement transfers to verified faculty audit wallets.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                <Vault className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Institutional Treasury Vault</CardTitle>
                <CardDescription>Master Disbursement Pool on Ethereum Sepolia</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-amber-600 border-amber-500/30 bg-amber-500/10">
                Sepolia Treasury Active
              </Badge>
              <Button variant="ghost" size="icon" onClick={fetchTreasury} className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground font-medium">Treasury Public Address</span>
              <p className="font-mono text-foreground font-semibold break-all">
                {data.treasuryAddress}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyAddress(data.treasuryAddress || "")}
              className="gap-1.5 self-start sm:self-auto h-8 text-xs shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-card/60 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <Coins className="h-4 w-4 text-amber-500" />
                Treasury WORK Balance
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {data.workBalance} <span className="text-xs font-semibold text-muted-foreground">WORK</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Available liquidity for faculty monthly salary settlements.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-card/60 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <Fuel className="h-4 w-4 text-sky-500" />
                Treasury Sepolia ETH Gas
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {data.ethBalance} <span className="text-xs font-semibold text-muted-foreground">ETH</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Gas reserve for automated contract disbursements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
