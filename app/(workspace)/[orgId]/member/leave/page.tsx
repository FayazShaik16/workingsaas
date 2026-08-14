import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"

export default async function LeaveRequestPage() {
  const user = await requireAuth()
  const supabase = await createClient()

  // Fetch this user's HOD (lead of their org_unit)
  const { data: userData } = await supabase
    .from("users")
    .select("org_unit_id")
    .eq("id", user.id)
    .single()

  let hodId: string | null = null
  if (userData?.org_unit_id) {
    const { data: hod } = await supabase
      .from("users")
      .select("id, name")
      .eq("org_unit_id", userData.org_unit_id)
      .in("id", (
        await supabase
          .from("user_roles")
          .select("user_id")
          .in("role_id", (
            await supabase
              .from("roles")
              .select("id")
              .eq("scope_level", "ORG_UNIT_LEAD")
          ).data?.map((r: any) => r.id) ?? [])
      ).data?.map((ur: any) => ur.user_id) ?? [])
      .limit(1)
      .maybeSingle()
    hodId = hod?.id ?? null
  }

  // Fetch existing leave requests
  const { data: leaveHistory } = await supabase
    .from("leave_requests")
    .select("id, leave_date, leave_type, reason, status, hod_note, created_at, decided_at")
    .eq("faculty_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20)

  const statusColor: Record<string, string> = {
    PENDING:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    APPROVED: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    REJECTED: "text-red-400 bg-red-500/10 border-red-500/20",
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Leave Request</h1>
        <p className="text-sm text-white/50 mt-0.5">Request leave for a scheduled day — your HOD will approve or reject</p>
      </div>

      {/* Submit form — uses server action */}
      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-6 space-y-4">
        <h2 className="text-[14px] font-semibold text-white">New Leave Request</h2>

        {!hodId ? (
          <div className="text-sm text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
            No HOD assigned to your department yet. Contact a System Admin.
          </div>
        ) : (
          <form
            action={async (fd: FormData) => {
              "use server"
              const { createClient: sc } = await import("@/lib/supabase/server")
              const { requireAuth: ra } = await import("@/lib/auth/protect")
              const supabase = await sc()
              const u = await ra()
              const leaveDate = fd.get("leave_date") as string
              const leaveType = fd.get("leave_type") as string
              const reason = fd.get("reason") as string
              const hId = fd.get("hod_id") as string
              if (!leaveDate || !reason || !hId) return
              await supabase.from("leave_requests").insert({
                faculty_id: u.id,
                hod_id: hId,
                organization_id: u.organizationId,
                leave_date: leaveDate,
                leave_type: leaveType,
                reason,
              })
            }}
            className="space-y-4"
          >
            <input type="hidden" name="hod_id" value={hodId} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Date</label>
                <input
                  type="date"
                  name="leave_date"
                  required
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 focus:bg-white/[0.06] transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Type</label>
                <select
                  name="leave_type"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors appearance-none"
                >
                  <option value="PERSONAL">Personal</option>
                  <option value="MEDICAL">Medical</option>
                  <option value="SYLLABUS_COMPLETED">Syllabus Completed</option>
                  <option value="DUTY_LEAVE">Duty Leave</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-white/50 uppercase tracking-wider">Reason</label>
              <textarea
                name="reason"
                required
                rows={3}
                placeholder="Briefly describe the reason for leave..."
                className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors resize-none placeholder:text-white/25"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
            >
              Submit Request
            </button>
          </form>
        )}
      </div>

      {/* History */}
      {(leaveHistory ?? []).length > 0 && (
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/[0.05]">
            <h2 className="text-[13px] font-semibold text-white">Request History</h2>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {leaveHistory!.map((lr) => (
              <div key={lr.id} className="px-5 py-3.5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] font-medium text-white">
                    {new Date(lr.leave_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                    <span className="ml-2 text-white/40 font-normal text-[11px]">{lr.leave_type?.replace("_", " ")}</span>
                  </p>
                  <p className="text-[11px] text-white/40 mt-0.5 line-clamp-1">{lr.reason}</p>
                  {lr.hod_note && (
                    <p className="text-[11px] text-white/30 mt-0.5 italic">HOD: {lr.hod_note}</p>
                  )}
                </div>
                <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-semibold uppercase tracking-wider ${statusColor[lr.status] ?? "text-white/40 bg-white/[0.05] border-white/[0.08]"}`}>
                  {lr.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
