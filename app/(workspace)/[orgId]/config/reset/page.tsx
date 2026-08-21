import { requireScope } from "@/lib/auth/protect"
import { DataResetManager } from "@/components/admin/data-reset-manager"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function AdminResetPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireScope("SYSTEM_ADMIN")

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
          Database Reset & Tenant Purge
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Perform a clean start by previewing and removing all demo/mock accounts, test organizations, and legacy records.
        </p>
      </div>

      <DataResetManager orgId={orgId} currentUserEmail={user.email} />
    </div>
  )
}
