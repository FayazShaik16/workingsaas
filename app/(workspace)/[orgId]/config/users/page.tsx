import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, UserPlus, Building2, Shield, Mail, CheckCircle2, Clock } from "lucide-react"
import { formatRole, formatDepartment, formatStatus } from "@/lib/utils/formatters"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function AdminUsersPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("SYSTEM_ADMIN", "DIRECTOR")

  const admin = createAdminClient()
  const db = admin as any

  // Fetch users, user roles, and departments in parallel
  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  const [
    { data: users },
    { data: userRoles },
    { data: units },
    { data: progressRecords },
  ] = await Promise.all([
    db.from("users").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    db.from("user_roles").select("user_id, roles(name, scope_level)"),
    db.from("org_units").select("id, name").eq("organization_id", orgId),
    db.from("monthly_work_progress").select("user_id, display_progress_percentage").eq("organization_id", orgId).eq("month_start", currentMonthStart),
  ])

  const allUsers: any[] = users || []
  const allRoles: any[] = userRoles || []
  const allUnits: any[] = units || []
  const progressMap = new Map<string, number>((progressRecords || []).map((p: any) => [p.user_id, Number(p.display_progress_percentage || 0)]))

  // Map users with resolved roles and units
  const formattedUsers = allUsers.map((u: any) => {
    const userRoleMapping = allRoles.find((r: any) => r.user_id === u.id)
    const roleObj = (userRoleMapping?.roles as any)
    const unitObj = allUnits.find((unit: any) => unit.id === u.org_unit_id)

    const rawRole = roleObj?.name || roleObj?.scope_level || (u.designation?.toLowerCase().includes("director") ? "DIRECTOR" : "MEMBER")
    const cleanRoleName = formatRole(rawRole)
    const cleanDeptName = formatDepartment(unitObj?.name)

    return {
      id: u.id,
      name: u.name || "Member",
      email: u.email,
      employeeId: u.employee_id || `EMP-${u.id.replace(/-/g, "").slice(0, 5).toUpperCase()}`,
      designation: u.designation || "Faculty / Staff",
      department: cleanDeptName,
      roleName: cleanRoleName,
      scopeLevel: roleObj?.scope_level || "MEMBER",
      status: formatStatus(u.status || "ACTIVE"),
      progress: Number(progressMap.get(u.id) || 0),
      createdAt: u.created_at ? new Date(u.created_at).toLocaleDateString() : "Recent",
    }
  })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            Organization Users & Roster
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Complete active directory of employees, faculty leads, and executive administrators
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${orgId}/director/invite-team`}>
            <Button size="sm" className="gap-1.5 font-bold shadow-xs">
              <UserPlus className="h-4 w-4" /> Invite Member
            </Button>
          </Link>
        </div>
      </div>

      {/* Overview Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Roster
            </CardTitle>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{formattedUsers.length}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Provisioned accounts</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Assigned to Departments
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {formattedUsers.filter((u: any) => u.department !== "Unassigned / Root").length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">In active academic units</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Payroll Release Eligible
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {formattedUsers.filter((u: any) => u.progress >= 85).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">&ge;85% milestone progress</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-foreground">
                All Users ({formattedUsers.length})
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Personnel directory with role scopes, designations & active states
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-bold text-xs">
              {allUnits.length} Departments Configured
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {formattedUsers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <Users className="h-8 w-8 text-muted-foreground/50 mx-auto" />
              <p className="font-bold text-foreground">No Users Found</p>
              <p className="text-xs">Invite members or use the Organization Tree to add staff.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Name & Identity</TableHead>
                    <TableHead className="font-bold text-xs">Employee ID</TableHead>
                    <TableHead className="font-bold text-xs">Department</TableHead>
                    <TableHead className="font-bold text-xs">System Role</TableHead>
                    <TableHead className="font-bold text-xs">Work Progress</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formattedUsers.map((u: any) => (
                    <TableRow key={u.id} className="hover:bg-muted/30 transition">
                      <TableCell>
                        <div className="font-bold text-sm text-foreground">{u.name}</div>
                        <div className="text-xs text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                          <Mail className="h-3 w-3 text-muted-foreground/60" /> {u.email}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                        {u.employeeId}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs font-semibold text-foreground">{u.department}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            u.scopeLevel === "DIRECTOR"
                              ? "default"
                              : u.scopeLevel === "SYSTEM_ADMIN"
                              ? "secondary"
                              : "outline"
                          }
                          className="text-[10px] font-bold uppercase tracking-wider"
                        >
                          {u.roleName}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                u.progress >= 85
                                  ? "bg-emerald-500"
                                  : u.progress >= 70
                                  ? "bg-amber-500"
                                  : "bg-destructive"
                              }`}
                              style={{ width: `${u.progress}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-foreground">
                            {u.progress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-[10px] font-bold ${
                            u.status === "ACTIVE"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {u.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
