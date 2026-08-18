import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createClient } from "@/lib/supabase/server"
import { BulkUserImportClient } from "@/components/admin/bulk-user-import-client"
import { Users } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DeptAdminImportPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DEPT_ADMIN", "ORG_UNIT_LEAD", "DIRECTOR", "SYSTEM_ADMIN")

  const supabase = await createClient()

  // Fetch department metadata
  let deptName = "Computer Science & Engineering"
  if (user.orgUnitId) {
    const { data: unit } = await supabase
      .from("org_units")
      .select("name")
      .eq("id", user.orgUnitId)
      .maybeSingle()
    if (unit?.name) deptName = unit.name
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Department Faculty Bulk Import
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Import teaching staff and faculty members directly into <strong className="text-foreground">{deptName}</strong> with automated credential provisioning.
        </p>
      </div>

      <BulkUserImportClient
        orgId={orgId}
        scope="DEPT_ADMIN"
        deptId={user.orgUnitId}
        deptName={deptName}
      />
    </div>
  )
}
