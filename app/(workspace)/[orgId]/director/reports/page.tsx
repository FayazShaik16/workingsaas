import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTeachingStaff } from "@/lib/queries/teaching-staff"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  BarChart3,
  Building2,
  Users,
  TrendingUp,
  AlertTriangle,
  Award,
  Layers,
} from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorReportsPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  // Fetch departments, canonical teaching staff, progress records, and tasks in parallel
  const [
    { data: orgUnits },
    teachingStaff,
    { data: tasks },
    { data: progressRecords },
  ] = await Promise.all([
    admin.from("org_units").select("*").eq("organization_id", orgId),
    getTeachingStaff(admin, orgId),
    admin
      .from("tasks")
      .select("id, status, credit_value, org_unit_id")
      .eq("organization_id", orgId),
    (admin as any)
      .from("monthly_work_progress")
      .select("user_id, display_progress_percentage, salary_eligible")
      .eq("organization_id", orgId)
      .eq("month_start", currentMonthStart),
  ])

  const allUnits = orgUnits || []
  const allTeachingStaff = teachingStaff || []
  const allTasks = tasks || []
  const progressMap = new Map<string, number>((progressRecords || []).map((p: any) => [p.user_id, Number(p.display_progress_percentage || 0)]))

  // Compute departmental statistics dynamically over teaching staff only
  const deptStats = allUnits.map((unit: any) => {
    const deptMembers = allTeachingStaff.filter((u: any) => u.org_unit_id === unit.id)
    const memberCount = deptMembers.length
    const activeMembers = deptMembers.filter((m: any) => m.status === "ACTIVE").length

    const progresses = deptMembers.map((m: any) => progressMap.get(m.id) || 0)
    const avgProgress =
      memberCount > 0
        ? Math.round(progresses.reduce((a: number, b: number) => a + b, 0) / memberCount)
        : 0

    const unitTasks = allTasks.filter((t: any) => t.org_unit_id === unit.id)
    const completedTasks = unitTasks.filter(
      (t: any) => t.status === "VERIFIED" || t.status === "COMPLETED" || t.status === "CLOSED" || t.status === "LEAD_SIGNED"
    ).length
    const totalTokensDistributed = unitTasks
      .filter((t: any) => t.status === "VERIFIED" || t.status === "CLOSED" || t.status === "LEAD_SIGNED")
      .reduce((sum: number, t: any) => sum + Number(t.credit_value || 0), 0)

    const eligibleCount = deptMembers.filter(
      (m: any) => (progressMap.get(m.id) || 0) >= 85
    ).length
    const eligibilityRate =
      memberCount > 0 ? Math.round((eligibleCount / memberCount) * 100) : 0

    let status = "HEALTHY"
    if (memberCount > 0 && (avgProgress < 70 || eligibilityRate < 50)) {
      status = "CRITICAL"
    } else if (memberCount > 0 && (avgProgress < 85 || eligibilityRate < 75)) {
      status = "NEEDS_ATTENTION"
    }

    return {
      id: unit.id,
      name: unit.name,
      unitType: unit.unit_type || "Department",
      memberCount,
      activeMembers,
      avgProgress,
      completedTasks,
      totalTokensDistributed,
      eligibleCount,
      eligibilityRate,
      status,
    }
  })

  // Global aggregates over teaching staff only
  const totalEmployees = allTeachingStaff.length
  const totalDepts = allUnits.length
  const overallAvgProgress =
    totalEmployees > 0
      ? Math.round(
          allTeachingStaff.reduce((sum: number, u: any) => sum + (progressMap.get(u.id) || 0), 0) /
            totalEmployees
        )
      : 0
  const totalTokensReleased = allTasks
    .filter((t: any) => t.status === "VERIFIED" || t.status === "CLOSED" || t.status === "LEAD_SIGNED")
    .reduce((sum: number, t: any) => sum + Number(t.credit_value || 0), 0)

  const totalEligibleStaff = allTeachingStaff.filter(
    (u: any) => (progressMap.get(u.id) || 0) >= 85
  ).length

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <BarChart3 className="h-8 w-8 text-primary" />
            Department Performance Reports
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Live institutional intelligence, departmental output audit & 85% payroll eligibility index
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Total Departments
            </CardTitle>
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Building2 className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalDepts}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Configured Academic Units</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Teaching Faculty
            </CardTitle>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">
              {totalEligibleStaff} Payroll Eligible (≥85%)
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Faculty Avg Progress
            </CardTitle>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">{overallAvgProgress}%</div>
            <div className="w-full bg-muted rounded-full h-2 mt-2 overflow-hidden">
              <div
                className={`h-2 rounded-full ${
                  overallAvgProgress >= 85
                    ? "bg-emerald-500"
                    : overallAvgProgress >= 70
                    ? "bg-amber-500"
                    : "bg-destructive"
                }`}
                style={{ width: `${overallAvgProgress}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 shadow-xs">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Verified Credits Earned
            </CardTitle>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Award className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-foreground">
              {totalTokensReleased.toLocaleString()} WORK
            </div>
            <p className="text-xs text-muted-foreground mt-1 font-medium">Proof-backed credit output</p>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown Table */}
      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
                <Layers className="h-5 w-5 text-primary" />
                Department Breakdown & Payroll Eligibility
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Real-time output index, proof audits & 85% salary disbursement readiness
              </CardDescription>
            </div>
            <Badge variant="outline" className="font-bold text-xs">
              {totalDepts} Functional Departments
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {deptStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm space-y-2">
              <Building2 className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <p className="font-bold text-foreground">No Departments Configured Yet</p>
              <p className="text-xs">
                Visit the Executive Organization Tree or Import Desk to configure departments.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Department Unit</TableHead>
                    <TableHead className="font-bold text-xs">Type</TableHead>
                    <TableHead className="font-bold text-xs">Faculty Count</TableHead>
                    <TableHead className="font-bold text-xs">Avg Work Progress</TableHead>
                    <TableHead className="font-bold text-xs">85% Salary Eligibility</TableHead>
                    <TableHead className="font-bold text-xs">Verified Tasks</TableHead>
                    <TableHead className="font-bold text-xs">Credits Earned</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deptStats.map((dept) => (
                    <TableRow key={dept.id} className="hover:bg-muted/30 transition">
                      <TableCell className="font-bold text-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Building2 className="h-4 w-4" />
                          </div>
                          <span className="text-foreground">{dept.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider">
                          {dept.unitType}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        {dept.memberCount} faculty
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-20 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${
                                dept.avgProgress >= 85
                                  ? "bg-emerald-500"
                                  : dept.avgProgress >= 70
                                  ? "bg-amber-500"
                                  : "bg-destructive"
                              }`}
                              style={{ width: `${dept.avgProgress}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-foreground">
                            {dept.avgProgress}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-mono font-bold ${
                            dept.eligibilityRate >= 80
                              ? "text-emerald-600 dark:text-emerald-400"
                              : dept.eligibilityRate >= 50
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                          }`}>
                            {dept.eligibilityRate}%
                          </span>
                          <span className="text-[11px] text-muted-foreground font-medium">
                            ({dept.eligibleCount}/{dept.memberCount})
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold">
                        {dept.completedTasks}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {dept.totalTokensDistributed.toLocaleString()} WORK
                      </TableCell>
                      <TableCell>
                        {dept.status === "HEALTHY" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                            Healthy
                          </Badge>
                        ) : dept.status === "NEEDS_ATTENTION" ? (
                          <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px] font-bold">
                            Attention
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="flex items-center gap-1 w-fit text-[10px] font-bold">
                            <AlertTriangle className="h-3 w-3" />
                            Critical
                          </Badge>
                        )}
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
