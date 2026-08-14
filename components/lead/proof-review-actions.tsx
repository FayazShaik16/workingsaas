"use client"

import { useState, FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"

export default function ProofReviewActions({
  taskId,
  taskTitle,
  userId,
  creditValue,
}: {
  taskId: string
  taskTitle: string
  userId: string
  creditValue: number
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [comment, setComment] = useState("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  const handleApprove = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/lead/approve-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          approverUserId: userId,
          comment,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to approve")
      }

      router.push("/lead")
      router.refresh()
    } catch (error) {
      console.error("Approval error:", error)
      alert(error instanceof Error ? error.message : "Failed to approve task")
    } finally {
      setLoading(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/lead/reject-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          rejectionReason,
        }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Failed to reject")
      }

      router.push("/lead")
      router.refresh()
    } catch (error) {
      console.error("Rejection error:", error)
      alert(error instanceof Error ? error.message : "Failed to reject task")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lead Review & Decision</CardTitle>
        <CardDescription>Approve or reject this task completion submission</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="comment" className="mb-2">
            Review Comment (Optional)
          </Label>
          <Textarea
            id="comment"
            placeholder="Add feedback for the team member..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="flex gap-2 pt-4">
          <ConfirmActionDialog
            title="Approve Task"
            description={`Approve "${taskTitle}" and award ${creditValue} credits?`}
            action="Approve"
            variant="default"
            onConfirm={handleApprove}
            loading={loading}
            disabled={loading}
          >
            <Button
              size="lg"
              className="flex-1"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve & Award Credits
            </Button>
          </ConfirmActionDialog>

          <ConfirmActionDialog
            title="Reject Task"
            description={`Reject "${taskTitle}" and return to assigned user?`}
            action="Reject"
            variant="destructive"
            onConfirm={handleReject}
            loading={loading}
            disabled={!rejectionReason.trim() || loading}
          >
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Submission
            </Button>
          </ConfirmActionDialog>
        </div>

        {showRejectDialog && (
          <div className="mt-4 p-3 border rounded-lg bg-destructive/10">
            <Label htmlFor="rejection-reason" className="mb-2">
              Reason for Rejection
            </Label>
            <Textarea
              id="rejection-reason"
              placeholder="Explain why the submission was rejected..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              disabled={loading}
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
