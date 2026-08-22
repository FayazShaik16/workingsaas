import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  CalendarDays,
  Clock,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  CheckCircle2,
} from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DEPT_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  // 1. Get user profile & department details
  const { data: userData } = await db
    .from("users")
    .select("org_unit_id, org_units(id, name, unit_type)")
    .eq("id", user.id)
    .single()

  const deptId = userData?.org_unit_id || null
  const deptName = (userData?.org_units as any)?.name || "Department Workspace"

  // 2. Fetch active work cycle
  const { data: activeCycle } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .eq("status", "ACTIVE")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  // 3. Get live trusted work statistics
  const [
    { count: facultyCount },
    { count: templateCount },
    { count: instancesThisMonthCount },
    { count: completedInstancesCount },
  ] = await Promise.all([
    // Active faculty count
    deptId
      ? db.from("users").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("org_unit_id", deptId).eq("status", "ACTIVE")
      : db.from("users").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("status", "ACTIVE"),
    // Active scheduled-work templates
    db.from("scheduled_work_templates").select("id", { count: "exact", head: true }).eq("organization_id", orgId).eq("active", true),
    // Generated work instances this month
    db.from("scheduled_work_instances").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("work_date", currentMonthStart).neq("status", "CANCELLED"),
    // Completed instances this month
    db.from("scheduled_work_instances").select("id", { count: "exact", head: true }).eq("organization_id", orgId).gte("work_date", currentMonthStart).eq("status", "SELF_COMPLETED"),
  ])

  // 4. Fetch recent scheduled templates for quick inspection
  const { data: recentTemplates } = await db
    .from("scheduled_work_templates")
    .select("id, title, weekly_day, start_time, end_time, credit_value, users!assigned_to_id(name, email)")
    .eq("organization_id", orgId)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(6)

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Department Operations
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {deptName}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage faculty schedules, monthly work cycles, and normalized timetable imports.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgId}/dept-admin/import`} className="gap-1.5 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import Center</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/${orgId}/dept-admin/schedules`} className="gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Schedule Matrix</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Live Trusted Work Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Faculty
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{facultyCount ?? 0}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Assigned teaching & department staff</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Work Cycle
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground truncate">
              {activeCycle?.name || "No Active Cycle"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {activeCycle ? `75% Sched / 25% Ad-hoc (85% Target)` : "Configure in Work Cycles"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Weekly Templates
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{templateCount ?? 0}</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Recurring weekly timetable slots</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Month Instances
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {completedInstancesCount ?? 0} / {instancesThisMonthCount ?? 0}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">Completed vs generated this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions & Recent Templates */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Schedules Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-primary" />
                Active Recurring Sessions
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground">
                Recent weekly schedule templates defined for faculty members.
              </CardDescription>
            </div>
            <Button asChild size="sm" variant="ghost">
              <Link href={`/${orgId}/dept-admin/schedules`} className="text-xs gap-1">
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {(!recentTemplates || recentTemplates.length === 0) ? (
              <div className="text-center py-10 text-muted-foreground text-xs">
                <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="font-medium text-foreground">No Schedule Templates Configured</p>
                <p className="text-muted-foreground mt-0.5">
                  Add manual slots or import an XLSX timetable to start tracking work sessions.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                      <th className="py-2.5 px-4 font-semibold">Faculty</th>
                      <th className="py-2.5 px-4 font-semibold">Day</th>
                      <th className="py-2.5 px-4 font-semibold">Time</th>
                      <th className="py-2.5 px-4 font-semibold">Session Title</th>
                      <th className="py-2.5 px-4 font-semibold">Credits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {recentTemplates.map((t: any) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">
                          {t.users?.name || "Faculty"}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-primary">
                          {t.weekly_day}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-muted-foreground">
                          {t.start_time?.slice(0, 5)} – {t.end_time?.slice(0, 5)}
                        </td>
                        <td className="py-2.5 px-4 text-foreground">{t.title}</td>
                        <td className="py-2.5 px-4 font-mono font-bold text-foreground">
                          +{Number(t.credit_value).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Operational Flow Guide */}
        <Card className="flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Trusted Work Operations
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Follow these simple steps to manage your department timetable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="flex gap-3 items-start">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                1
              </div>
              <div>
                <p className="font-semibold text-foreground">Import or Add Weekly Slots</p>
                <p className="text-muted-foreground mt-0.5">
                  Upload standard XLSX timetable files or create manual slots with title, day, and times.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                2
              </div>
              <div>
                <p className="font-semibold text-foreground">Sync Monthly Instances</p>
                <p className="text-muted-foreground mt-0.5">
                  Click "Sync Month Instances" to generate date-specific sessions in faculty calendars.
                </p>
              </div>
            </div>

            <div className="flex gap-3 items-start">
              <div className="h-6 w-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0">
                3
              </div>
              <div>
                <p className="font-semibold text-foreground">Faculty 2-Step Self Completion</p>
                <p className="text-muted-foreground mt-0.5">
                  Faculty declare completion on trust to automatically update their progress towards the 85% threshold.
                </p>
              </div>
            </div>
          </CardContent>
          <div className="p-4 border-t bg-muted/20">
            <Button asChild className="w-full text-xs" size="sm">
              <Link href={`/${orgId}/dept-admin/schedules`}>
                Open Schedule Matrix
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}
