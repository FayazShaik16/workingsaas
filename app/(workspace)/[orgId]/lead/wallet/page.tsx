import { requireAuth } from "@/lib/auth/protect"
import { MemberWalletView } from "@/components/wallet/member-wallet-view"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function LeadWalletPage({ params }: PageProps) {
  const { orgId } = await params
  await requireAuth()

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">HOD Personal Audit Wallet</h1>
        <p className="text-xs text-muted-foreground">
          Cryptographic custodial wallet for verified on-chain salary settlements and token balances.
        </p>
      </div>

      <MemberWalletView />
    </div>
  )
}
