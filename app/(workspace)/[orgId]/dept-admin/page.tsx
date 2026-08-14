import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"

export default async function DeptAdminDashboardPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Get dept info
  const { data: userData } = await supabase
    .from("users")
    .select("org_unit_id, org_units(id, name, display_name)")
    .eq("id", user.id)
    .single()

  const dept = (userData?.org_units as any)
  const deptId = userData?.org_unit_id

  // Get programmes in this dept
  const { count: programmeCount } = await supabase
    .from("academic_programs")
    .select("id", { count: "exact", head: true })
    .eq("dept_id", deptId ?? "")

  // Get faculty count in dept
  const { count: facultyCount } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("org_unit_id", deptId ?? "")

  // Get subject count
  const programIds = (await supabase
    .from("academic_programs")
    .select("id")
    .eq("dept_id", deptId ?? "")).data?.map((p: any) => p.id) ?? []

  const { count: subjectCount } = programIds.length > 0
    ? await supabase.from("subjects").select("id", { count: "exact", head: true }).in("program_id", programIds)
    : { count: 0 }

  // Active timetable slots
  const assignmentIds = (await supabase
    .from("subject_assignments")
    .select("id")
    .eq("organization_id", user.organizationId ?? "")).data?.map((a: any) => a.id) ?? []

  const { count: slotCount } = assignmentIds.length > 0
    ? await supabase.from("timetable_slots").select("id", { count: "exact", head: true })
        .in("subject_assignment_id", assignmentIds).eq("is_active", true)
    : { count: 0 }

  const stats = [
    { label: "Programmes",        value: programmeCount ?? 0, color: "text-violet-400" },
    { label: "Faculty",           value: facultyCount ?? 0,   color: "text-sky-400" },
    { label: "Subjects",          value: subjectCount ?? 0,   color: "text-emerald-400" },
    { label: "Active Time Slots", value: slotCount ?? 0,      color: "text-amber-400" },
  ]

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          {dept?.display_name ?? dept?.name ?? "Department"} Admin
        </h1>
        <p className="text-sm text-white/50 mt-0.5">
          Configure programmes, subjects, batches, and timetable for your department
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="text-[11px] text-white/40 uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6">
        <h2 className="text-[14px] font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { label: "Manage Programmes",  desc: "Add / edit academic programmes",           href: "programmes" },
            { label: "Configure Subjects", desc: "Assign subjects per programme & semester",  href: "subjects" },
            { label: "Manage Batches",     desc: "Define year/section batches",              href: "batches" },
            { label: "Build Timetable",    desc: "Assign faculty to periods",                href: "timetable" },
            { label: "Bulk Import Faculty",desc: "Upload CSV, auto-create users",             href: "import" },
          ].map((action) => (
            <a
              key={action.href}
              href={action.href}
              className="flex flex-col gap-0.5 rounded-xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/30 px-4 py-3.5 transition-all group"
            >
              <span className="text-[13px] font-semibold text-white group-hover:text-violet-300 transition-colors">{action.label}</span>
              <span className="text-[11px] text-white/40">{action.desc}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
