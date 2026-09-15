import { requireAuth } from "@/lib/auth/protect"
import { getFacultySelfTasks } from "@/lib/workledger/self-tasks"
import { FacultySelfTasksView } from "@/components/member/faculty-self-tasks-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function MemberSelfTasksPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()

  const tasks = await getFacultySelfTasks(orgId, user.id)

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <FacultySelfTasksView orgId={orgId} tasks={tasks} facultyName={user.name || "Faculty Member"} />
    </div>
  )
}
