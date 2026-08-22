import { requireAuth, requireRole } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { LegacyCleanupClient } from "@/components/admin/legacy-cleanup-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigCleanupPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireRole("SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch all units in the organization
  const { data: units } = await db
    .from("org_units")
    .select("id, name, unit_type, created_at")
    .eq("organization_id", orgId)

  // 2. Identify candidates (Main, Root, General)
  const candidateNames = ["main", "root", "general", "main department", "root department"]
  const candidates = (units || []).filter((u: any) =>
    candidateNames.includes(u.name.trim().toLowerCase())
  )

  // 3. For each candidate, check linked users, tasks, and templates
  const previewItems = []
  for (const c of candidates) {
    const [{ count: userCount }, { count: taskCount }, { count: tmplCount }] = await Promise.all([
      db.from("users").select("id", { count: "exact", head: true }).eq("org_unit_id", c.id),
      db.from("tasks").select("id", { count: "exact", head: true }).eq("org_unit_id", c.id),
      db.from("scheduled_work_templates").select("id", { count: "exact", head: true }).eq("org_unit_id", c.id),
    ])

    const totalDeps = (userCount || 0) + (taskCount || 0) + (tmplCount || 0)
    previewItems.push({
      id: c.id,
      name: c.name,
      unitType: c.unit_type,
      userCount: userCount || 0,
      taskCount: taskCount || 0,
      tmplCount: tmplCount || 0,
      canAutoDelete: totalDeps === 0,
      createdAt: c.created_at,
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Legacy Setup Cleanup</h1>
        <p className="text-xs text-muted-foreground">
          Audit and safely retire artificial legacy departments (e.g. &quot;Main&quot;, &quot;Root&quot;, &quot;General&quot;) without risking accidental data loss of active members or schedules.
        </p>
      </div>

      <LegacyCleanupClient
        orgId={orgId}
        initialPreview={previewItems}
      />
    </div>
  )
}
