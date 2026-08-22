import { requireAuth, requireRole } from "@/lib/auth/protect"
import { BlockchainReadinessClient } from "@/components/admin/blockchain-readiness-client"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function ConfigBlockchainPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()
  await requireRole("SYSTEM_ADMIN")

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Blockchain Readiness &amp; Infrastructure</h1>
        <p className="text-xs text-muted-foreground">
          Real-time Sepolia testnet connection diagnostics, ERC-20 contract verification, and treasury liquidity monitoring.
        </p>
      </div>

      <BlockchainReadinessClient />
    </div>
  )
}
