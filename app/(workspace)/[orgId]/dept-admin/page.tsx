import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  GraduationCap,
  Users,
  BookOpen,
  Calendar,
  Upload,
  Layers,
  ArrowRight,
  Sparkles,
  Building2,
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

  // 1. Get user profile & department details
  const { data: userData } = await db
    .from("users")
    .select("org_unit_id, org_units(id, name, unit_type)")
    .eq("id", user.id)
    .single()

  let deptId = userData?.org_unit_id
  let deptName = (userData?.org_units as any)?.name || ""

  // Fallback to first department if user has no explicit org_unit_id (e.g. Director inspecting)
  if (!deptId) {
    const { data: firstUnit } = await admin
      .from("org_units")
      .select("id, name, unit_type")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle()

    if (firstUnit) {
      deptId = firstUnit.id
      deptName = firstUnit.name
    } else {
      deptName = "Academic Department"
    }
  }

  // 2. Get dynamic statistics
  const [
    { count: programmeCount },
    { count: facultyCount },
    { data: programsData },
    { data: assignmentData },
  ] = await Promise.all([
    admin
      .from("academic_programs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId),
    admin
      .from("users")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq(deptId ? "org_unit_id" : "organization_id", deptId || orgId),
    admin
      .from("academic_programs")
      .select("id")
      .eq("organization_id", orgId),
    admin
      .from("subject_assignments")
      .select("id")
      .eq("organization_id", orgId),
  ])

  const programIds = (programsData || []).map((p: any) => p.id)
  const { count: subjectCount } = programIds.length > 0
    ? await admin.from("subjects").select("id", { count: "exact", head: true }).in("program_id", programIds)
    : { count: 0 }

  const assignmentIds = (assignmentData || []).map((a: any) => a.id)
  const { count: slotCount } = assignmentIds.length > 0
    ? await admin.from("timetable_slots").select("id", { count: "exact", head: true }).in("subject_assignment_id", assignmentIds)
    : { count: 0 }

  const stats = [
    { label: "Programmes", value: programmeCount ?? 0, icon: GraduationCap, color: "text-purple-500", bg: "bg-purple-500/10" },
    { label: "Faculty / Staff", value: facultyCount ?? 0, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Subjects / Courses", value: subjectCount ?? 0, icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Active Timetable Slots", value: slotCount ?? 0, icon: Calendar, color: "text-amber-500", bg: "bg-amber-500/10" },
  ]

  const quickActions = [
    { label: "Academic Programmes", desc: "Manage curriculum tracks & degrees", href: `/${orgId}/dept-admin/programmes`, icon: GraduationCap },
    { label: "Course Subjects", desc: "Define credits, codes & syllabi", href: `/${orgId}/dept-admin/subjects`, icon: BookOpen },
    { label: "Student Batches", desc: "Configure semester sections & cohorts", href: `/${orgId}/dept-admin/batches`, icon: Layers },
    { label: "Master Timetable", desc: "Assign faculty, rooms & weekly schedule", href: `/${orgId}/dept-admin/timetable`, icon: Calendar },
    { label: "Bulk Ingestion", desc: "Import CSV faculty & subject mappings", href: `/${orgId}/dept-admin/import`, icon: Upload },
  ]

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            {deptName} Administration
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Curriculum management, academic scheduling & faculty period allocation
          </p>
        </div>
      </div>

      {/* Dynamic Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon
          return (
            <Card key={s.label} className="rounded-2xl border-2 shadow-xs">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {s.label}
                </CardTitle>
                <div className={`p-2 rounded-xl ${s.bg} ${s.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-foreground">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1 font-medium">Configured in system</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Quick Actions Grid */}
      <Card className="rounded-2xl border-2 shadow-md">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <CardTitle className="text-lg font-black flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Department Management Modules
          </CardTitle>
          <CardDescription className="text-xs">
            Direct access to academic resource planning and scheduling tools
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quickActions.map((action) => {
              const ActionIcon = action.icon
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/60 hover:shadow-md transition-all group flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:scale-105 transition-transform">
                      <ActionIcon className="h-5 w-5" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-foreground group-hover:text-primary transition-colors">
                      {action.label}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-medium">{action.desc}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
