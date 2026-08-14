import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export default async function MemberSchedulePage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch this faculty's timetable assignments
  const { data: assignments } = await supabase
    .from("subject_assignments")
    .select(`
      id,
      academic_year,
      subjects(code, name, credits, subject_type),
      academic_batches(section, year_of_study, current_semester, academic_programs(name, code)),
      timetable_slots(id, day_of_week, period_number, start_time, end_time, room, is_active)
    `)
    .eq("faculty_id", user.id)
    .eq("is_active", true)

  const days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
  const dayLabels: Record<string, string> = {
    MON: "Monday", TUE: "Tuesday", WED: "Wednesday",
    THU: "Thursday", FRI: "Friday", SAT: "Saturday",
  }

  // Build a day → slots map
  type SlotEntry = {
    period: number
    startTime: string
    endTime: string
    room: string | null
    subjectCode: string
    subjectName: string
    batch: string
    semester: number
    programme: string
  }
  const schedule: Record<string, SlotEntry[]> = {}
  days.forEach((d) => (schedule[d] = []))

  for (const assignment of assignments ?? []) {
    for (const slot of (assignment.timetable_slots as any[]) ?? []) {
      if (!slot.is_active) continue
      const subject = assignment.subjects as any
      const batch = assignment.academic_batches as any
      const program = batch?.academic_programs as any
      schedule[slot.day_of_week]?.push({
        period: slot.period_number,
        startTime: slot.start_time?.slice(0, 5),
        endTime: slot.end_time?.slice(0, 5),
        room: slot.room,
        subjectCode: subject?.code ?? "",
        subjectName: subject?.name ?? "",
        batch: `${program?.code ?? ""} ${batch?.year_of_study ?? ""}Y-${batch?.section ?? ""}`,
        semester: batch?.current_semester ?? 0,
        programme: program?.name ?? "",
      })
    }
  }

  // Sort each day by period number
  days.forEach((d) => schedule[d].sort((a, b) => a.period - b.period))

  const totalSlots = Object.values(schedule).flat().length

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Schedule</h1>
        <p className="text-sm text-white/50 mt-0.5">
          Your weekly timetable — {totalSlots} active slot{totalSlots !== 1 ? "s" : ""} this semester
        </p>
      </div>

      {totalSlots === 0 ? (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-12 text-center">
          <p className="text-white/40 text-sm">No timetable assigned yet. Contact your Dept Admin.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {days.map((day) => {
            const slots = schedule[day]
            if (slots.length === 0) return null
            return (
              <div key={day} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                <div className="px-5 py-3 border-b border-white/[0.05] flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-violet-400 uppercase tracking-widest">{dayLabels[day]}</span>
                  <span className="text-[11px] text-white/30">{slots.length} period{slots.length > 1 ? "s" : ""}</span>
                </div>
                <div className="divide-y divide-white/[0.04]">
                  {slots.map((slot, i) => (
                    <div key={i} className="px-5 py-3.5 flex items-center gap-4">
                      <div className="w-16 flex-shrink-0 text-center">
                        <p className="text-[11px] text-white/35">{slot.startTime}</p>
                        <p className="text-[11px] text-white/20">–</p>
                        <p className="text-[11px] text-white/35">{slot.endTime}</p>
                      </div>
                      <div className="w-px h-10 bg-white/[0.06]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-white truncate">
                          {slot.subjectCode} — {slot.subjectName}
                        </p>
                        <p className="text-[11px] text-white/40">{slot.batch} · Sem {slot.semester}</p>
                      </div>
                      {slot.room && (
                        <span className="flex-shrink-0 px-2.5 py-1 rounded-lg bg-white/[0.05] text-[11px] text-white/50 border border-white/[0.07]">
                          {slot.room}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
