"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Coins, IndianRupee, DollarSign, ShieldCheck, Sparkles, Loader2, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export interface FacultySalaryDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (updated: any) => void
  faculty: {
    id: string
    name: string
    email: string
    designation?: string
    departmentName?: string
    currentBaseSalary?: number
    currentCurrency?: string
    currentTargetCredits?: number
    currentThresholdPercentage?: number
  } | null
}

export function FacultySalaryDialog({
  isOpen,
  onClose,
  onSuccess,
  faculty,
}: FacultySalaryDialogProps) {
  const router = useRouter()

  const [baseSalary, setBaseSalary] = useState("75000")
  const [currency, setCurrency] = useState("INR")
  const [targetCredits, setTargetCredits] = useState("20.0")
  const [thresholdPercentage, setThresholdPercentage] = useState("85")
  const [notes, setNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (faculty) {
      setBaseSalary(String(faculty.currentBaseSalary || 75000))
      setCurrency(faculty.currentCurrency || "INR")
      setTargetCredits(String(faculty.currentTargetCredits || 20.0))
      setThresholdPercentage(String(faculty.currentThresholdPercentage || 85))
      setNotes("")
      setError(null)
    }
  }, [faculty])

  if (!faculty) return null

  const numSalary = Number(baseSalary) || 0
  const numTarget = Number(targetCredits) || 20.0
  const numThreshold = Number(thresholdPercentage) || 85.0
  const thresholdCredits = Math.round(((numTarget * numThreshold) / 100) * 10) / 10

  const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
  }
  const currSym = currencySymbols[currency] || currency

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!faculty) return
    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/compensation/set-salary-component", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: faculty.id,
          baseSalary: numSalary,
          currency,
          targetCredits: numTarget,
          thresholdPercentage: numThreshold,
          notes,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to update salary component.")
      }

      toast.success(
        `Salary component set for ${faculty.name}: ${currSym}${numSalary.toLocaleString()} with ${numTarget} WORK target!`
      )
      if (onSuccess) onSuccess(data.salaryComponent)
      router.refresh()
      onClose()
    } catch (err: any) {
      setError(err.message || "Failed to configure salary component.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Coins className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Faculty Salary Component
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Configure base salary and monthly WORK token performance targets.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Member Card Context */}
          <div className="p-3 my-3 rounded-xl bg-muted/40 border flex items-center justify-between gap-3 text-xs">
            <div>
              <p className="font-bold text-foreground text-sm">{faculty.name}</p>
              <p className="text-muted-foreground font-mono text-[11px]">{faculty.email}</p>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                {faculty.designation || "Faculty Member"} {faculty.departmentName ? `· ${faculty.departmentName}` : ""}
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              Institutional Member
            </Badge>
          </div>

          {error && (
            <div className="p-3 mb-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-4 py-2 text-xs">
            {/* Base Salary & Currency */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="baseSalary" className="text-xs font-semibold text-foreground">
                  Monthly Base Salary *
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-muted-foreground font-bold font-mono text-xs">
                    {currSym}
                  </span>
                  <Input
                    id="baseSalary"
                    type="number"
                    min="0"
                    step="100"
                    required
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    className="pl-7 font-mono text-xs h-9"
                    placeholder="75000"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="currency" className="text-xs font-semibold text-foreground">
                  Currency
                </Label>
                <Select value={currency} onValueChange={setCurrency}>
                  <SelectTrigger id="currency" className="text-xs h-9 font-mono">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INR">INR (₹)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                    <SelectItem value="GBP">GBP (£)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Target Credits & Authorization Threshold */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="targetCredits" className="text-xs font-semibold text-foreground">
                  Monthly Token Target *
                </Label>
                <div className="relative">
                  <Input
                    id="targetCredits"
                    type="number"
                    min="1"
                    step="0.5"
                    required
                    value={targetCredits}
                    onChange={(e) => setTargetCredits(e.target.value)}
                    className="font-mono text-xs h-9 pr-14"
                    placeholder="20.0"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-muted-foreground font-mono">
                    WORK
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Tokens required for 100% monthly target</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="thresholdPercentage" className="text-xs font-semibold text-foreground">
                  Safety Threshold (%)
                </Label>
                <div className="relative">
                  <Input
                    id="thresholdPercentage"
                    type="number"
                    min="1"
                    max="100"
                    step="1"
                    required
                    value={thresholdPercentage}
                    onChange={(e) => setThresholdPercentage(e.target.value)}
                    className="font-mono text-xs h-9 pr-8"
                    placeholder="85"
                  />
                  <span className="absolute right-3 top-2.5 text-[11px] text-muted-foreground font-mono">
                    %
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">Min % required for Day 26 salary payout</p>
              </div>
            </div>

            {/* Live Interactive Calculation Preview */}
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
              <div className="flex items-center gap-1.5 text-primary font-bold text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Live Settlement Projection</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-background/80 border">
                  <span className="text-muted-foreground block text-[10px]">100% Full Payout Target</span>
                  <span className="font-bold text-foreground font-mono">
                    {numTarget.toFixed(1)} WORK Credits
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background/80 border">
                  <span className="text-muted-foreground block text-[10px]">
                    {numThreshold}% Safety Clearance Mark
                  </span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {thresholdCredits.toFixed(1)} WORK Credits
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                Faculty must complete structured timetable sessions and initiatives yielding at least{" "}
                <strong className="text-foreground">{thresholdCredits.toFixed(1)} WORK tokens</strong> by Day 26 to unlock full{" "}
                <strong className="text-foreground">{currSym}{numSalary.toLocaleString()}</strong> monthly payroll clearance.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-3">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5 font-semibold">
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Save Salary Component</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
