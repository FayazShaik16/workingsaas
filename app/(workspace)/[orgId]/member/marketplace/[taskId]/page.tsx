"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Loader2, ArrowLeft } from "lucide-react"

export default function TaskDetailPage() {
  const router = useRouter()
  const params = useParams()
  const orgId = params.orgId as string
  const taskId = params.taskId as string
  const supabase = createClient()

  const [task, setTask] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nominationMessage, setNominationMessage] = useState("")
  const [hasNominated, setHasNominated] = useState(false)

  useEffect(() => {
    const fetchTask = async () => {
      try {
        if (!orgId || !taskId) return

        const { data: authData } = await supabase.auth.getUser()
        if (!authData?.user) throw new Error("Not authenticated")

        // Get task details
        const { data: taskData, error: taskError } = await supabase
          .from("tasks")
          .select(
            `
            id,
            title,
            description,
            credit_value,
            deadline,
            priority,
            category,
            requires_peer_review,
            task_type_definitions(label, verification_mode),
            org_units(name),
            creator:creator_id(name)
          `
          )
          .eq("id", taskId)
          .eq("organization_id", orgId)
          .single()

        if (taskError || !taskData) throw new Error("Task not found")

        setTask(taskData)

        // Check if user has already nominated
        const { data: nomination } = await supabase
          .from("nominations")
          .select("id, status")
          .eq("task_id", taskId)
          .eq("user_id", authData.user.id)
          .single()

        if (nomination) {
          setHasNominated(true)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to fetch task"
        setError(message)
        console.error("[task detail] fetch failed:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchTask()
  }, [taskId, orgId, supabase])

  const handleNominate = async () => {
    setError(null)
    setSubmitting(true)

    try {
      const { data: authData } = await supabase.auth.getUser()
      if (!authData?.user) throw new Error("Not authenticated")

      // Create nomination via API
      const res = await fetch("/api/tasks/nominate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          pitchNote: nominationMessage,
        }),
      })

      const resData = await res.json()
      if (!res.ok) {
        throw new Error(resData.error || "Failed to submit nomination")
      }

      setHasNominated(true)
      setNominationMessage("")
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit nomination"
      setError(message)
      console.error("[task detail] nominate failed:", err)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!task) {
    return (
      <div className="p-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-destructive mb-4">{error || "Task not found"}</p>
            <Button asChild variant="outline">
              <Link href={`/${orgId}/member/marketplace`}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Marketplace
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link href={`/${orgId}/member/marketplace`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Marketplace
        </Link>
      </Button>

      <div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{task.title}</h1>
            <p className="text-muted-foreground mt-2">{task.org_units?.name}</p>
          </div>
          <Badge className="text-lg px-3 py-1">{task.priority}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{task.credit_value.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">{task.category}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deadline</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-medium">
              {task.deadline ? new Date(task.deadline).toLocaleDateString() : "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{task.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Task Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Type</p>
              <p className="font-medium">{task.task_type_definitions?.label}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Verification</p>
              <p className="font-medium">{task.task_type_definitions?.verification_mode}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Peer Review Required</p>
              <p className="font-medium">{task.requires_peer_review ? "Yes" : "No"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Posted By</p>
              <p className="font-medium">{task.creator?.name}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Nomination Section */}
      <Card>
        <CardHeader>
          <CardTitle>Apply for this Task</CardTitle>
          <CardDescription>Express your interest in completing this task</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <div className="bg-destructive/10 text-destructive text-sm p-3 rounded">{error}</div>}

          {hasNominated ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-lg">
              ✓ You have already applied for this task. Waiting for acceptance.
            </div>
          ) : (
            <>
              <Textarea
                placeholder="Why are you interested in this task? (optional)"
                value={nominationMessage}
                onChange={(e) => setNominationMessage(e.target.value)}
                rows={4}
                disabled={submitting}
              />
              <Button
                onClick={handleNominate}
                className="w-full"
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Application
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
