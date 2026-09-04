import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"
import { anchorLoanIssuanceOnChain } from "@/lib/blockchain/relayer"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { loanRequestId, action, rejectionReason } = await req.json()

    if (!loanRequestId) {
      return NextResponse.json({ error: "Loan request ID is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch loan from loans table
    const { data: loan, error: loanErr } = await db
      .from("loans")
      .select("id, amount, remaining, reason, status, user_id, organization_id")
      .eq("id", loanRequestId)
      .single()

    if (loanErr || !loan) {
      return NextResponse.json({ error: "Loan request not found." }, { status: 404 })
    }

    const orgId = loan.organization_id || user.organizationId
    const nowIso = new Date().toISOString()
    const borrowerId = loan.user_id
    const loanAmount = Number(loan.amount)

    if (action === "REJECT") {
      await db
        .from("loans")
        .update({
          status: "DEFAULTED", // Using valid loan_status enum ('PENDING', 'ACTIVE', 'REPAID', 'DEFAULTED')
        })
        .eq("id", loan.id)

      return NextResponse.json({
        success: true,
        action: "REJECTED",
        message: "Loan request rejected by Director.",
      })
    }

    // APPROVE flow:
    // 2. Locate or provision LOAN_POOL wallet
    let { data: loanPoolWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("organization_id", orgId)
      .eq("purpose", "LOAN_POOL")
      .limit(1)
      .maybeSingle()

    if (!loanPoolWallet) {
      const { data: newPool } = await db
        .from("wallets")
        .insert({
          organization_id: orgId,
          purpose: "LOAN_POOL",
          balance: 50000,
        })
        .select("id, balance")
        .single()
      loanPoolWallet = newPool
    }

    // 3. Locate or provision borrower PERSONAL wallet
    let { data: borrowerWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("organization_id", orgId)
      .eq("owner_user_id", borrowerId)
      .eq("purpose", "PERSONAL")
      .limit(1)
      .maybeSingle()

    if (!borrowerWallet) {
      const { data: newPersonal } = await db
        .from("wallets")
        .insert({
          organization_id: orgId,
          owner_user_id: borrowerId,
          purpose: "PERSONAL",
          balance: 0,
        })
        .select("id, balance")
        .single()
      borrowerWallet = newPersonal
    }

    if (borrowerWallet?.id) {
      // Deduct from LOAN_POOL if available
      if (loanPoolWallet) {
        const poolBal = Math.max(0, Number(loanPoolWallet.balance || 0) - loanAmount)
        await db.from("wallets").update({ balance: poolBal }).eq("id", loanPoolWallet.id)
      }

      // Credit borrower personal wallet
      const newBorrowerBalance = Number(borrowerWallet.balance || 0) + loanAmount
      await db.from("wallets").update({ balance: newBorrowerBalance }).eq("id", borrowerWallet.id)

      // Anchor on-chain loan receipt
      let txHash = `mock_loan_tx_${Date.now()}`
      try {
        const receipt = await anchorLoanIssuanceOnChain({
          borrowerId,
          amount: loanAmount,
          loanId: loan.id,
          organizationId: orgId,
        })
        txHash = receipt.txHash || txHash
      } catch (e: any) {
        console.warn("[approve-loan] On-chain anchoring fallback:", e?.message)
      }

      // Record transaction in token_transactions
      await db.from("token_transactions").insert({
        organization_id: orgId,
        from_wallet_id: loanPoolWallet?.id || null,
        to_wallet_id: borrowerWallet.id,
        amount: loanAmount,
        type: "LOAN_ISSUE",
        status: "CONFIRMED",
        notes: `Director Loan Desk Approval: ${txHash}`,
        timestamp: nowIso,
      })
    }

    // 4. Update loan status to ACTIVE
    await db
      .from("loans")
      .update({
        status: "ACTIVE",
        approved_by: user.id,
      })
      .eq("id", loan.id)

    return NextResponse.json({
      success: true,
      action: "APPROVED",
      amount: loanAmount,
      message: `Emergency work loan of ${loanAmount} WORK credits approved and disbursed.`,
    })
  } catch (error: any) {
    console.error("[approve-loan] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
