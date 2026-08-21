"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertTriangle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  Database,
} from "lucide-react"
import { useRouter } from "next/navigation"

interface DataResetManagerProps {
  orgId: string
  currentUserEmail: string
}

export function DataResetManager({ orgId, currentUserEmail }: DataResetManagerProps) {
  const router = useRouter()
  const [isLoadingCounts, setIsLoadingCounts] = useState(true)
  const [countsData, setCountsData] = useState<any | null>(null)
  const [inputPhrase, setInputPhrase] = useState("")
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [resetResult, setResetResult] = useState<any | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const fetchPreviewCounts = async () => {
    setIsLoadingCounts(true)
    try {
      const res = await fetch("/api/admin/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "PREVIEW" }),
      })
      const data = await res.json()
      setCountsData(data)
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load table counts.")
    } finally {
      setIsLoadingCounts(false)
    }
  }

  useEffect(() => {
    fetchPreviewCounts()
  }, [])

  const handleExecuteReset = async () => {
    setIsResetting(true)
    setErrorMessage(null)

    try {
      const res = await fetch("/api/admin/reset-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "EXECUTE",
          confirmationPhrase: inputPhrase.trim(),
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Reset failed.")

      setResetResult(data)
      setIsConfirmModalOpen(false)
      fetchPreviewCounts()
    } catch (err: any) {
      setErrorMessage(err.message || "Reset execution failed.")
    } finally {
      setIsResetting(false)
    }
  }

  const isPhraseCorrect = inputPhrase.trim() === "RESET WORKLEDGER DEMO DATA"

  return (
    <div className="space-y-6">
      {/* Warning Box */}
      <Card className="rounded-2xl border-rose-500/30 bg-rose-950/20 p-6 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0 mt-0.5">
            <ShieldAlert size={22} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">System Data Reset & Cleanup</h3>
            <p className="text-xs text-rose-300/90 mt-1 leading-relaxed">
              This destructive operation purges all legacy test records, mock student/faculty profiles, and demo organizations from Supabase.
              Your currently authenticated administrator account (<strong className="text-white">{currentUserEmail}</strong>) will be retained.
            </p>
          </div>
        </div>
      </Card>

      {/* Table Counts Preview */}
      <Card className="rounded-2xl border-white/[0.08] bg-slate-900/40 overflow-hidden">
        <CardHeader className="pb-3 border-b border-white/[0.06] flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Database size={16} className="text-violet-400" />
              Live Database Entities Count
            </CardTitle>
            <CardDescription className="text-xs text-slate-400 mt-0.5">
              Live row counts across all database tables before reset.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchPreviewCounts}
            disabled={isLoadingCounts}
            className="border-white/10 text-slate-200 text-xs rounded-xl gap-1.5"
          >
            <RefreshCw size={13} className={isLoadingCounts ? "animate-spin" : ""} />
            <span>Refresh Counts</span>
          </Button>
        </CardHeader>

        <CardContent className="p-5">
          {isLoadingCounts ? (
            <div className="py-8 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
              <Loader2 size={16} className="animate-spin text-violet-400" />
              <span>Fetching database counts...</span>
            </div>
          ) : countsData?.tableCounts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-violet-950/30 border border-violet-500/20">
                <span className="text-[11px] font-mono text-violet-400 block">Auth Accounts</span>
                <span className="text-xl font-bold font-mono text-white mt-0.5 block">
                  {countsData.authUsersCount}
                </span>
              </div>

              {Object.entries(countsData.tableCounts).map(([tbl, count]: any) => (
                <div key={tbl} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                  <span className="text-[11px] font-mono text-slate-400 block truncate">{tbl}</span>
                  <span className="text-xl font-bold font-mono text-white mt-0.5 block">{count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400">Failed to load preview counts.</p>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Input Box */}
      <Card className="rounded-2xl border-white/[0.08] bg-slate-900/40 p-6 space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-slate-300">
            To proceed, type <span className="font-mono text-rose-400 font-bold">RESET WORKLEDGER DEMO DATA</span> below:
          </Label>
          <Input
            value={inputPhrase}
            onChange={(e) => setInputPhrase(e.target.value)}
            placeholder="RESET WORKLEDGER DEMO DATA"
            className="bg-slate-950 border-white/10 font-mono text-xs text-white"
          />
        </div>

        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-end">
          <Button
            type="button"
            onClick={() => setIsConfirmModalOpen(true)}
            disabled={!isPhraseCorrect || isResetting}
            className="bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs rounded-xl shadow-lg shadow-rose-600/20 gap-1.5"
          >
            <Trash2 size={14} />
            <span>Review & Execute Reset</span>
          </Button>
        </div>
      </Card>

      {/* Result Banner */}
      {resetResult && (
        <Card className="rounded-2xl border-emerald-500/30 bg-emerald-950/20 p-6 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Database Reset Complete</h4>
              <p className="text-xs text-emerald-300/90">{resetResult.message}</p>
            </div>
          </div>
        </Card>
      )}

      {/* 2nd Explicit Confirmation Modal */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border-rose-500/30 bg-slate-950 text-slate-100 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-400 font-mono text-xs uppercase tracking-wider mb-1">
              <AlertTriangle size={14} />
              <span>Final Confirmation</span>
            </div>
            <DialogTitle className="text-lg font-bold text-white">
              Execute Destructive Data Reset?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              All demo tenant data will be permanently removed. This action cannot be reversed.
            </DialogDescription>
          </DialogHeader>

          <div className="py-3 text-xs text-slate-300 space-y-2">
            <p>You are about to purge:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-400 font-mono text-[11px]">
              <li>All mock faculty and demo user profiles</li>
              <li>All demo wallets, test tasks, and attendance slots</li>
              <li>All historical academic prototype entities</li>
            </ul>
            <p className="text-emerald-400 font-medium pt-1">
              Your administrator account ({currentUserEmail}) will remain active.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isResetting}
              className="border-white/10 text-slate-300"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleExecuteReset}
              disabled={isResetting}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium gap-1.5"
            >
              {isResetting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Purging Database...
                </>
              ) : (
                <>
                  <Trash2 size={14} />
                  Yes, Execute Reset Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
