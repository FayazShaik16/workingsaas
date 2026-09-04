"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck2,
  FileText,
  HelpCircle,
  Link2,
  Loader2,
  Send,
  ShieldAlert,
  Sparkles,
} from "lucide-react"

export default function MemberTaskDetailPage() {
  const params = useParams()
  const router = useRouter()
  const orgId = params.orgId as string
  const taskId = params.taskId as string
  const supabase = createClient()

  const [task, setTask] = useState<any>(null)
  const [proofs, setProofs] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form fields
  const [proofDescription, setProofDescription] = useState("")
  const [proofFileUrl, setProofFileUrl] = useState("")

  const loadTask = async () => {
    try {
      setLoading(true)
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error("Not authenticated")

      const { data: taskData, error: taskErr } = await supabase
        .from("tasks")
        .select(`
          id,
          title,
          description,
          credit_value,
          category,
          priority,
          status,
          deadline,
          created_at,
          lead_signed_at,
          org_unit_id,
          assigned_to_id,
          org_units (id, name),
          creator_user:creator_id (id, name, email)
        `)
        .eq("id", taskId)
        .eq("organization_id", orgId)
        .single()

      if (taskErr || !taskData) throw new Error("Task not found")
      setTask(taskData)

      // Fetch proofs
      const { data: proofData } = await supabase
        .from("task_proofs")
        .select("id, description, file_url, storage_provider, submitted_at")
        .eq("task_id", taskId)
        .order("submitted_at", { ascending: false })

      setProofs(proofData || [])

      // Fetch reviews
      const { data: reviewData } = await supabase
        .from("task_peer_reviews")
        .select("id, decision, comment, reviewed_at, reviewer:reviewer_id(name)")
        .eq("task_id", taskId)
        .order("reviewed_at", { ascending: false })

      setReviews(reviewData || [])
    } catch (err: any) {
      setError(err?.message || "Failed to load task details")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orgId && taskId) {
      loadTask()
    }
  }, [orgId, taskId])

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!proofDescription.trim() && !proofFileUrl.trim()) {
      setError("Please describe your work or provide a deliverable file link.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/member/submit-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          description: proofDescription,
          fileUrl: proofFileUrl,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Failed to submit proof")
      }

      setSuccessMessage(data.message || "Proof submitted successfully!")
      setProofDescription("")
      setProofFileUrl("")
      await loadTask()
      router.refresh()
    } catch (err: any) {
      setError(err?.message || "Submission failed")
    } finally {
      setSubmitting(false)
    }
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "ASSIGNED":
        return <Badge className="bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20">Assigned</Badge>
      case "IN_PROGRESS":
        return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">In Progress</Badge>
      case "VERIFICATION_PENDING":
        return <Badge className="bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20">Verification Pending</Badge>
      case "LEAD_SIGNED":
      case "CLOSED":
        return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Approved & Completed</Badge>
      case "REJECTED":
        return <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">Needs Revision</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="p-8 max-w-2xl mx-auto text-center space-y-4">
        <ShieldAlert className="h-12 w-12 mx-auto text-rose-500" />
        <h2 className="text-xl font-bold">Task Not Found</h2>
        <p className="text-sm text-muted-foreground">{error || "This task does not exist or has been removed."}</p>
        <Button asChild variant="outline">
          <Link href={`/${orgId}/member/tasks`}>Return to My Tasks</Link>
        </Button>
      </div>
    )
  }

  const isCompleted = task.status === "LEAD_SIGNED" || task.status === "CLOSED"
  const isPendingReview = task.status === "VERIFICATION_PENDING"
  const canSubmit = !isCompleted && !isPendingReview

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-8">
      {/* Back button & Header */}
      <div className="flex items-center justify-between">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-xs">
          <Link href={`/${orgId}/member/tasks`}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to My Tasks
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {statusBadge(task.status)}
          <Badge variant="outline" className="text-xs uppercase">
            {task.category || "UNSTRUCTURED"}
          </Badge>
        </div>
      </div>

      {/* Main Task Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-xs border-border/60">
            <CardHeader className="space-y-2">
              <CardTitle className="text-2xl font-bold tracking-tight">{task.title}</CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Department: {task.org_units?.name || "General"} · Priority: {task.priority || "MEDIUM"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2 block">
                  Task Overview & Requirements
                </Label>
                <div className="p-4 rounded-xl bg-muted/30 border border-border/40 text-sm whitespace-pre-wrap leading-relaxed">
                  {task.description || "No specific instructions provided."}
                </div>
              </div>

              {/* Status Banner */}
              {isCompleted && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">Task Verified & Completed</p>
                    <p>
                      The Department Head has approved this deliverable. {Number(task.credit_value || 0).toFixed(1)} WORK credits have been deposited into your personal wallet.
                    </p>
                  </div>
                </div>
              )}

              {isPendingReview && (
                <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-start gap-3 text-purple-700 dark:text-purple-300">
                  <Clock className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">Under HOD Verification</p>
                    <p>
                      Your proof submission is currently in the Department Verification queue. Once signed off, credits will be minted directly to your account.
                    </p>
                  </div>
                </div>
              )}

              {/* Submission Form */}
              {canSubmit && (
                <form onSubmit={handleSubmitProof} className="space-y-4 pt-4 border-t border-border/40">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-primary" /> Submit Deliverable Proof
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Provide a brief summary of work accomplished and any relevant artifact links (GitHub, Google Drive, LMS).
                    </p>
                  </div>

                  {error && (
                    <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium">
                      {error}
                    </div>
                  )}

                  {successMessage && (
                    <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-medium">
                      {successMessage}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="proof-desc" className="text-xs font-medium">
                      Work Completion Summary / Notes
                    </Label>
                    <Textarea
                      id="proof-desc"
                      placeholder="Detail the deliverable components completed, outcomes, or notes for the HOD..."
                      value={proofDescription}
                      onChange={(e) => setProofDescription(e.target.value)}
                      rows={4}
                      className="text-xs"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="proof-url" className="text-xs font-medium">
                      Deliverable File / URL (Optional)
                    </Label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="proof-url"
                        placeholder="https://drive.google.com/... or https://github.com/..."
                        value={proofFileUrl}
                        onChange={(e) => setProofFileUrl(e.target.value)}
                        className="pl-9 text-xs"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={submitting} className="w-full gap-2 text-xs">
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Submit For Lead Verification
                  </Button>
                </form>
              )}

              {/* Past Proofs History */}
              {proofs.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border/40">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Submitted Proofs
                  </h4>
                  <div className="space-y-2">
                    {proofs.map((p) => (
                      <div key={p.id} className="p-3 rounded-lg bg-muted/20 border border-border/40 text-xs space-y-1.5">
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="flex items-center gap-1.5 font-medium text-foreground">
                            <FileText className="h-3.5 w-3.5 text-primary" /> Deliverable Submission
                          </span>
                          <span>{new Date(p.submitted_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                        </div>
                        {p.description && <p className="text-muted-foreground">{p.description}</p>}
                        {p.file_url && (
                          <a
                            href={p.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline font-medium pt-1"
                          >
                            <Link2 className="h-3 w-3" /> View Submitted Artifact
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviewer Feedback History */}
              {reviews.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border/40">
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                    Review History & Feedback
                  </h4>
                  <div className="space-y-2">
                    {reviews.map((r) => (
                      <div
                        key={r.id}
                        className={`p-3 rounded-lg border text-xs space-y-1 ${
                          r.decision === "APPROVE"
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-rose-500/5 border-rose-500/20"
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className={r.decision === "APPROVE" ? "text-emerald-600" : "text-rose-600"}>
                            {r.decision === "APPROVE" ? "Approved by Lead" : "Returned for Revision"}
                          </span>
                          <span className="text-muted-foreground font-normal">
                            {new Date(r.reviewed_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                          </span>
                        </div>
                        {r.comment && <p className="text-muted-foreground pt-0.5">{r.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <Card className="shadow-xs border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Coins className="h-3.5 w-3.5 text-primary" /> Credit Value
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-primary">
                  {Number(task.credit_value || 0).toFixed(1)}
                </span>
                <span className="text-xs font-medium text-muted-foreground">WORK Credits</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Credits contribute towards your monthly target threshold and release eligibility upon sign-off.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-xs border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" /> Timeline & Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="flex justify-between border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Deadline</span>
                <span className="font-medium text-foreground">
                  {task.deadline ? new Date(task.deadline).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "Flexible"}
                </span>
              </div>
              <div className="flex justify-between border-b border-border/30 pb-2">
                <span className="text-muted-foreground">Created</span>
                <span className="font-medium text-foreground">
                  {new Date(task.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                </span>
              </div>
              {task.lead_signed_at && (
                <div className="flex justify-between border-b border-border/30 pb-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Approved At</span>
                  <span>{new Date(task.lead_signed_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
