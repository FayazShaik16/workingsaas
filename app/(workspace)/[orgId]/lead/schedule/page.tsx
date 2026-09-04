import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { TrustedScheduleManager } from "@/components/dept-admin/trusted-schedule-manager"
import Link from "next/link"
import { CalendarPlus, Layers } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DepartmentSchedulePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN", "DEPT_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Get user details to identify their org_unit_id
  const { data: leadUser } = await db
    .from("users")
    .select("org_unit_id, org_units(name)")
    .eq("id", user.id)
    .single()

  const orgUnitId = leadUser?.org_unit_id || user.orgUnitId
  const deptName = (leadUser?.org_units as any)?.name || "Department"

  // 2. Fetch department faculty members
  let facultyQuery = db
    .from("users")
    .select("id, name, email, employee_id, designation")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .order("name", { ascending: true })

  if (orgUnitId && !user.scopeLevels.includes("DIRECTOR") && !user.scopeLevels.includes("SYSTEM_ADMIN")) {
    facultyQuery = facultyQuery.eq("org_unit_id", orgUnitId)
  }
  const { data: facultyMembers } = await facultyQuery

  // 3. Fetch active work cycles
  const { data: workCycles } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })

  // 4. Fetch scheduled work templates
  let templateQuery = db
    .from("scheduled_work_templates")
    .select("*, users!assigned_to_id(name, email)")
    .eq("organization_id", orgId)
    .order("weekly_day", { ascending: true })

  if (orgUnitId && facultyMembers && facultyMembers.length > 0 && !user.scopeLevels.includes("DIRECTOR") && !user.scopeLevels.includes("SYSTEM_ADMIN")) {
    const fIds = facultyMembers.map((f: any) => f.id)
    templateQuery = templateQuery.in("assigned_to_id", fIds)
  }
  const { data: templates } = await templateQuery

  // 5. Fetch structured tasks for the department unit
  let query = db
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

  if (orgUnitId && !user.scopeLevels.includes("DIRECTOR") && !user.scopeLevels.includes("SYSTEM_ADMIN")) {
    query = query.eq("org_unit_id", orgUnitId)
  }

  const { data: tasks, error } = await query.order("deadline", { ascending: true })

  if (error) {
    console.error("[schedule] fetch failed:", error)
  }

  return (
    <div className="space-y-8 p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="h-6 w-6 text-primary" />
            <span>{deptName} Work Schedule & Slots</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage weekly recurring slot allocations, import schedules, and monitor department task completion with collision prevention.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Link href={`/${orgId}/lead/schedule/generate`}>
            <Button size="sm" variant="outline" className="gap-2 text-xs">
              <CalendarPlus className="h-4 w-4 text-primary" />
              <span>Bulk Schedule Generator</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Embedded Trusted Schedule Matrix with Conflict Detection */}
      <TrustedScheduleManager
        orgId={orgId}
        facultyMembers={facultyMembers || []}
        workCycles={workCycles || []}
        initialTemplates={templates || []}
      />

      {/* Structured Task Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Department Task Executions</CardTitle>
          <CardDescription className="text-xs">Generated classes, sessions, and individual assignments</CardDescription>
        </CardHeader>
        <CardContent>
          {tasks && tasks.length > 0 ? (
            <div className="divide-y">
              {tasks.map((task: any) => (
                <div key={task.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <h4 className="font-medium text-foreground">{task.title}</h4>
                    <p className="text-muted-foreground mt-0.5">
                      Assignee: {task.users?.name || "Unassigned"} ({task.users?.email || ""})
                    </p>
                    {task.deadline && (
                      <p className="text-muted-foreground mt-0.5">
                        Scheduled Deadline: {new Date(task.deadline).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{task.status}</Badge>
                    <Badge className="font-bold">+{task.credit_value} Credits</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-6 text-xs">No scheduled tasks found for this department.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
