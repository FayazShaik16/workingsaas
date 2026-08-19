import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTeachingStaff } from "@/lib/queries/teaching-staff"
import { LeadDashboardContainer } from "@/components/lead/lead-dashboard-container"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()

  // 1. Fetch current user profile & unit name
  const { data: userProfile } = await admin
    .from("users")
    .select(`
      id,
      name,
      org_unit_id,
      target_credits,
      progress_percentage,
      org_units (id, name)
    `)
    .eq("id", user.id)
    .single()

  const deptId = userProfile?.org_unit_id || user.orgUnitId
  const deptName = (userProfile?.org_units as any)?.name || "Academic Department"
  const personalProgress = Math.round(Number(userProfile?.progress_percentage || 0))
  const targetTokens =
    userProfile?.target_credits !== null && userProfile?.target_credits !== undefined
      ? Number(userProfile.target_credits)
      : 0

  // 2. Fetch personal earned tokens from wallet
  const { data: wallet } = await admin
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", user.id)
    .eq("purpose", "PERSONAL")
    .maybeSingle()

  const earnedTokens = Number(wallet?.balance || 0)

  // 3. Fetch structured tasks (schedule sessions / lectures) for HOD's own teaching commitments
  const { data: scheduleTasks } = await admin
    .from("tasks")
    .select("id, title, credit_value, status, deadline, description")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .in("status", ["ASSIGNED", "IN_PROGRESS", "CLOSED"])

  const schedule = (scheduleTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    credit_value: Number(t.credit_value || 0),
    status: t.status,
    deadline: t.deadline,
    description: t.description,
  }))

  // 4. Fetch pending task verifications within department (standardized on credit_value)
  let pendingTasksQuery = admin
    .from("tasks")
    .select(`
      id,
      title,
      credit_value,
      assigned_to_id,
      created_at,
      users:assigned_to_id (name, org_units:org_unit_id(name))
    `)
    .eq("organization_id", orgId)
    .in("status", ["VERIFICATION_PENDING", "PENDING_VERIFICATION", "SUBMITTED", "IN_REVIEW"])

  if (deptId) {
    pendingTasksQuery = pendingTasksQuery.eq("org_unit_id", deptId)
  }

  const { data: pendingTasks } = await pendingTasksQuery

  const initialVerifications = (pendingTasks || []).map((t: any) => ({
    id: t.id,
    submittedBy: t.users?.name || "Faculty Member",
    deptName: (t.users?.org_units as any)?.name || deptName,
    taskTitle: t.title,
    reward: Number(t.credit_value || 0),
    submittedAt: t.created_at
      ? new Date(t.created_at).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
      : "",
  }))

  // 5. Fetch all department teaching staff & their current progress metrics
  const departmentTeachingStaff = await getTeachingStaff(admin, orgId, deptId || undefined)

  // Fetch wallets for teaching staff to show live earned credits
  const staffIds = departmentTeachingStaff.map((s) => s.id)
  const { data: staffWallets } = await admin
    .from("wallets")
    .select("owner_user_id, balance")
    .in("owner_user_id", staffIds.length > 0 ? staffIds : ["00000000-0000-0000-0000-000000000000"])
    .eq("purpose", "PERSONAL")

  const walletMap = new Map((staffWallets || []).map((w: any) => [w.owner_user_id, Number(w.balance || 0)]))

  const initialApprovals = departmentTeachingStaff.map((m) => ({
    id: m.id,
    name: m.name,
    designation: m.designation || "Faculty Member",
    progress: Math.round(Number(m.progress_percentage || 0)),
    tokens: walletMap.get(m.id) || 0,
  }))

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
