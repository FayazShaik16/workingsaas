import { requireAuth, requireScope } from "@/lib/auth/protect"
import { getDirectorSelfTasksAudit } from "@/lib/workledger/self-tasks"
import { DirectorSelfTasksAuditView } from "@/components/director/director-self-tasks-audit-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorSelfTasksPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const { summary, allTasks } = await getDirectorSelfTasksAudit(orgId)

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <DirectorSelfTasksAuditView orgId={orgId} summary={summary} tasks={allTasks} />
    </div>
  )
}
