import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { LeadDashboardContainer } from "@/components/lead/lead-dashboard-container"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()

  // 1. Fetch user profile & department details
  const { data: profile } = await admin
    .from("users")
    .select("name, designation, progress_percentage, org_unit_id, org_units(name)")
    .eq("id", user.id)
    .single()

  let deptId = profile?.org_unit_id
  let deptName = (profile?.org_units as any)?.name || ""

  // Fallback to first department in organization if user has no org_unit_id (e.g. Director inspecting)
  if (!deptId) {
    const { data: firstUnit } = await admin
      .from("org_units")
      .select("id, name")
      .eq("organization_id", orgId)
      .limit(1)
      .maybeSingle()

    if (firstUnit) {
      deptId = firstUnit.id
      deptName = firstUnit.name
    } else {
      deptName = "Department Portal"
    }
  }

  const personalProgress = Math.round(Number(profile?.progress_percentage ?? 0))

  // 2. Fetch monthly target from compensation policy
  const { data: compensation } = await admin
    .from("compensation_policies")
    .select("monthly_target_credits")
    .eq("organization_id", orgId)
    .eq("scope_type", "ORG_WIDE")
    .maybeSingle()

  const targetTokens = compensation?.monthly_target_credits || 50

  // 3. Fetch personal earned tokens from wallet
  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", user.id)
    .eq("purpose", "PERSONAL")
    .maybeSingle()

  const earnedTokens = Number(wallet?.balance || 0)

  // 4. Fetch structured tasks (schedule sessions / lectures)
  const { data: scheduleTasks } = await admin
    .from("tasks")
    .select("id, title, token_value, status, deadline, description")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .in("status", ["ASSIGNED", "IN_PROGRESS", "CLOSED"])

  const schedule = (scheduleTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    credit_value: Number(t.token_value || 0),
    status: t.status,
    deadline: t.deadline,
    description: t.description,
  }))

  // 5. Fetch pending task verifications within department
  const { data: pendingTasks } = await admin
    .from("tasks")
    .select(`
      id,
      title,
      token_value,
      assigned_to_id,
      created_at,
      users:assigned_to_id (name, org_units:org_unit_id(name))
    `)
    .eq("organization_id", orgId)
    .in("status", ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"])

  const initialVerifications = (pendingTasks || []).map((t: any) => ({
    id: t.id,
    submittedBy: t.users?.name || "Faculty Member",
    deptName: (t.users?.org_units as any)?.name || deptName,
    taskTitle: t.title,
    reward: Number(t.token_value || 0),
    submittedAt: t.created_at
      ? new Date(t.created_at).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "",
  }))

  // 6. Fetch all department faculty members & their current progress metrics
  const { data: departmentMembers } = await admin
    .from("users")
    .select(`
      id,
      name,
      designation,
      progress_percentage,
      wallets(purpose, balance)
    `)
    .eq("organization_id", orgId)
    .eq(deptId ? "org_unit_id" : "organization_id", deptId || orgId)
    .eq("status", "ACTIVE")

  const initialApprovals = (departmentMembers || []).map((m: any) => {
    const personalWallet = m.wallets?.find((w: any) => w.purpose === "PERSONAL")
    return {
      id: m.id,
      name: m.name,
      designation: m.designation || "Faculty Member",
      progress: Math.round(Number(m.progress_percentage || 0)),
      tokens: Number(personalWallet?.balance || 0),
    }
  })

  return (
    <div className="p-8 min-h-screen bg-linear-to-b from-background to-muted/20">
      <LeadDashboardContainer
        initialApprovals={initialApprovals}
        initialVerifications={initialVerifications}
        personalProgress={personalProgress}
        earnedTokens={earnedTokens}
        targetTokens={targetTokens}
        orgId={orgId}
        deptName={deptName}
        schedule={schedule}
      />
    </div>
  )
}
