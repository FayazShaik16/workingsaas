import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"
import { anchorBatchReversalOnChain } from "@/lib/blockchain/relayer"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { memberIds } = await req.json()

    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json(
        { error: "No eligible faculty member IDs provided for batch reversal." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const db = supabase as any
    const orgId = user.organizationId

    // 1. Fetch SALARY_POOL wallet of the organization
    let { data: salaryPoolWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("organization_id", orgId)
      .eq("purpose", "SALARY_POOL")
      .limit(1)
      .maybeSingle()

    if (!salaryPoolWallet) {
      const { data: newPool } = await db
        .from("wallets")
        .insert({
          organization_id: orgId,
          purpose: "SALARY_POOL",
          balance: 10000,
        })
        .select("id, balance")
        .single()

      salaryPoolWallet = newPool
    }

    // 2. Fetch target faculty personal wallets
    const { data: personalWallets, error: walletError } = await db
      .from("wallets")
      .select("id, owner_user_id, balance")
      .eq("organization_id", orgId)
      .eq("purpose", "PERSONAL")
      .in("owner_user_id", memberIds)

    if (walletError) throw walletError

    let totalTokensReversed = 0
    let processedCount = 0
    const nowIso = new Date().toISOString()

    // Generate cryptographic on-chain batch reversal receipt
    const totalTokensToSweep = (personalWallets || []).reduce((sum: number, w: any) => sum + Number(w.balance || 0), 0)
    const receipt = await anchorBatchReversalOnChain({
      memberIds,
      totalTokens: totalTokensToSweep,
      organizationId: orgId,
    })
    const batchTxHash = receipt.txHash

    for (const pWallet of personalWallets || []) {
      const balanceToSweep = Number(pWallet.balance || 0)
      if (balanceToSweep > 0) {
        // A. Reset personal wallet balance for next monthly cycle
        await db
          .from("wallets")
          .update({ balance: 0 })
          .eq("id", pWallet.id)

        // B. Return tokens to SALARY_POOL
        if (salaryPoolWallet) {
          const currentPoolBalance = Number(salaryPoolWallet.balance || 0)
          await db
            .from("wallets")
            .update({ balance: currentPoolBalance + balanceToSweep })
            .eq("id", salaryPoolWallet.id)
        }

        // C. Record double-entry transaction in token_transactions
        await db.from("token_transactions").insert({
          organization_id: orgId,
          from_wallet_id: pWallet.id,
          to_wallet_id: salaryPoolWallet?.id || null,
          amount: balanceToSweep,
          type: "SALARY_PAYOUT",
          status: "CONFIRMED",
          blockchain_tx_hash: batchTxHash,
          created_at: nowIso,
        })

        totalTokensReversed += balanceToSweep
        processedCount++
      }
    }

    return NextResponse.json({
      success: true,
      processedCount,
      totalTokensReversed,
      batchTxHash,
      message: `Batch Reversal complete. Swept ${totalTokensReversed.toFixed(1)} WORK tokens from ${processedCount} faculty wallets back to Director SALARY_POOL (TxHash: ${batchTxHash.slice(0, 14)}...).`,
    })
  } catch (error: any) {
    console.error("[batch-reverse-salary] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
