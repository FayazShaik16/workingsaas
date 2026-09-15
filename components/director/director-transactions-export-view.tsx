"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Download,
  ScrollText,
  FileSpreadsheet,
  Filter,
  Search,
  Calendar,
  Building2,
  Users,
  Coins,
  Copy,
  Check,
  Loader2,
  FileText,
  RefreshCw,
} from "lucide-react"
import {
  TransactionRecord,
  TransactionPeriodFilter,
  generateTransactionsCSV,
} from "@/lib/workledger/transactions-export"

interface DepartmentOption {
  id: string
  name: string
}

interface DirectorTransactionsExportViewProps {
  orgId: string
  initialTransactions: TransactionRecord[]
  departments: DepartmentOption[]
}

export function DirectorTransactionsExportView({
  orgId,
  initialTransactions,
  departments,
}: DirectorTransactionsExportViewProps) {
  const [transactions, setTransactions] = useState<TransactionRecord[]>(initialTransactions)
  const [period, setPeriod] = useState<TransactionPeriodFilter>("this_month")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [deptFilter, setDeptFilter] = useState("ALL")
  const [creditTypeFilter, setCreditTypeFilter] = useState("ALL")
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Fetch updated logs from API when server-side filters change
  const handleApplyFilters = async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      params.set("period", period)
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      if (deptFilter !== "ALL") params.set("deptId", deptFilter)
      if (creditTypeFilter !== "ALL") params.set("creditType", creditTypeFilter)
      if (searchQuery.trim()) params.set("searchQuery", searchQuery.trim())

      const res = await fetch(`/api/director/transactions/export?${params.toString()}`)
      const data = await res.json()
      if (res.ok && data.transactions) {
        setTransactions(data.transactions)
      }
    } catch (err) {
      console.error("Filter fetch error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  // Client-side instant filter on already loaded data
  const filteredList = useMemo(() => {
    return transactions.filter((t) => {
      if (deptFilter !== "ALL" && t.departmentId !== deptFilter) return false
      if (creditTypeFilter !== "ALL" && t.creditType !== creditTypeFilter) return false
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchName = t.facultyName.toLowerCase().includes(q)
        const matchEmail = t.facultyEmail.toLowerCase().includes(q)
        const matchDept = t.departmentName.toLowerCase().includes(q)
        const matchReason = t.reason.toLowerCase().includes(q)
        const matchId = t.id.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchDept && !matchReason && !matchId) return false
      }
      return true
    })
  }, [transactions, deptFilter, creditTypeFilter, searchQuery])

  // Summary Metrics
  const totalVolume = filteredList.reduce((sum, t) => sum + t.amount, 0)
  const uniqueFaculty = new Set(filteredList.map((t) => t.facultyId)).size

  // Copy Transaction ID
  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  // Download CSV
  const handleDownloadCSV = () => {
    const csvContent = generateTransactionsCSV(filteredList)
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const dateTag = new Date().toISOString().slice(0, 10)
    link.setAttribute("href", url)
    link.setAttribute("download", `organization_transactions_${dateTag}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Download JSON
  const handleDownloadJSON = () => {
    const jsonContent = JSON.stringify(filteredList, null, 2)
    const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const dateTag = new Date().toISOString().slice(0, 10)
    link.setAttribute("href", url)
    link.setAttribute("download", `organization_transactions_${dateTag}.json`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-8">
      {/* 1. HERO HEADER */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-linear-to-br from-card via-card/90 to-primary/5 p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-semibold">
              <ScrollText className="h-3.5 w-3.5" />
              <span>Executive Compliance & Audit Export</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
              Organization Transaction Logs Center
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Complete, immutable ledger of all capability tokens, class self-completions, task bonuses, and voluntary productivity disbursements.
              Filter by period or department and download official audit reports.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              onClick={handleDownloadCSV}
              disabled={filteredList.length === 0}
              className="rounded-2xl text-xs gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 shadow-sm"
            >
              <FileSpreadsheet className="h-4 w-4" /> Download CSV
            </Button>
            <Button
              variant="outline"
              onClick={handleDownloadJSON}
              disabled={filteredList.length === 0}
              className="rounded-2xl text-xs gap-2 font-semibold px-4 py-2.5"
            >
              <Download className="h-4 w-4" /> Download JSON
            </Button>
          </div>
        </div>

        {/* METRICS ROW */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 pt-6 border-t border-border/50">
          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Filtered Records
            </span>
            <span className="text-xl font-black text-foreground">{filteredList.length}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20">
            <span className="text-[10px] text-primary uppercase font-bold tracking-wider block">
              Total WORK Volume
            </span>
            <span className="text-xl font-black text-primary">
              +{totalVolume.toFixed(2)} <span className="text-xs font-semibold">WORK</span>
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Beneficiary Faculty
            </span>
            <span className="text-xl font-black text-foreground">{uniqueFaculty}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-background/80 border">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider block">
              Active Time Horizon
            </span>
            <span className="text-sm font-bold text-foreground capitalize">
              {period.replace("_", " ")}
            </span>
          </div>
        </div>
      </div>

      {/* 2. FILTER CONTROLS */}
      <Card className="rounded-2xl border-border/60 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Filter className="h-4 w-4 text-primary" />
            <span>Multi-Parameter Audit Filters</span>
          </div>
          <Button
            size="xs"
            variant="ghost"
            onClick={handleApplyFilters}
            disabled={isLoading}
            className="rounded-xl text-xs gap-1"
          >
            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Refresh Server Data
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Period Preset */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">Time Horizon</Label>
            <Select value={period} onValueChange={(val: any) => setPeriod(val)}>
              <SelectTrigger className="rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today" className="text-xs">Today</SelectItem>
                <SelectItem value="yesterday" className="text-xs">Yesterday</SelectItem>
                <SelectItem value="this_week" className="text-xs">This Week</SelectItem>
                <SelectItem value="this_month" className="text-xs">This Month (Current Cycle)</SelectItem>
                <SelectItem value="last_month" className="text-xs">Last Month</SelectItem>
                <SelectItem value="last_90_days" className="text-xs">Last 90 Days</SelectItem>
                <SelectItem value="all" className="text-xs">All Time</SelectItem>
                <SelectItem value="custom" className="text-xs">Custom Date Range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">Department</Label>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Departments</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Credit Type */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">Transaction Type</Label>
            <Select value={creditTypeFilter} onValueChange={setCreditTypeFilter}>
              <SelectTrigger className="rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL" className="text-xs">All Types</SelectItem>
                <SelectItem value="STRUCTURED_SELF_COMPLETION" className="text-xs">Scheduled Class Completion</SelectItem>
                <SelectItem value="UNSTRUCTURED_APPROVAL" className="text-xs">Task / Initiative Approval</SelectItem>
                <SelectItem value="MANUAL_ADJUSTMENT" className="text-xs">Manual Adjustment</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Search Query */}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold text-muted-foreground">Search Records</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Faculty name, email, task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 rounded-xl text-xs"
              />
            </div>
          </div>
        </div>

        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/40">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-semibold">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>
        )}
      </Card>

      {/* 3. TRANSACTIONS TABLE */}
      <Card className="rounded-2xl border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent bg-muted/30">
              <TableHead className="text-xs font-bold">Transaction ID</TableHead>
              <TableHead className="text-xs font-bold">Timestamp</TableHead>
              <TableHead className="text-xs font-bold">Faculty Member</TableHead>
              <TableHead className="text-xs font-bold">Department</TableHead>
              <TableHead className="text-xs font-bold">Type</TableHead>
              <TableHead className="text-xs font-bold">Amount</TableHead>
              <TableHead className="text-xs font-bold">Reason / Task Source</TableHead>
              <TableHead className="text-xs font-bold text-right">Signer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-xs">
                  <ScrollText className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  No transactions found matching the applied filter criteria.
                </TableCell>
              </TableRow>
            ) : (
              filteredList.map((tx) => (
                <TableRow key={tx.id} className="hover:bg-muted/20 transition-colors">
                  <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                    <button
                      onClick={() => handleCopy(tx.id)}
                      className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      title="Click to copy Transaction ID"
                    >
                      {copiedId === tx.id ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground/60" />
                      )}
                      <span>{tx.id.slice(0, 8)}...</span>
                    </button>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(tx.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </TableCell>

                  <TableCell className="text-xs">
                    <strong className="text-foreground block">{tx.facultyName}</strong>
                    <span className="text-[10px] text-muted-foreground">{tx.facultyEmail}</span>
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {tx.departmentName}
                  </TableCell>

                  <TableCell className="text-xs whitespace-nowrap">
                    {tx.creditType === "STRUCTURED_SELF_COMPLETION" ? (
                      <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-[9px] font-semibold">
                        Scheduled Class
                      </Badge>
                    ) : tx.creditType === "UNSTRUCTURED_APPROVAL" ? (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[9px] font-semibold">
                        Task Reward
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[9px]">
                        {tx.creditType}
                      </Badge>
                    )}
                  </TableCell>

                  <TableCell className="text-xs font-extrabold text-emerald-400 whitespace-nowrap">
                    +{tx.amount.toFixed(2)} WORK
                  </TableCell>

                  <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                    {tx.reason}
                  </TableCell>

                  <TableCell className="text-xs text-right text-muted-foreground whitespace-nowrap">
                    {tx.approverName || "System"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
