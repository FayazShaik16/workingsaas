import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DataTablePrimitive } from "@/components/shared/data-table-primitive"
import { StatusPill } from "@/components/shared/status-pill"
import { Badge } from "@/components/ui/badge"
import { ColumnDef } from "@tanstack/react-table"

type TeamMember = {
  id: string
  name: string
  email: string
  scope_levels: string[]
  org_unit_id: string | null
}

export default async function DirectorDashboardPage() {
  const user = await requireAuth()
  await requireScope("DIRECTOR")

  const supabase = await createClient()

  // Get organization details
  const { data: org } = await (supabase as any)
    .from("organizations")
    .select("name, type, compensation_policies(monthly_target_credits)")
    .eq("id", user.organizationId)
    .single()

  // Get all team members in organization
  const { data: teamMembers } = await (supabase as any)
    .from("users")
    .select("id, name, email, org_unit_id, user_roles(roles(scope_level))")
    .eq("organization_id", user.organizationId)
    .order("name", { ascending: true })

  // Get org-wide statistics
  const { data: tasks } = await (supabase as any)
    .from("tasks")
    .select("status, assigned_to_id")
    .eq("organization_id", user.organizationId)

  const totalUsers = teamMembers?.length || 0
  const leads =
    teamMembers?.filter((m: any) =>
      m.user_roles?.some((ur: any) => ur.roles?.scope_level === "ORG_UNIT_LEAD")
    ).length || 0
  const tasksAssigned = tasks?.filter((t: any) => t.assigned_to_id).length || 0
  const tasksCompleted = tasks?.filter((t: any) => t.status === "CLOSED").length || 0

  const columns: ColumnDef<TeamMember>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.email}</span>,
    },
    {
      accessorKey: "scope_levels",
      header: "Roles",
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.scope_levels?.map((scope) => (
            <Badge key={scope} variant="outline" className="text-xs">
              {scope}
            </Badge>
          ))}
        </div>
      ),
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
          <a href={`/director/team/${row.original.id}`}>Manage</a>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Dashboard</h1>
        <p className="text-muted-foreground mt-2">Manage team members and organization settings</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Lead Supervisors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leads}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Tasks Assigned</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tasksAssigned}</div>
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>All members in {org?.name}</CardDescription>
        </CardHeader>
        <CardContent>
          {teamMembers && teamMembers.length > 0 ? (
            <DataTablePrimitive
              columns={columns}
              data={(teamMembers || []) as any}
              enableSearch={true}
              searchPlaceholder="Search team members..."
            />
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No team members yet. Invite members to get started.
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button asChild>
          <a href="/director/invite-team">Invite Team Members</a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/director/organization-settings">Organization Settings</a>
        </Button>
      </div>
    </div>
  )
}
