import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { WorkCyclesManagerClient } from "@/components/admin/work-cycles-manager-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export const metadata = {
  title: "Work Cycles Management | System Admin",
  description: "Configure and manage dynamic institutional work cycles, formulas, and salary authorization gates.",
}

export default async function SystemAdminWorkCyclesPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("SYSTEM_ADMIN", "DIRECTOR")

  const admin = createAdminClient()
  const db = admin as any

  // Fetch all work cycles for this organization ordered by start date
  const { data: cycles } = await db
    .from("work_cycles")
    .select("*")
    .eq("organization_id", orgId)
    .order("starts_on", { ascending: false })

  return (
    <WorkCyclesManagerClient
      orgId={orgId}
      initialCycles={cycles || []}
    />
  )
}
