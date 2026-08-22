import { requireAuth } from "@/lib/auth/protect"
import { DirectorTreasuryView } from "@/components/wallet/director-treasury-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorWalletPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Treasury Vault</h1>
        <p className="text-xs text-muted-foreground">
          Master disbursement wallet and liquidity reserve for verified on-chain settlements.
        </p>
      </div>

      <DirectorTreasuryView />
    </div>
  )
}
