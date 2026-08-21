"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Clock, Sparkles, Loader2, AlertCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export interface ScheduledInstanceItem {
  id: string
  title: string
  workDate: string
  startTime: string
  endTime: string
  creditValue: number
  status: string
}

interface ScheduledCompletionModalProps {
  instance: ScheduledInstanceItem | null
  isOpen: boolean
  onClose: () => void
  onSuccess?: (creditsAwarded: number) => void
}

export function ScheduledCompletionModal({
  instance,
  isOpen,
  onClose,
  onSuccess,
}: ScheduledCompletionModalProps) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [completedSuccess, setCompletedSuccess] = useState(false)

  if (!instance) return null

  const handleReset = () => {
    setStep(1)
    setErrorMsg(null)
    setIsSubmitting(false)
    setCompletedSuccess(false)
    onClose()
  }

  const handleStep1Proceed = () => {
    setStep(2)
  }

  const handleFinalConfirm = async () => {
    setIsSubmitting(true)
    setErrorMsg(null)

    try {
      const res = await fetch("/api/member/complete-scheduled", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId: instance.id }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to confirm work completion.")
      }

      setCompletedSuccess(true)
      if (onSuccess) onSuccess(instance.creditValue)

      setTimeout(() => {
        handleReset()
        router.refresh()
      }, 1200)
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="sm:max-w-md rounded-2xl border-white/10 bg-slate-950 text-slate-100 shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2 text-violet-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Sparkles size={14} />
            <span>2-Step Self Confirmation</span>
          </div>
          <DialogTitle className="text-xl font-bold text-white">
            {completedSuccess
              ? "Session Recorded!"
              : step === 1
              ? "Confirm Scheduled Work"
              : "Final Verification"}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm">
            {completedSuccess
              ? `+${instance.creditValue.toFixed(1)} WORK credits credited to your monthly ledger.`
              : step === 1
              ? `Step 1 of 2: Declaration of session completion.`
              : `Step 2 of 2: Confirm ledger write and progress update.`}
          </DialogDescription>
        </DialogHeader>

        {completedSuccess ? (
          <div className="py-6 text-center space-y-3">
            <div className="h-16 w-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto ring-4 ring-emerald-500/30 animate-pulse">
              <CheckCircle2 size={32} />
            </div>
            <p className="text-sm font-medium text-emerald-300">
              Work session recorded · +{instance.creditValue.toFixed(1)} Credits
            </p>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {/* Session Card Info */}
            <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">{instance.workDate}</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30">
                  +{instance.creditValue.toFixed(1)} Credits
                </span>
              </div>
              <h4 className="text-base font-semibold text-white">{instance.title}</h4>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <Clock size={13} />
                <span>
                  {instance.startTime} – {instance.endTime}
                </span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {step === 1 ? (
              <p className="text-sm text-slate-300">
                Have you completed <strong className="text-white">"{instance.title}"</strong> scheduled for{" "}
                <span className="font-mono text-violet-300">{instance.workDate} ({instance.startTime})</span>?
              </p>
            ) : (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-1">
                <p className="font-semibold">Important Confirmation:</p>
                <p className="text-amber-200/90">
                  This will record an immutable entry in your monthly work ledger and update your progress towards the 85% salary threshold. Confirm completion?
                </p>
              </div>
            )}
          </div>
        )}

        {!completedSuccess && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSubmitting}
              className="border-white/10 text-slate-300 hover:bg-white/10"
            >
              Cancel
            </Button>

            {step === 1 ? (
              <Button
                type="button"
                onClick={handleStep1Proceed}
                className="bg-violet-600 hover:bg-violet-500 text-white font-medium shadow-lg shadow-violet-600/30"
              >
                Yes, Completed
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleFinalConfirm}
                disabled={isSubmitting}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-lg shadow-emerald-600/30 gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Confirm & Update Progress
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
