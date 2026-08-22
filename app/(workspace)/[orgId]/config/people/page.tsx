import { requireAuth, requireRole } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { PeopleManagerClient } from "@/components/admin/people-manager-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigPeoplePage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireRole("SYSTEM_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch all users with roles and departments
  const [
    { data: users },
    { data: userRoles },
    { data: departments },
  ] = await Promise.all([
    db.from("users").select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
    db.from("user_roles").select("user_id, role_id, roles(id, name, scope_level)"),
    db.from("org_units").select("id, name, code").eq("organization_id", orgId).order("name", { ascending: true }),
  ])

  const allRoles = userRoles || []
  const allDepts = departments || []

  const formattedUsers = (users || []).map((u: any) => {
    const userRoleMappings = allRoles.filter((r: any) => r.user_id === u.id)
    const scopeLevels = userRoleMappings.map((r: any) => r.roles?.scope_level).filter(Boolean)
    const roleNames = userRoleMappings.map((r: any) => r.roles?.name || r.roles?.scope_level).filter(Boolean)
    const dept = allDepts.find((d: any) => d.id === u.org_unit_id)

    return {
      id: u.id,
      name: u.name || "Member",
      email: u.email,
      designation: u.designation || "Faculty / Staff",
      departmentId: u.org_unit_id,
      departmentName: dept?.name || "None (Global)",
      departmentCode: dept?.code,
      scopeLevels: scopeLevels.length > 0 ? scopeLevels : ["MEMBER"],
      primaryRole: roleNames[0] || "Faculty / Member",
      status: u.status || "ACTIVE",
      createdAt: u.created_at,
    }
  })

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">People & Roles</h1>
        <p className="text-xs text-muted-foreground">
          Provision institutional actors (Directors, Department Leads, Faculty, and Dept Admins) with strict role and department boundary enforcement.
        </p>
      </div>

      <PeopleManagerClient
        orgId={orgId}
        initialUsers={formattedUsers}
        departments={allDepts}
      />
    </div>
  )
}
