import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { MemberProgress } from "@/components/member/member-progress"
import { MemberCommitments } from "@/components/member/member-commitments"
import { MemberMarketplace } from "@/components/member/member-marketplace"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberDashboardPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  const supabase = await createClient()

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from("users")
    .select("name, designation, progress_percentage, target_credits")
    .eq("id", user.id)
    .single()

  const userName = profile?.name || "Faculty Member"

  // 2. Fetch monthly target from user record with compensation policy fallback
  const { data: compensation } = await supabase
    .from("compensation_policies")
    .select("monthly_target_credits")
    .eq("organization_id", orgId)
    .eq("scope_type", "ORG_WIDE")
    .single()

  const monthlyTarget =
    profile?.target_credits !== null && profile?.target_credits !== undefined
      ? Number(profile.target_credits)
      : compensation?.monthly_target_credits
      ? Number(compensation.monthly_target_credits)
      : 0

  // 3. Fetch user's credit balance from PERSONAL wallet
  const { data: wallet } = await supabase
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", user.id)
    .eq("purpose", "PERSONAL")
    .single()

  const earnedTokens = wallet?.balance || 0

  // 4. Fetch user's active commitments (unstructured tasks assigned to them)
  const { data: activeTasks } = await supabase
    .from("tasks")
    .select("id, title, credit_value, deadline, status")
    .eq("organization_id", orgId)
    .eq("assigned_to_id", user.id)
    .eq("category", "UNSTRUCTURED")
    .in("status", ["ASSIGNED", "IN_PROGRESS", "VERIFICATION_PENDING"])

  const commitments = (activeTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    reward: t.credit_value,
    status: t.status,
    deadline: t.deadline
  }))

  // 5. Fetch user's structured tasks (schedule sessions / lectures)
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

  // 6. Fetch outstanding loan details
  const { data: userLoan } = await supabase
    .from("loans")
    .select("amount, created_at")
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .single()

  const activeLoanAmount = userLoan?.amount || 0
  const loanDueDate = userLoan?.created_at || null

  // 7. Fetch open unstructured tasks from marketplace
  const { data: openTasks } = await supabase
    .from("tasks")
    .select("id, title, credit_value, organization_id")
    .eq("status", "OPEN")
    .eq("category", "UNSTRUCTURED")
    .eq("organization_id", orgId)
    .limit(6)

  const initialMarketplaceTasks = (openTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    reward: t.credit_value,
    volunteers: 3
  }))

  const progressPercent = Math.min(100, Math.round((earnedTokens / monthlyTarget) * 100))

  return (
    <div className="space-y-8 p-8 min-h-screen bg-linear-to-b from-background to-muted/20">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 rounded-2xl border border-muted/80 bg-background/50 backdrop-blur-xs shadow-2xs gap-4">
        <div>
          <h1 className="text-2xl font-light text-foreground/90">Welcome, {userName}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Faculty Work Accountability portal</p>
        </div>
        <div className="flex items-center gap-6 text-xs text-muted-foreground font-light">
          <div>
            <span className="block font-medium text-foreground/80">Monthly Target</span>
            <span>{monthlyTarget} tokens</span>
          </div>
          <div className="h-8 w-[1px] bg-muted" />
          <div>
            <span className="block font-medium text-foreground/80">Earned</span>
            <span className="text-primary font-semibold">{earnedTokens} tokens</span>
          </div>
          <div className="h-8 w-[1px] bg-muted" />
          <div>
            <span className="block font-medium text-foreground/80">Progress</span>
            <span className="text-green-600 font-semibold">{progressPercent}%</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT COLUMN: Week's Schedule & Commitments */}
        <div className="lg:col-span-2 space-y-6">
          <MemberCommitments commitments={commitments} schedule={schedule} orgId={orgId} />
        </div>

        {/* RIGHT COLUMN: Progress Circle, Balance, Loan Alert */}
        <div className="space-y-6">
          <MemberProgress
            earnedTokens={earnedTokens}
            monthlyTarget={monthlyTarget}
            activeLoanAmount={activeLoanAmount}
            loanDueDate={loanDueDate}
            orgId={orgId}
            userId={user.id}
          />
        </div>
      </div>

      {/* Open Unstructured Tasks */}
      <MemberMarketplace initialTasks={initialMarketplaceTasks} userId={user.id} />
      
    </div>
  )
}
