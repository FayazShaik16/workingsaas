import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTablePrimitive } from "@/components/shared/data-table-primitive"
import { StatusPill } from "@/components/shared/status-pill"
import { Button } from "@/components/ui/button"
import { ColumnDef } from "@tanstack/react-table"

export default async function LeadDashboardPage() {
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD")

  const supabase = await createClient()

  // Get verification pending tasks assigned to org_units under user's supervision
  const { data: verificationTasks, error } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      credit_value,
      assigned_to_id,
      status,
      deadline,
      users!tasks_assigned_to_id_fkey(name, email),
      task_proofs(id, submitted_at, file_url)
    `)
    .eq("status", "VERIFICATION_PENDING")
    .eq("organization_id", user.organizationId)
    .order("deadline", { ascending: true })

  if (error) throw error

  const pendingCount = verificationTasks?.length || 0

  // Get team statistics
  const { data: teamStats } = await supabase
    .from("tasks")
    .select("assigned_to_id, status")
    .eq("organization_id", user.organizationId)
    .in("status", ["IN_PROGRESS", "VERIFICATION_PENDING", "LEAD_SIGNED"])

  const tasksInProgress = teamStats?.filter((t) => t.status === "IN_PROGRESS").length || 0
  const tasksAwaitingReview = teamStats?.filter((t) => t.status === "VERIFICATION_PENDING").length || 0
  const tasksCompleted = teamStats?.filter((t) => t.status === "LEAD_SIGNED").length || 0

  type VerificationTask = {
    id: string
    title: string
    credit_value: number
    status: string
    deadline: string | null
    users: { name: string; email: string } | null
    task_proofs: Array<{ id: string; submitted_at: string; file_url: string | null }> | null
  }

  const columns: ColumnDef<VerificationTask>[] = [
    {
      accessorKey: "title",
      header: "Task Title",
      cell: ({ row }) => <span className="font-medium">{row.original.title}</span>,
    },
    {
      accessorKey: "users.name",
      header: "Assignee",
      cell: ({ row }) => (
        <div className="text-sm">
          <p className="font-medium">{row.original.users?.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.users?.email}</p>
        </div>
      ),
    },
    {
      accessorKey: "credit_value",
      header: "Credits",
      cell: ({ row }) => <span className="font-mono font-semibold">{row.original.credit_value}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusPill status={row.original.status} />,
    },
    {
      accessorKey: "task_proofs",
      header: "Proof",
      cell: ({ row }) => {
        const proofs = row.original.task_proofs || []
        return (
          <div className="text-sm">
            {proofs.length > 0 ? (
              <a href={proofs[0].file_url || "#"} className="text-blue-600 hover:underline">
                View Proof
              </a>
            ) : (
              <span className="text-muted-foreground">No proof</span>
            )}
          </div>
        )
      },
    },
    {
      id: "actions",
      header: "Action",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="outline"
          asChild
        >
          <a href={`/lead/verification/${row.original.id}`}>Review</a>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Verification Queue</h1>
        <p className="text-muted-foreground mt-2">Review and approve team member task submissions</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasksInProgress}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Awaiting Review</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{tasksAwaitingReview}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{tasksCompleted}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Team Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{new Set(teamStats?.map((t) => t.assigned_to_id)).size}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks Awaiting Review ({pendingCount})</CardTitle>
          <CardDescription>Click "Review" to view proof and approve or reject the submission</CardDescription>
        </CardHeader>
        <CardContent>
          {verificationTasks && verificationTasks.length > 0 ? (
            <DataTablePrimitive
              columns={columns}
              data={verificationTasks}
              pageSize={10}
              searchPlaceholder="Search tasks..."
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No tasks awaiting review. All submissions have been processed.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
