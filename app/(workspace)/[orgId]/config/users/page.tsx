import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

export default async function AdminUsersPage() {
  const user = await requireAuth()
  await requireScope("SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch users in this organization
  const { data: users } = await supabase
    .from("users")
    .select(`
      id,
      email,
      name,
      designation,
      status,
      created_at,
      org_units(name),
      user_roles(roles(name, scope_level))
    `)
    .eq("organization_id", user.organizationId)
    .order("created_at", { ascending: false })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization Users</h1>
        <p className="text-muted-foreground mt-1">Manage and view all users provisioned in your organization</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-md">All Users ({users?.length || 0})</CardTitle>
          <CardDescription>List of employees, leaders, and administrators</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users || []).map((u: any) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>{u.org_units?.name || "Unassigned"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {u.user_roles?.[0]?.roles?.name || "Member"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.status === "ACTIVE" ? "default" : "secondary"}>
                      {u.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
