import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Users,
  CalendarDays,
  Mail,
  ArrowRight,
  TrendingUp,
  FileSpreadsheet,
} from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminFacultyPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DEPT_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`

  // 1. Fetch department faculty members
  const { data: facultyMembers } = await db
    .from("users")
    .select("id, name, email, employee_id, designation, status")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  const members = facultyMembers || []

  // 2. Fetch scheduled templates count per faculty
  const { data: templates } = await db
    .from("scheduled_work_templates")
    .select("assigned_to_id, credit_value")
    .eq("organization_id", orgId)
    .eq("active", true)

  const templateCountByFaculty = new Map<string, number>()
  const scheduledCreditsByFaculty = new Map<string, number>()

  for (const t of templates || []) {
    const fId = t.assigned_to_id
    templateCountByFaculty.set(fId, (templateCountByFaculty.get(fId) || 0) + 1)
    scheduledCreditsByFaculty.set(fId, (scheduledCreditsByFaculty.get(fId) || 0) + Number(t.credit_value || 1.0))
  }

  // 3. Fetch monthly work progress per faculty
  const { data: progressList } = await db
    .from("monthly_work_progress")
    .select("user_id, raw_earned_credits, total_target_credits, display_progress_percentage, salary_eligible")
    .eq("organization_id", orgId)
    .eq("month_start", currentMonthStart)

  const progressByFaculty = new Map<string, any>()
  for (const p of progressList || []) {
    progressByFaculty.set(p.user_id, p)
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Faculty Directory & Workload
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Department teaching personnel, weekly scheduled workload, and live monthly work progress.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/${orgId}/dept-admin/import`} className="gap-1.5 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Import Timetable</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/${orgId}/dept-admin/schedules`} className="gap-1.5 text-xs">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Manage Schedules</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Faculty Table */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Department Faculty ({members.length})
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Overview of active teaching staff and their recurring weekly timetable commitments.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {members.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
              <Users className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No Faculty Members Found</p>
              <p className="text-muted-foreground">
                Import faculty accounts via the Bulk Importer or add them from the Admin Panel.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                    <th className="py-3 px-4 font-semibold">Faculty Member</th>
                    <th className="py-3 px-4 font-semibold">Employee ID</th>
                    <th className="py-3 px-4 font-semibold">Designation</th>
                    <th className="py-3 px-4 font-semibold">Weekly Slots</th>
                    <th className="py-3 px-4 font-semibold">Monthly Progress</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map((f: any) => {
                    const slotCount = templateCountByFaculty.get(f.id) || 0
                    const progress = progressByFaculty.get(f.id)
                    const progressPct = progress ? Number(progress.display_progress_percentage) : 0
                    const isEligible = progress?.salary_eligible

                    return (
                      <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{f.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3 text-muted-foreground/60" />
                            <span>{f.email}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {f.employee_id || "N/A"}
                        </td>
                        <td className="py-3 px-4 text-foreground">
                          {f.designation || "Faculty Member"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="font-mono text-xs">
                            {slotCount} slot{slotCount === 1 ? "" : "s"} / week
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          {progress ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-foreground">
                                  {progressPct}%
                                </span>
                                {isEligible && (
                                  <Badge variant="secondary" className="text-[10px] text-emerald-600 bg-emerald-500/10">
                                    85% Met
                                  </Badge>
                                )}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {Number(progress.raw_earned_credits).toFixed(1)} / {Number(progress.total_target_credits).toFixed(1)} cr
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground font-mono">
                              0.0 / 0.0 cr
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1">
                            <Link href={`/${orgId}/dept-admin/schedules`}>
                              <span>Schedule</span>
                              <ArrowRight className="h-3 w-3" />
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
