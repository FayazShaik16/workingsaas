import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ProofReviewActions from "@/components/lead/proof-review-actions"

interface PageProps {
  params: Promise<{ orgId: string; taskId: string }>
}

export default async function ProofReviewPage({ params }: PageProps) {
  const { orgId, taskId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD")

  const supabase = await createClient()

  // Get task with proof and assignment details
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      assigned_to_id,
      status,
      deadline,
      requires_peer_review,
      users!tasks_assigned_to_id_fkey(id, name, email),
      task_proofs(id, file_url, description, submitted_at),
      task_peer_reviews(id, reviewer_id, decision, comment)
    `)
    .eq("id", taskId)
    .eq("organization_id", orgId)
    .single()

  if (taskError || !task) notFound()
  if (task.status !== "VERIFICATION_PENDING") notFound()

  const proofUrl = task.task_proofs?.[0]?.file_url
  const proofDescription = task.task_proofs?.[0]?.description
  const peerReviews = task.task_peer_reviews || []

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
        <p className="text-muted-foreground mt-2">Review proof and approve task completion</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Assigned To</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold">{task.users.name}</p>
            <p className="text-xs text-muted-foreground">{task.users.email}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Credit Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-semibold text-lg">{task.credit_value}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Task Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{task.description || "No description provided"}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Proof Submission</CardTitle>
          <CardDescription>User-provided evidence of task completion</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {proofUrl ? (
            <div>
              <a
                href={proofUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 hover:underline"
              >
                📎 View Proof File
              </a>
            </div>
          ) : (
            <p className="text-muted-foreground">No proof file attached</p>
          )}

          {proofDescription && (
            <div>
              <p className="text-sm font-medium mb-2">Description</p>
              <p className="text-sm bg-muted p-3 rounded">{proofDescription}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {task.requires_peer_review && (
        <Card>
          <CardHeader>
            <CardTitle>Peer Review Status</CardTitle>
            <CardDescription>Feedback from team members who reviewed this submission</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {peerReviews.length > 0 ? (
              peerReviews.map((review: any) => (
                <div key={review.id} className="border-l-2 border-muted-foreground/20 pl-4 py-2">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={review.decision === "APPROVED" ? "default" : "destructive"}>
                      {review.decision}
                    </Badge>
                  </div>
                  {review.comment && <p className="text-sm text-muted-foreground">{review.comment}</p>}
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">No peer reviews yet</p>
            )}
          </CardContent>
        </Card>
      )}

      <ProofReviewActions
        taskId={task.id}
        taskTitle={task.title}
        userId={user.id}
        creditValue={task.credit_value}
      />
    </div>
  )
}
