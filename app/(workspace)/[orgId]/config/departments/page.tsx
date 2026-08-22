import { requireAuth, requireRole } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { DepartmentManagerClient } from "@/components/admin/department-manager-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigDepartmentsPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireRole("SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch departments
  const { data: deptData } = await db
    .from("org_units")
    .select(`
      id,
      name,
      code,
      unit_type,
      lead_user_id,
      created_at,
      users!users_org_unit_id_fkey(id, name, email)
    `)
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  // 2. Fetch all users for lead assignment dropdown
  const { data: allUsers } = await db
    .from("users")
    .select("id, name, email, designation")
    .eq("organization_id", orgId)
    .order("name", { ascending: true })

  const departments = (deptData || []).map((d: any) => ({
    id: d.id,
    name: d.name,
    code: d.code || d.name.slice(0, 4).toUpperCase(),
    leadUserId: d.lead_user_id,
    leadName: (allUsers || []).find((u: any) => u.id === d.lead_user_id)?.name || "Unassigned",
    memberCount: (d.users || []).length,
    createdAt: d.created_at,
  }))

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Department Management</h1>
        <p className="text-xs text-muted-foreground">
          Define institutional academic departments, assign department leads (HODs), and manage organizational units.
        </p>
      </div>

      <DepartmentManagerClient
        orgId={orgId}
        initialDepartments={departments}
        availableUsers={allUsers || []}
      />
    </div>
  )
}
