import { requireAuth } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { FacultyScheduleView, WeeklyTemplateItem, InstanceItem } from "@/components/member/faculty-schedule-view"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CalendarDays } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberSchedulePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  const admin = createAdminClient()
  const db = admin as any

  const todayStr = new Date().toISOString().split("T")[0]
  const currentMonthStart = `${todayStr.slice(0, 7)}-01`
  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(new Date())

  // 1. Fetch recurring weekly scheduled templates assigned to this faculty
  const { data: templatesData } = await db
    .from("scheduled_work_templates")
    .select("id, title, weekly_day, start_time, end_time, credit_value, description")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .eq("active", true)
    .order("start_time", { ascending: true })

  const templates: WeeklyTemplateItem[] = (templatesData || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    weeklyDay: t.weekly_day,
    startTime: t.start_time,
    endTime: t.end_time,
    creditValue: Number(t.credit_value || 1.0),
    description: t.description,
  }))

  // 2. Fetch date-specific work instances for this faculty in the current month
  const { data: instancesData } = await db
    .from("scheduled_work_instances")
    .select("id, template_id, title, work_date, start_time, end_time, credit_value, status")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .gte("work_date", currentMonthStart)
    .neq("status", "CANCELLED")
    .order("work_date", { ascending: true })
    .order("start_time", { ascending: true })

  const instances: InstanceItem[] = (instancesData || []).map((i: any) => ({
    id: i.id,
    templateId: i.template_id,
    title: i.title,
    workDate: i.work_date,
    startTime: i.start_time,
    endTime: i.end_time,
    creditValue: Number(i.credit_value || 1.0),
    status: i.status,
  }))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              My Teaching & Work Schedule
            </h1>
            <Badge variant="secondary" className="font-mono text-xs">
              {templates.length} Weekly Sessions
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Weekly recurring sessions and date-specific instances. Complete sessions on trust to record credits.
          </p>
        </div>
      </div>

      {/* Main Schedule View */}
      <FacultyScheduleView
        orgId={orgId}
        userId={user.id}
        templates={templates}
        instances={instances}
        currentMonthName={monthName}
      />
    </div>
  )
}
