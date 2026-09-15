import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { getFilteredTransactionLogs } from "@/lib/workledger/transactions-export"
import { DirectorTransactionsExportView } from "@/components/director/director-transactions-export-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorTransactionsPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN", "FINANCE_ADMIN")

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

  // 2. Fetch initial transactions for current month
  const result = await getFilteredTransactionLogs(orgId, { period: "this_month" })

  return (
    <div className="min-h-screen bg-linear-to-b from-background via-background to-muted/20">
      <DirectorTransactionsExportView
        orgId={orgId}
        initialTransactions={result.transactions}
        departments={departments}
      />
    </div>
  )
}
