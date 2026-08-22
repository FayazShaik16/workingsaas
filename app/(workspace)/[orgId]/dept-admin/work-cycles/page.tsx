import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Clock,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminWorkCyclesPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DEPT_ADMIN", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // Fetch all work cycles for the organization
  const { data: cycles } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .order("start_date", { ascending: false })

  const workCycles = cycles || []

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Monthly Work Cycles
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Institutional monthly accounting periods, target weights, and salary threshold definitions.
          </p>
        </div>

        <Button asChild size="sm">
          <Link href={`/${orgId}/dept-admin/schedules`} className="gap-1.5 text-xs">
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Open Schedule Matrix</span>
          </Link>
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Scheduled Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">75.00%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Target composition from recurring weekly timetables
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Unstructured Weight
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">25.00%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Initiatives, department tasks, and nominated work
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Salary Authorization Threshold
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">85.00%</div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Minimum overall progress required for Day 26 salary claim
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cycles List */}
      <Card>
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-sm font-bold text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Work Cycles ({workCycles.length})
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Historical and current work cycles configured for this organization.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0">
          {workCycles.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs space-y-2">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground/40" />
              <p className="font-semibold text-foreground">No Work Cycles Configured</p>
              <p className="text-muted-foreground">
                Work cycles are initialized automatically during month transition or by System Admin.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-muted-foreground font-mono text-[11px]">
                    <th className="py-3 px-4 font-semibold">Cycle Name</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold">Duration</th>
                    <th className="py-3 px-4 font-semibold">Composition</th>
                    <th className="py-3 px-4 font-semibold">Threshold</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {workCycles.map((c: any) => {
                    const isActive = c.status === "ACTIVE"
                    return (
                      <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-foreground">{c.name}</div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            Cycle ID: {c.id.slice(0, 8)}...
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          {isActive ? (
                            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              {c.status}
                            </Badge>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">
                          {c.start_date} → {c.end_date}
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground">
                          {Number(c.scheduled_work_weight_percentage).toFixed(0)}% Sched / {Number(c.unstructured_work_weight_percentage).toFixed(0)}% Ad-hoc
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {Number(c.salary_authorization_threshold_percentage).toFixed(0)}%
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button asChild size="sm" variant="ghost" className="h-7 text-xs gap-1">
                            <Link href={`/${orgId}/dept-admin/schedules`}>
                              <span>Schedules</span>
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
