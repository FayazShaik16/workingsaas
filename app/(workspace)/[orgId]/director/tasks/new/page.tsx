import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { TaskCreatorWizard } from "@/components/marketplace/task-creator-wizard"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorNewTaskPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()
  const db = supabase as any

  // Fetch all departments in this organization
  const { data: orgUnits } = await db
    .from("org_units")
    .select("id, name")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  return (
    <div className="p-6 md:p-8">
      <TaskCreatorWizard
        orgId={orgId}
        role="DIRECTOR"
        orgUnits={orgUnits || []}
        defaultOrgUnitId={user.orgUnitId || undefined}
      />
    </div>
  )
}
