"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Wallet,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Coins,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownLeft,
  Sparkles,
} from "lucide-react"

interface BlockchainTx {
  id: string
  from: string
  to: string
  amount: number
  txHash: string
  blockNumber: number | null
  eventType: string
  status: string
  createdAt: string
  etherscanUrl: string
}

interface WalletData {
  configured: boolean
  address: string | null
  tokenBalance: number
  ethBalance: string
  contractAddress: string
  network: string
  transactions: BlockchainTx[]
}

interface WalletCardProps {
  orgId: string
  userRole?: string
  title?: string
  description?: string
}

export function WalletCard({
  orgId,
  userRole = "MEMBER",
  title = "On-Chain Record (Sepolia Testnet)",
  description = "Verifiable cryptographic mirror on Ethereum Sepolia Testnet for milestone events and salary settlement.",
}: WalletCardProps) {
  const [data, setData] = useState<WalletData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [isProvisioning, setIsProvisioning] = useState(false)

  const fetchWallet = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/wallet/balance")
      const result = await res.json()
      if (res.ok) {
        setData(result)
      }
    } catch (err) {
      console.error("Failed to load blockchain wallet:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWallet()
  }, [])

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCreateWallet = async () => {
    setIsProvisioning(true)
    try {
      const res = await fetch("/api/wallet/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose: userRole === "DIRECTOR" ? "GENESIS" : "PERSONAL",
          orgId,
        }),
      })
      if (res.ok) {
        await fetchWallet()
      }
    } catch (err) {
      console.error("Provisioning failed:", err)
    } finally {
      setIsProvisioning(false)
    }
  }

  const truncateAddress = (addr: string) => {
    if (!addr || addr.length < 12) return addr
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <Card className="rounded-2xl border-2 border-violet-500/20 bg-background/60 backdrop-blur-xs shadow-md overflow-hidden">
      <CardHeader className="bg-violet-500/5 pb-4 border-b border-violet-500/15 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-violet-500/10 text-violet-400">
              <Wallet className="h-4 w-4" />
            </span>
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              {title}
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400 bg-violet-500/10">
                Sepolia ERC-20
              </Badge>
            </CardTitle>
          </div>
          <CardDescription className="text-xs">{description}</CardDescription>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="ghost"
            onClick={fetchWallet}
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground gap-1"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {loading && !data ? (
          <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
            Connecting to Sepolia RPC node...
          </div>
        ) : !data?.configured || !data?.address ? (
          <div className="py-6 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              No on-chain Sepolia wallet linked yet for this account.
            </p>
            <Button
              size="sm"
              onClick={handleCreateWallet}
              disabled={isProvisioning}
              className="bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-semibold gap-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isProvisioning ? "Generating Keypair..." : "Provision Sepolia Wallet"}
            </Button>
          </div>
        ) : (
          <>
            {/* Top Metrics Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Address Card */}
              <div className="p-4 rounded-xl border border-muted/70 bg-muted/20 space-y-1.5">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Public Wallet Address
                </span>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-foreground">
                    {truncateAddress(data.address)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopy(data.address!)}
                      title="Copy Address"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <a
                      href={`https://sepolia.etherscan.io/address/${data.address}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                      title="View on Sepolia Etherscan"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              </div>

              {/* On-Chain WORK Token Balance */}
              <div className="p-4 rounded-xl border border-violet-500/30 bg-violet-500/5 space-y-1">
                <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-wider block">
                  On-Chain WORK Balance
                </span>
                <div className="text-2xl font-black text-foreground font-mono flex items-center gap-1.5">
                  <span>{data.tokenBalance.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground font-normal">WORK</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Mirrored ERC-20 Tokens</span>
              </div>

              {/* Gas Balance */}
              <div className="p-4 rounded-xl border border-muted/70 bg-muted/20 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                  Gas Reserve (Sepolia ETH)
                </span>
                <div className="text-2xl font-black text-foreground font-mono">
                  {data.ethBalance} <span className="text-xs font-normal text-muted-foreground">ETH</span>
                </div>
                <span className="text-[10px] text-muted-foreground">Auto-refilled from Genesis pool</span>
              </div>
            </div>

            {/* Recent On-Chain Transactions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Verified On-Chain Milestones ({data.transactions.length})
                </h4>
                <a
                  href={`https://sepolia.etherscan.io/token/${data.contractAddress}?a=${data.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  Contract Explorer <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              {data.transactions.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed text-center text-xs text-muted-foreground">
                  No on-chain transfers recorded yet. Milestone settlements (e.g. salary claim, loan grant) will generate inspectable Sepolia receipts here.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="p-3 rounded-xl border border-muted/60 bg-muted/10 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                          <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground">{tx.eventType}</span>
                            <Badge className="text-[9px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                              {tx.status}
                            </Badge>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">
                            Tx: {truncateAddress(tx.txHash)} · Block #{tx.blockNumber || "Pending"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                          +{tx.amount.toFixed(2)} WORK
                        </span>
                        <a
                          href={tx.etherscanUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg border border-muted hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                          title="View on Etherscan"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
