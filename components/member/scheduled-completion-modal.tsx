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
import { Badge } from "@/components/ui/badge"
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
      }, 1000)
    } catch (err: any) {
      setErrorMsg(err.message || "An unexpected error occurred.")
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleReset()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-1.5 text-primary font-mono text-xs uppercase tracking-wider mb-1">
            <Sparkles className="h-3.5 w-3.5" />
            <span>2-Step Self Confirmation</span>
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            {completedSuccess
              ? "Session Recorded!"
              : step === 1
              ? "Confirm Scheduled Work"
              : "Final Credit Confirmation"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {completedSuccess
              ? "Your work completion has been logged to the immutable ledger."
              : step === 1
              ? "Please verify that this scheduled session was conducted as planned."
              : "This action will update your monthly progress ledger. Confirm to apply credits."}
          </DialogDescription>
        </DialogHeader>

        {completedSuccess ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-1">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <p className="font-semibold text-foreground text-sm">
              +{instance.creditValue.toFixed(1)} Credits Awarded
            </p>
            <p className="text-xs text-muted-foreground font-mono">
              Ledger entry created successfully.
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* Session Card Info */}
            <div className="p-4 rounded-lg border bg-muted/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-foreground">{instance.title}</span>
                <Badge variant="outline" className="font-mono text-xs">
                  +{instance.creditValue.toFixed(1)} cr
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{instance.startTime} – {instance.endTime}</span>
                </div>
                <span>·</span>
                <span>Date: {instance.workDate}</span>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {step === 1 && (
              <div className="p-3 rounded-lg border bg-primary/5 text-xs text-foreground space-y-1">
                <p className="font-medium">Self-Declaration Statement:</p>
                <p className="text-muted-foreground">
                  "I confirm that I conducted this scheduled teaching/work session on trust according to the allocated timetable."
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 text-xs text-foreground space-y-1">
                <p className="font-medium text-amber-700 dark:text-amber-300">Important:</p>
                <p className="text-muted-foreground">
                  Credits will be immediately added to your monthly work ledger. This action cannot be duplicated.
                </p>
              </div>
            )}
          </div>
        )}

        {!completedSuccess && (
          <DialogFooter className="gap-2 sm:gap-0">
            {step === 1 ? (
              <>
                <Button type="button" variant="outline" onClick={handleReset} size="sm" className="text-xs">
                  Cancel
                </Button>
                <Button type="button" onClick={handleStep1Proceed} size="sm" className="text-xs">
                  Yes, I completed this session
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleFinalConfirm}
                  disabled={isSubmitting}
                  size="sm"
                  className="text-xs gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm & Apply Credits</span>
                    </>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
