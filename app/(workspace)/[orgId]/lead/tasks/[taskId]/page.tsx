import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeft,
  Calendar,
  Clock,
  Coins,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Tag,
  FileText,
  ExternalLink,
  Sparkles,
  ShieldCheck,
  CheckSquare,
} from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string; taskId: string }>
}

export default async function LeadTaskDetailPage({ params }: PageProps) {
  const { orgId, taskId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch task details
  const { data: task, error } = await db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      penalty_value,
      category,
      priority,
      status,
      deadline,
      created_at,
      completed_at,
      custom_fields,
      assigned_to_id,
      creator_id,
      org_unit_id,
      assigned_user:assigned_to_id (id, name, email, designation),
      creator_user:creator_id (id, name, email),
      org_units (id, name),
      task_proofs (id, proof_text, proof_url, created_at)
    `)
    .eq("id", taskId)
    .eq("organization_id", orgId)
    .single()

  if (error || !task) {
    notFound()
  }

  const assignedFaculty = task.assigned_user
  const creator = task.creator_user
  const proof = Array.isArray(task.task_proofs) && task.task_proofs.length > 0 ? task.task_proofs[0] : null
  const tags = (task.custom_fields as any)?.tags || (task.custom_fields as any)?.skillTags || []
  const validationMode = (task.custom_fields as any)?.validationMode || "FILE_PROOF"

  const renderPriorityBadge = (priorityVal?: string) => {
    const p = (priorityVal || "MEDIUM").toUpperCase()
    switch (p) {
      case "URGENT":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/10 text-destructive border border-destructive/30 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />
            🔴 Urgent Priority
          </span>
        )
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            🟠 High Priority
          </span>
        )
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-normal bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            🟢 Low Priority
          </span>
        )
      case "MEDIUM":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-normal bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            <span className="h-2 w-2 rounded-full bg-sky-500" />
            🔵 Medium Priority
          </span>
        )
    }
  }

  const isCompleted = ["LEAD_SIGNED", "APPROVED", "CLOSED", "VERIFIED"].includes(task.status)
  const isAwaitingReview = ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"].includes(task.status)

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Navigation & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <Button asChild variant="ghost" size="xs" className="h-7 px-2 text-xs text-muted-foreground mb-1">
            <Link href={`/${orgId}/lead/tasks`}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Task Hub
            </Link>
          </Button>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            {task.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            Task ID: <span className="font-mono">{task.id}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {renderPriorityBadge(task.priority)}
          <Badge variant={isCompleted ? "default" : "secondary"} className="text-xs py-1 px-3">
            {task.status}
          </Badge>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Details & Deliverables */}
        <div className="lg:col-span-2 space-y-6">
          {/* Overview Card */}
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Task Overview & Description
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                {task.description || "No extended description provided for this task."}
              </p>

              {tags && tags.length > 0 && (
                <div className="pt-2 border-t border-border/40">
                  <span className="text-xs text-muted-foreground block mb-1.5">Skill Tags / Classification:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs font-normal">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deliverables & Proof Submissions */}
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-500" /> Verification & Deliverables
              </CardTitle>
              <CardDescription className="text-xs">
                Verification Method: <span className="font-medium text-foreground">{validationMode}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {proof ? (
                <div className="space-y-3 p-4 rounded-xl bg-secondary/30 border border-secondary">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Submission Remarks</span>
                    <span className="text-muted-foreground">
                      {new Date(proof.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {proof.proof_text || "No written remarks provided."}
                  </p>

                  {proof.proof_url && (
                    <div className="pt-2">
                      <Button asChild size="sm" variant="outline" className="rounded-xl text-xs gap-1.5">
                        <a href={proof.proof_url} target="_blank" rel="noopener noreferrer">
                          <FileText className="h-3.5 w-3.5 text-primary" /> View Deliverable Attachment
                          <ExternalLink className="h-3 w-3 ml-1 text-muted-foreground" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground font-light">
                  <Clock className="h-6 w-6 mx-auto mb-1.5 opacity-40 text-amber-500" />
                  No deliverable proof has been submitted yet by the assigned faculty member.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Financials, Faculty & Meta */}
        <div className="space-y-6">
          {/* Rewards & Token Card */}
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">
                Token Reward Allocation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="text-3xl font-extrabold text-primary font-mono">
                  {task.credit_value} WORK
                </span>
                <Badge variant="outline" className="text-xs uppercase font-mono">
                  {task.category}
                </Badge>
              </div>

              <div className="pt-2 border-t border-border/40 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Department:</span>
                  <span className="font-medium text-foreground">{task.org_units?.name || "Department Pool"}</span>
                </div>
                <div className="flex justify-between">
                  <span>Penalty:</span>
                  <span className="font-medium text-foreground">{task.penalty_value || 0} WORK</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Assigned Faculty Profile */}
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Assigned Faculty
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {assignedFaculty ? (
                <div className="space-y-1 text-xs">
                  <p className="text-sm font-semibold text-foreground">{assignedFaculty.name}</p>
                  <p className="text-muted-foreground">{assignedFaculty.email}</p>
                  {assignedFaculty.designation && (
                    <Badge variant="secondary" className="text-[10px] mt-1 font-normal">
                      {assignedFaculty.designation}
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  Open Pool (Available for Self-Nomination)
                </div>
              )}

              {creator && (
                <div className="pt-3 border-t border-border/40 text-xs text-muted-foreground space-y-0.5">
                  <span>Created by:</span>
                  <p className="font-medium text-foreground">{creator.name} ({creator.email})</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card className="rounded-2xl border-muted/60 bg-background/50 backdrop-blur-xs shadow-2xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs font-semibold uppercase text-muted-foreground tracking-wider flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Timeline & Deadlines
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Created Date:</span>
                <span className="font-medium text-foreground">
                  {new Date(task.created_at).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Deadline:</span>
                <span className="font-medium text-foreground">
                  {task.deadline
                    ? new Date(task.deadline).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })
                    : "Open Ended"}
                </span>
              </div>
              {task.completed_at && (
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-medium">
                  <span>Completed:</span>
                  <span>
                    {new Date(task.completed_at).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
