import { requireAuth } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { MarketplaceDiscoveryGrid, MarketplaceTask } from "@/components/marketplace/marketplace-discovery-grid"
import { Sparkles } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberMarketplacePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  const supabase = await createClient()
  const db = supabase as any

  // 1. Fetch user progress & targets
  const { data: userProfile } = await db
    .from("users")
    .select("id, name, target_credits, progress_percentage")
    .eq("id", user.id)
    .single()

  const targetCredits = Number(userProfile?.target_credits || 50.0)

  // 2. Fetch user's earned credits from personal wallet
  const { data: wallet } = await db
    .from("wallets")
    .select("balance")
    .eq("owner_user_id", user.id)
    .eq("purpose", "PERSONAL")
    .limit(1)
    .maybeSingle()

  const earnedCredits = Number(wallet?.balance || 0)
  const progressPercentage = targetCredits > 0 ? (earnedCredits / targetCredits) * 100 : 0

  // 3. Fetch all OPEN unstructured marketplace tasks in this organization
  const { data: rawTasks } = await db
    .from("tasks")
    .select(`
      id,
      title,
      description,
      credit_value,
      token_value,
      category,
      status,
      deadline,
      created_at,
      creator:creator_id (name),
      org_units (id, name)
    `)
    .eq("organization_id", orgId)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })

  // 4. Fetch tasks user has already applied for
  const { data: userApplications } = await db
    .from("task_applications")
    .select("task_id")
    .eq("user_id", user.id)

  const appliedTaskIds = new Set((userApplications || []).map((a: any) => a.task_id))

  const formattedTasks: MarketplaceTask[] = (rawTasks || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    credit_value: Number(t.credit_value || t.token_value || 1.0),
    token_value: Number(t.token_value || t.credit_value || 1.0),
    category: t.category,
    status: t.status,
    deadline: t.deadline,
    created_at: t.created_at,
    creator_name: t.creator?.name || "Department Lead",
    org_unit_name: t.org_units?.name || "Institutional Pool",
    org_unit_id: t.org_units?.id,
    applied_by_user: appliedTaskIds.has(t.id),
  }))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          Open Task Marketplace
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Discover unstructured departmental tasks, self-nominate for accreditation & committee work, and accelerate your monthly credit target.
        </p>
      </div>

      <MarketplaceDiscoveryGrid
        orgId={orgId}
        userId={user.id}
        userProgress={progressPercentage}
        userEarnedCredits={earnedCredits}
        userTargetCredits={targetCredits}
        tasks={formattedTasks}
      />
    </div>
  )
}
