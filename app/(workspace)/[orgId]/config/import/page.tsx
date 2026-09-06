import { requireAuth, requireScope } from "@/lib/auth/protect"
import { BulkImportClient } from "@/components/admin/bulk-import-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigImportPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("SYSTEM_ADMIN", "DIRECTOR")

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Organization Bulk Data Import</h1>
        <p className="text-muted-foreground mt-1">
          Import organization structure, departments, roles, and employee records in batch
        </p>
      </div>

      <BulkImportClient orgId={orgId} />
    </div>
  )
}

