import { requireAuth } from "@/lib/auth/protect"
import { getGeneralTaskTemplates, getFacultyGeneralTaskLogs } from "@/lib/workledger/general-tasks"
import { MemberGeneralTasksView } from "@/components/member/member-general-tasks-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberGeneralTasksPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()

  // Fetch general task templates available to faculty's department / org-wide
  const templates = await getGeneralTaskTemplates(orgId, user.orgUnitId)
  const logs = await getFacultyGeneralTaskLogs(orgId, user.id)

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <MemberGeneralTasksView
        orgId={orgId}
        templates={templates}
        logs={logs}
        facultyName={user.name || "Faculty Member"}
      />
    </div>
  )
}
