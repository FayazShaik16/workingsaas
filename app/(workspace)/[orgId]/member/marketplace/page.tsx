import { requireAuth } from "@/lib/auth/protect"
import { getScopedTaskPool } from "@/lib/workledger/task-pool"
import { getMemberMonthlyProgress } from "@/lib/workledger/progress"
import { MarketplaceDiscoveryGrid, MarketplaceTask } from "@/components/marketplace/marketplace-discovery-grid"
import { Sparkles } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberMarketplacePage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()

  // 1. Fetch user's live progress contract
  const progress = await getMemberMonthlyProgress(orgId, user.id)

  // 2. Fetch scoped tasks for user's department
  const tasks = await getScopedTaskPool(orgId, user.id, user.orgUnitId ?? null)

  const formattedTasks: MarketplaceTask[] = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description || null,
    credit_value: t.creditValue,
    category: "UNSTRUCTURED",
    priority: t.priority,
    status: t.status,
    visibility_scope: t.visibilityScope,
    deadline: t.deadline || null,
    created_at: new Date().toISOString(),
    org_unit_name: t.orgUnitName || undefined,
    org_unit_id: t.orgUnitId || undefined,
    applied_by_user: t.isNominatedByMe,
  }))

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Task Pool & Initiatives
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Explore open department tasks, committee roles, and institutional initiatives to earn monthly WORK credits.
        </p>
      </div>

      {/* Discovery Grid */}
      <MarketplaceDiscoveryGrid
        orgId={orgId}
        userId={user.id}
        tasks={formattedTasks}
        isProgressConfigured={progress.configured}
      />
    </div>
  )
}
