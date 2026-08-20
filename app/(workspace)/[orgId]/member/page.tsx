import { requireAuth } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  MinimalFacultyDashboard,
  ScheduledLectureTask,
  AssignedUnscheduledTask,
} from "@/components/member/minimal-faculty-dashboard"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch user profile
  const { data: profile } = await db
    .from("users")
    .select("name, designation, progress_percentage, target_credits")
    .eq("id", user.id)
    .maybeSingle()

  const userName = profile?.name || "Faculty Member"
  const userDesignation = profile?.designation || "Teaching Staff"

  // 2. Fetch monthly target from user record with compensation policy fallback
  const { data: compensation } = await db
    .from("compensation_policies")
    .select("monthly_target_credits")
    .eq("organization_id", orgId)
    .eq("scope_type", "ORG_WIDE")
    .maybeSingle()

  const monthlyTarget =
    profile?.target_credits !== null && profile?.target_credits !== undefined
      ? Number(profile.target_credits)
      : compensation?.monthly_target_credits
      ? Number(compensation.monthly_target_credits)
      : 60.0

  // 3. Fetch user's credit balance from PERSONAL wallet
  const { data: wallet } = await db
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", user.id)
    .eq("purpose", "PERSONAL")
    .maybeSingle()

  const earnedTokens = Number(wallet?.balance || 0)

  // 4. Fetch scheduled tasks (lectures / sessions) assigned to this faculty
  const { data: rawScheduleTasks } = await db
    .from("tasks")
    .select("id, title, description, credit_value, status, deadline, priority")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .eq("category", "STRUCTURED")
    .order("created_at", { ascending: false })

  const scheduledTasks: ScheduledLectureTask[] = (rawScheduleTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    creditValue: Number(t.credit_value || 1.0),
    status: t.status,
    deadline: t.deadline,
    description: t.description,
  }))

  // 5. Fetch assigned unscheduled / institutional tasks assigned to this faculty
  const { data: rawAssignedTasks } = await db
    .from("tasks")
    .select("id, title, description, credit_value, status, deadline, priority, category")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .neq("category", "STRUCTURED")
    .order("created_at", { ascending: false })

  const assignedTasks: AssignedUnscheduledTask[] = (rawAssignedTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    creditValue: Number(t.credit_value || 5.0),
    priority: t.priority || "MEDIUM",
    status: t.status,
    deadline: t.deadline,
    category: t.category,
  }))

  return (
    <div className="p-6 md:p-8 min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <MinimalFacultyDashboard
        orgId={orgId}
        userId={user.id}
        userName={userName}
        userDesignation={userDesignation}
        earnedTokens={earnedTokens}
        monthlyTarget={monthlyTarget}
        scheduledTasks={scheduledTasks}
        assignedTasks={assignedTasks}
      />
    </div>
  )
}
