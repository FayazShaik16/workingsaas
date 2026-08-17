import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { DirectorLedgerAudit, LedgerTransaction } from "@/components/director/director-ledger-audit"
import { ScrollText } from "lucide-react"

interface PageProps {
  params: Promise<{ orgId: string }>
}

export default async function DirectorLedgerPage({ params }: PageProps) {
  const { orgId } = await params
  const user = await requireAuth()
  await requireScope("DIRECTOR", "SYSTEM_ADMIN", "FINANCE_ADMIN")

  const admin = createAdminClient()
  const db = admin as any

  // 1. Fetch token transactions in this org with wallet details
  const { data: rawTx } = await db
    .from("token_transactions")
    .select(`
      id,
      amount,
      type,
      status,
      blockchain_tx_hash,
      created_at,
      from_wallet:from_wallet_id (
        id,
        purpose,
        owner_user_id,
        users:owner_user_id (name)
      ),
      to_wallet:to_wallet_id (
        id,
        purpose,
        owner_user_id,
        users:owner_user_id (name)
      )
    `)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(100)

  const formattedTx: LedgerTransaction[] = (rawTx || []).map((t: any) => {
    const fromWallet = t.from_wallet
    const toWallet = t.to_wallet

    const fromLabel = fromWallet
      ? fromWallet.purpose === "PERSONAL"
        ? `Faculty (${fromWallet.users?.name || "Member"})`
        : fromWallet.purpose
      : "Treasury / Mint"

    const toLabel = toWallet
      ? toWallet.purpose === "PERSONAL"
        ? `Faculty (${toWallet.users?.name || "Member"})`
        : toWallet.purpose
      : "Vault / Burn"

    const facultyName = toWallet?.users?.name || fromWallet?.users?.name || undefined

    return {
      id: t.id,
      amount: Number(t.amount || 0),
      type: t.type || "TRANSFER",
      status: t.status,
      blockchain_tx_hash: t.blockchain_tx_hash,
      created_at: t.created_at,
      from_wallet_label: fromLabel,
      to_wallet_label: toLabel,
      faculty_name: facultyName,
    }
  })

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-3">
          <ScrollText className="h-8 w-8 text-primary" />
          Executive Ledger & Cryptographic Audit
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Immutable double-entry journal verifying all capability token issuances, work-loan disbursements, and monthly salary sweeps.
        </p>
      </div>

      <DirectorLedgerAudit orgId={orgId} transactions={formattedTx} />
    </div>
  )
}
