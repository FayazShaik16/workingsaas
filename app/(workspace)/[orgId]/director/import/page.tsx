import { requireAuth, requireScope } from "@/lib/auth/protect"
import { BulkUserImportClient } from "@/components/admin/bulk-user-import-client"
import { Users } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorImportPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN")

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          Institution-Wide Faculty & Staff Ingestion Desk
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Bulk onboard departments, heads of department, faculty members, and administrative staff from a single master CSV or Excel spreadsheet.
        </p>
      </div>

      <BulkUserImportClient
        orgId={orgId}
        scope="DIRECTOR"
      />
    </div>
  )
}
