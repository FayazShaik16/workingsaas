"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Coins,
  Building2,
  TrendingUp,
  Wallet,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Sparkles,
  ArrowUpRight,
  Edit3,
  PiggyBank,
} from "lucide-react"
import { useRouter } from "next/navigation"

export interface DepartmentBudgetInfo {
  id: string
  name: string
  unitType: string
  leadName?: string
  allocatedBudget: number
  spentBudget: number
  budgetCurrency: string
  budgetPeriod: string
  budgetNotes?: string
  lastUpdated?: string
}

interface DirectorBudgetAllocatorProps {
  orgId: string
  departments: DepartmentBudgetInfo[]
  salaryPoolBalance: number
}

export function DirectorBudgetAllocator({
  orgId,
  departments: initialDepartments,
  salaryPoolBalance,
}: DirectorBudgetAllocatorProps) {
  const router = useRouter()

  const [departments, setDepartments] = useState<DepartmentBudgetInfo[]>(initialDepartments)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDept, setSelectedDept] = useState<DepartmentBudgetInfo | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [budgetAmount, setBudgetAmount] = useState("")
  const [budgetCurrency, setBudgetCurrency] = useState("WORK")
  const [budgetPeriod, setBudgetPeriod] = useState("MONTHLY")
  const [budgetNotes, setBudgetNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null)

  // Overall calculations
  const totalAllocated = departments.reduce((acc, d) => acc + (d.allocatedBudget || 0), 0)
  const totalSpent = departments.reduce((acc, d) => acc + (d.spentBudget || 0), 0)
  const totalRemaining = Math.max(0, totalAllocated - totalSpent)
  const unallocatedReserve = Math.max(0, salaryPoolBalance - totalAllocated)

  const filteredDepts = departments.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.leadName && d.leadName.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleOpenAllocateModal = (dept: DepartmentBudgetInfo) => {
    setSelectedDept(dept)
    setBudgetAmount(dept.allocatedBudget ? String(dept.allocatedBudget) : "5000")
    setBudgetCurrency(dept.budgetCurrency || "WORK")
    setBudgetPeriod(dept.budgetPeriod || "MONTHLY")
    setBudgetNotes(dept.budgetNotes || "")
    setFeedback(null)
    setIsModalOpen(true)
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDept) return

    const amount = Number(budgetAmount)
    if (isNaN(amount) || amount < 0) {
      setFeedback({ type: "error", text: "Please enter a valid non-negative budget amount." })
      return
    }

    setIsSubmitting(true)
    setFeedback(null)

    try {
      const response = await fetch("/api/director/allocate-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgUnitId: selectedDept.id,
          allocatedBudget: amount,
          budgetCurrency,
          budgetPeriod,
          budgetNotes,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Failed to allocate budget.")
      }

      setDepartments((prev) =>
        prev.map((d) =>
          d.id === selectedDept.id
            ? {
                ...d,
                allocatedBudget: amount,
                budgetCurrency,
                budgetPeriod,
                budgetNotes,
                lastUpdated: new Date().toISOString(),
              }
            : d
        )
      )

      setFeedback({
        type: "success",
        text: `Successfully updated budget for ${selectedDept.name} to ${amount} ${budgetCurrency}.`,
      })

      setTimeout(() => {
        setIsModalOpen(false)
      }, 1200)

      router.refresh()
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err.message || "Failed to allocate budget.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top High-Level Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Pool Balance
            </CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {salaryPoolBalance.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">WORK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Available treasury pool</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Allocated
            </CardTitle>
            <PiggyBank className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {totalAllocated.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">WORK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Committed to {departments.length} departments</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Spent / Released
            </CardTitle>
            <Coins className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {totalSpent.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">WORK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totalAllocated > 0 ? Math.round((totalSpent / totalAllocated) * 100) : 0}% utilization rate
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Remaining Reserve
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-sky-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-sky-600 dark:text-sky-400">
              {totalRemaining.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">WORK</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Available across departments</p>
          </CardContent>
        </Card>
      </div>

      {/* Department Allocation Grid */}
      <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
        <CardHeader className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-xl font-light text-foreground flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Departmental Budget Allocation & Management
            </CardTitle>
            <CardDescription className="font-light mt-1">
              Allocate monthly and operational credit budgets to academic and administrative departments. HODs can track this in real-time.
            </CardDescription>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 rounded-xl bg-background/80 text-xs"
            />
          </div>
        </CardHeader>

        <CardContent>
          {filteredDepts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground font-light">
              No departments found matching &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredDepts.map((dept) => {
                const utilPercent = dept.allocatedBudget > 0 ? Math.round((dept.spentBudget / dept.allocatedBudget) * 100) : 0
                const remaining = Math.max(0, dept.allocatedBudget - dept.spentBudget)

                let statusBadge: { label: string; variant: "default" | "secondary" | "destructive" | "outline"; color: string } = {
                  label: "Funded",
                  variant: "default",
                  color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
                }
                if (!dept.allocatedBudget || dept.allocatedBudget === 0) {
                  statusBadge = { label: "Unallocated", variant: "outline", color: "bg-muted text-muted-foreground border-muted-foreground/30" }
                } else if (utilPercent >= 100) {
                  statusBadge = { label: "Exceeded", variant: "destructive", color: "bg-destructive/10 text-destructive border-destructive/30" }
                } else if (utilPercent >= 80) {
                  statusBadge = { label: "Near Limit", variant: "secondary", color: "bg-amber-500/10 text-amber-600 border-amber-500/30" }
                }

                return (
                  <div
                    key={dept.id}
                    className="p-5 rounded-2xl border border-muted/80 bg-background/60 shadow-2xs flex flex-col justify-between gap-4 hover:border-primary/40 transition-all group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge variant="outline" className="text-[10px] font-normal uppercase tracking-wider">
                          {dept.unitType || "Department"}
                        </Badge>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusBadge.color}`}>
                          {statusBadge.label}
                        </span>
                      </div>

                      <h3 className="text-base font-medium text-foreground/90 group-hover:text-primary transition-colors">
                        {dept.name}
                      </h3>
                      {dept.leadName && (
                        <p className="text-xs text-muted-foreground font-light mt-0.5">
                          HOD: <span className="font-normal text-foreground/80">{dept.leadName}</span>
                        </p>
                      )}

                      {/* Budget Numbers Card */}
                      <div className="mt-4 p-3 rounded-xl bg-secondary/30 border border-secondary/60 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-light">Allocated Budget:</span>
                          <span className="font-semibold text-foreground">
                            {dept.allocatedBudget.toLocaleString()} {dept.budgetCurrency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-light">Utilized / Spent:</span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {dept.spentBudget.toLocaleString()} {dept.budgetCurrency}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                          <span className="text-muted-foreground font-light">Remaining:</span>
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {remaining.toLocaleString()} {dept.budgetCurrency}
                          </span>
                        </div>

                        {/* Progress bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex justify-between text-[10px] text-muted-foreground">
                            <span>Utilization</span>
                            <span className="font-mono">{utilPercent}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full transition-all rounded-full ${
                                utilPercent >= 100
                                  ? "bg-destructive"
                                  : utilPercent >= 80
                                  ? "bg-amber-500"
                                  : "bg-emerald-500"
                              }`}
                              style={{ width: `${Math.min(100, utilPercent)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {dept.budgetNotes && (
                        <p className="text-[11px] text-muted-foreground font-light mt-2 italic line-clamp-1">
                          &ldquo;{dept.budgetNotes}&rdquo;
                        </p>
                      )}
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleOpenAllocateModal(dept)}
                      variant="outline"
                      className="w-full rounded-xl text-xs flex items-center justify-center gap-1.5 border-primary/30 hover:bg-primary/5 hover:text-primary"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {dept.allocatedBudget > 0 ? "Edit Budget Allocation" : "Allocate Initial Budget"}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Allocate Budget Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-light flex items-center gap-2">
              <Coins className="h-5 w-5 text-primary" />
              Allocate Budget: {selectedDept?.name}
            </DialogTitle>
            <DialogDescription className="font-light text-xs">
              Set the token & credit budget limit for this department. HOD will be able to authorize rewards and salaries within this pool.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="space-y-4 py-2">
            {feedback && (
              <div
                className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/30"
                    : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}
              >
                {feedback.type === "success" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="budgetAmount" className="text-xs font-normal">
                Budget Allocation Amount
              </Label>
              <div className="relative">
                <Input
                  id="budgetAmount"
                  type="number"
                  min="0"
                  step="100"
                  required
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  placeholder="e.g. 10000"
                  className="rounded-xl text-sm font-semibold pl-3 pr-16"
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-mono">
                  {budgetCurrency}
                </span>
              </div>

              {/* Quick suggestions */}
              <div className="flex gap-1.5 pt-1">
                {[1000, 5000, 10000, 25000, 50000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setBudgetAmount(String(amt))}
                    className="px-2 py-0.5 rounded-lg bg-secondary/60 hover:bg-secondary text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors"
                  >
                    +{amt >= 1000 ? `${amt / 1000}k` : amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="budgetCurrency" className="text-xs font-normal">
                  Currency / Unit
                </Label>
                <Select value={budgetCurrency} onValueChange={setBudgetCurrency}>
                  <SelectTrigger id="budgetCurrency" className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="WORK">WORK Tokens</SelectItem>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="CREDITS">Credits / Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="budgetPeriod" className="text-xs font-normal">
                  Budget Frequency
                </Label>
                <Select value={budgetPeriod} onValueChange={setBudgetPeriod}>
                  <SelectTrigger id="budgetPeriod" className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MONTHLY">Monthly</SelectItem>
                    <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                    <SelectItem value="SEMESTER">Per Semester</SelectItem>
                    <SelectItem value="ANNUAL">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="budgetNotes" className="text-xs font-normal">
                Allocation Notes / Directive (Optional)
              </Label>
              <Input
                id="budgetNotes"
                type="text"
                value={budgetNotes}
                onChange={(e) => setBudgetNotes(e.target.value)}
                placeholder="e.g. Q3 NAAC audit & lab upgrades allocation"
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-3 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="rounded-xl text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl text-xs shadow-xs min-w-28"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Budget"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
