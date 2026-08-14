import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DepartmentSchedulePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Get user details to identify their org_unit_id
  const { data: leadUser } = await supabase
    .from("users")
    .select("org_unit_id")
    .eq("id", user.id)
    .single()

  const orgUnitId = leadUser?.org_unit_id

  // Fetch structured tasks for the department unit (or fetch all for Director/Admin)
  let query = supabase
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      status,
      deadline,
      assigned_to_id,
      users!tasks_assigned_to_id_fkey(name, email)
    `)
    .eq("organization_id", orgId)
    .eq("category", "STRUCTURED")

  if (!user.scopeLevels.includes("DIRECTOR") && !user.scopeLevels.includes("SYSTEM_ADMIN") && orgUnitId) {
    query = query.eq("org_unit_id", orgUnitId)
  }

  const { data: tasks, error } = await query.order("deadline", { ascending: true })

  if (error) {
    console.error("[schedule] fetch failed:", error)
  }

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Department Schedule</h1>
        <p className="text-muted-foreground mt-2">
          View all scheduled structured tasks for your department.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Structured Task Grid</CardTitle>
          <CardDescription>Scheduled classes, exams, and invigilations</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks && tasks.length > 0 ? (
            <div className="divide-y">
              {tasks.map((task: any) => (
                <div key={task.id} className="py-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-sm">{task.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Assignee: {task.users?.name || "Unassigned"} ({task.users?.email || ""})
                    </p>
                    {task.deadline && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Scheduled Date: {new Date(task.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{task.status}</Badge>
                    <Badge className="font-bold">{task.credit_value} Credits</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6">No scheduled tasks found for this department.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
