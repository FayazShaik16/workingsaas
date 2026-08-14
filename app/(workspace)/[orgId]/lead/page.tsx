import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { LeadDashboardContainer } from "@/components/lead/lead-dashboard-container"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD")

  const supabase = await createClient()

  // 1. Fetch HOD profile & department details
  const { data: profile } = await supabase
    .from("users")
    .select("name, designation, progress_percentage, org_unit_id, org_units(name)")
    .eq("id", user.id)
    .single()

  const deptId = profile?.org_unit_id
  const deptName = profile?.org_units?.name || "Department Portal"
  const personalProgress = Math.round(Number(profile?.progress_percentage ?? 0))

  // 2. Fetch monthly target from compensation policy
  const { data: compensation } = await supabase
    .from("compensation_policies")
    .select("monthly_target_credits")
    .eq("organization_id", orgId)
    .eq("scope_type", "ORG_WIDE")
    .single()

  const targetTokens = compensation?.monthly_target_credits || 50

  // 3. Fetch personal earned tokens from wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", user.id)
    .eq("purpose", "PERSONAL")
    .single()

  const earnedTokens = wallet?.balance || 0

  // 4. Fetch HOD's structured tasks (personal schedule)
  const { data: scheduleTasks } = await supabase
    .from("tasks")
    .select("id, title, credit_value, status, deadline, description")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .eq("category", "STRUCTURED")
    .in("status", ["ASSIGNED", "IN_PROGRESS", "CLOSED"])

  const schedule = (scheduleTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    credit_value: Number(t.credit_value),
    status: t.status,
    deadline: t.deadline,
    description: t.description
  }))

  // 5. Fetch pending task verifications within HOD's department (unstructured)
  const { data: pendingTasks } = await supabase
    .from("tasks")
    .select(`
      id,
      title,
      credit_value,
      assigned_to_id,
      users:assigned_to_id (name, org_units:org_unit_id(name))
    `)
    .eq("status", "VERIFICATION_PENDING")
    .eq("category", "UNSTRUCTURED")
    .eq("organization_id", orgId)
    .eq("org_unit_id", deptId)

  const initialVerifications = (pendingTasks || []).map((t: any) => ({
    id: t.id,
    submittedBy: t.users?.name || "Faculty Member",
    deptName: t.users?.org_units?.name || deptName,
    taskTitle: t.title,
    reward: t.credit_value,
    submittedAt: t.created_at ? new Date(t.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""
  }))

  // 6. Fetch all department faculty members & their current progress metrics
  const { data: departmentMembers } = await supabase
    .from("users")
    .select(`
      id,
      name,
      designation,
      progress_percentage,
      wallets(balance)
    `)
    .eq("org_unit_id", deptId)
    .eq("status", "ACTIVE")

  const initialApprovals = (departmentMembers || []).map((m: any) => {
    const personalWallet = m.wallets?.find((w: any) => w.purpose === "PERSONAL")
    return {
      id: m.id,
      name: m.name,
      designation: m.designation || "Faculty Member",
      progress: Math.round(Number(m.progress_percentage || 0)),
      tokens: personalWallet?.balance || 0
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
