"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Wallet,
  Coins,
  Fuel,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  PlusCircle,
} from "lucide-react"
import { toast } from "sonner"

interface WalletData {
  status: "NOT_CONFIGURED" | "READY_NO_WALLET" | "READY"
  configured: boolean
  rpcReachable?: boolean
  wallet?: {
    id: string
    publicAddress: string
    ethBalance: string
    workBalance: string
    network: string
    createdAt: string
  } | null
  transactions?: Array<{
    id: string
    txHash: string
    amount: number
    eventType: string
    status: string
    blockNumber?: number
    createdAt: string
    etherscanUrl: string
  }>
  message?: string
}

export function MemberWalletView() {
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchWallet = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/wallets/me")
      const json = await res.json()
      setData(json)
    } catch (err: any) {
      toast.error("Failed to load audit wallet.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWallet()
  }, [])

  const handleCreateWallet = async () => {
    try {
      setCreating(true)
      const res = await fetch("/api/wallets/me", { method: "POST" })
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json.error || "Failed to create wallet")
      }
      toast.success("Personal blockchain audit wallet created successfully.")
      await fetchWallet()
    } catch (err: any) {
      toast.error(err.message || "Failed to generate wallet.")
    } finally {
      setCreating(false)
    }
  }

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr)
    setCopied(true)
    toast.success("Public address copied to clipboard.")
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[350px]">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">Connecting to Sepolia testnet...</p>
        </div>
      </div>
    )
  }

  if (data?.status === "NOT_CONFIGURED") {
    return (
      <div className="space-y-6">
        <Card className="border-border/60 bg-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted text-muted-foreground">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Blockchain Audit Integration</CardTitle>
                <CardDescription>Ethereum Sepolia On-Chain Verification Engine</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-dashed p-6 text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Blockchain audit wallet is not configured.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                The institution has not configured Sepolia testnet credentials in the server environment. Your earned work credits and salary settlements remain fully recorded on the Supabase ledger.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (data?.status === "READY_NO_WALLET") {
    return (
      <div className="space-y-6">
        <Card className="border-border/60 bg-card">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <Wallet className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold">Personal Audit Wallet</CardTitle>
                  <CardDescription>Sepolia Testnet Custodial Identity</CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-xs">Sepolia Ready</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3">
              <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Your audit wallet has not been created.</p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Generate your dedicated cryptographic keypair to receive verified on-chain ERC-20 WORK tokens upon approved salary settlements.
                </p>
              </div>
              <Button onClick={handleCreateWallet} disabled={creating} className="gap-2">
                {creating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                Create Audit Wallet
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const wallet = data?.wallet
  const transactions = data?.transactions || []

  return (
    <div className="space-y-6">
      {/* ── Wallet Header Card ── */}
      <Card className="border-border/60 bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Verified Audit Wallet</CardTitle>
                <CardDescription>Live Cryptographic Identity on Ethereum Sepolia</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                Sepolia Active
              </Badge>
              <Button variant="ghost" size="icon" onClick={fetchWallet} className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Public Address */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-muted/40 border text-xs">
            <div className="space-y-0.5">
              <span className="text-muted-foreground font-medium">Public Address</span>
              <p className="font-mono text-foreground font-semibold break-all">
                {wallet?.publicAddress}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyAddress(wallet?.publicAddress || "")}
              className="gap-1.5 self-start sm:self-auto h-8 text-xs shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>

          {/* Live Balances Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border bg-card/60 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <Coins className="h-4 w-4 text-amber-500" />
                WORK Token Balance (ERC-20)
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {wallet?.workBalance || "0.0"} <span className="text-xs font-semibold text-muted-foreground">WORK</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Live contract balance queried from Sepolia testnet.
              </p>
            </div>

            <div className="p-4 rounded-xl border bg-card/60 space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
                <Fuel className="h-4 w-4 text-sky-500" />
                Sepolia ETH Gas Balance
              </div>
              <div className="text-2xl font-bold tracking-tight text-foreground">
                {wallet?.ethBalance || "0.0"} <span className="text-xs font-semibold text-muted-foreground">ETH</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Required for self-initiated transactions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Transaction History Table ── */}
      <Card className="border-border/60 bg-card">
        <CardHeader>
          <CardTitle className="text-base font-semibold">On-Chain Transaction History</CardTitle>
          <CardDescription>Actual verified settlements on the Sepolia blockchain</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No on-chain transactions recorded yet for this wallet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="border-b text-muted-foreground uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Event</th>
                    <th className="py-2.5 px-3">Amount</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3 text-right">Etherscan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="py-2.5 px-3 font-medium text-foreground">{tx.eventType}</td>
                      <td className="py-2.5 px-3 font-semibold text-foreground">{tx.amount} WORK</td>
                      <td className="py-2.5 px-3">
                        <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <a
                          href={tx.etherscanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
                        >
                          {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
