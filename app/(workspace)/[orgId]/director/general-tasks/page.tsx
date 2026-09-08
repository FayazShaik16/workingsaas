import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getDepartmentGeneralProductivity } from "@/lib/workledger/general-tasks"
import { GeneralTasksManagerView } from "@/components/general-tasks/general-tasks-manager-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorGeneralTasksPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch departments in organization
  const { data: rawDepts } = await db
    .from("org_units")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  const departments = (rawDepts || []).map((d: any) => ({
    id: d.id,
    name: d.name,
  }))

  // 2. Fetch org-wide productivity, roster, and pending approvals
  const { summary, facultyRoster, pendingApprovals, templates } =
    await getDepartmentGeneralProductivity(orgId, undefined)

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <GeneralTasksManagerView
        orgId={orgId}
        roleTitle="Director"
        scopeName="Executive Campus Overview"
        summary={summary}
        facultyRoster={facultyRoster}
        pendingApprovals={pendingApprovals}
        templates={templates}
        departments={departments}
      />
    </div>
  )
}
