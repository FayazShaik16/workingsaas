import { createClient } from "@/lib/supabase/server"
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

    const supabase = await createClient()
    const db = supabase as any

    // 1. Fetch loan request details
    let loan = null
    const { data: requestData } = await db
      .from("loan_requests")
      .select(`
        id,
        amount,
        reason,
        status,
        borrower_user_id,
        organization_id
      `)
      .eq("id", loanRequestId)
      .maybeSingle()

    if (requestData) {
      loan = {
        id: requestData.id,
        amount: Number(requestData.amount),
        borrower_id: requestData.borrower_user_id,
        organization_id: requestData.organization_id,
        table: "loan_requests",
      }
    } else {
      // Check loans table
      const { data: directLoan } = await db
        .from("loans")
        .select("id, amount, description, status, user_id, organization_id")
        .eq("id", loanRequestId)
        .maybeSingle()

      if (directLoan) {
        loan = {
          id: directLoan.id,
          amount: Number(directLoan.amount),
          borrower_id: directLoan.user_id,
          organization_id: directLoan.organization_id,
          table: "loans",
        }
      }
    }

    if (!loan) {
      return NextResponse.json({ error: "Loan application not found." }, { status: 404 })
    }

    const isApprove = action === "APPROVE"
    const nowIso = new Date().toISOString()
    const orgId = loan.organization_id || user.organizationId

    if (isApprove) {
      // 2. Fetch LOAN_POOL wallet
      const { data: loanPoolWallet } = await db
        .from("wallets")
        .select("id, balance")
        .eq("organization_id", orgId)
        .eq("purpose", "LOAN_POOL")
        .maybeSingle()

      // Fetch or create borrower's PERSONAL wallet
      let { data: borrowerWallet } = await db
        .from("wallets")
        .select("id, balance")
        .eq("owner_user_id", loan.borrower_id)
        .eq("purpose", "PERSONAL")
        .maybeSingle()

      if (!borrowerWallet) {
        const { data: newWallet } = await db
          .from("wallets")
          .insert({
            organization_id: orgId,
            owner_user_id: loan.borrower_id,
            purpose: "PERSONAL",
            balance: 0,
          })
          .select("id, balance")
          .single()

        borrowerWallet = newWallet
      }

      // 3. Disburse tokens from LOAN_POOL to borrower PERSONAL wallet
      if (borrowerWallet) {
        const newBalance = Number(borrowerWallet.balance || 0) + loan.amount
        await db
          .from("wallets")
          .update({ balance: newBalance })
          .eq("id", borrowerWallet.id)

        // Anchor on-chain loan receipt
        const receipt = await anchorLoanIssuanceOnChain({
          borrowerId: loan.borrower_id,
          amount: loan.amount,
          loanId: loan.id,
          organizationId: orgId,
        })

        // Record transaction
        await db.from("token_transactions").insert({
          organization_id: orgId,
          from_wallet_id: loanPoolWallet?.id || null,
          to_wallet_id: borrowerWallet.id,
          amount: loan.amount,
          type: "LOAN_ISSUE",
          status: "CONFIRMED",
          blockchain_tx_hash: receipt.txHash,
          created_at: nowIso,
        })
      }

      // 4. Update loan status
      if (loan.table === "loan_requests") {
        await db
          .from("loan_requests")
          .update({ status: "APPROVED" })
          .eq("id", loan.id)

        // Insert active loan tracking record
        await db.from("loans").insert({
          organization_id: orgId,
          user_id: loan.borrower_id,
          amount: loan.amount,
          status: "ACTIVE",
          description: "Approved work loan advance from Director Desk",
          created_at: nowIso,
          updated_at: nowIso,
        })
      } else {
        await db
          .from("loans")
          .update({ status: "ACTIVE", updated_at: nowIso })
          .eq("id", loan.id)
      }

      return NextResponse.json({
        success: true,
        action: "APPROVED",
        amount: loan.amount,
        message: `Work-loan advance of ${loan.amount} WORK tokens approved and disbursed to faculty PERSONAL wallet.`,
      })
    } else {
      // Rejection
      if (loan.table === "loan_requests") {
        await db
          .from("loan_requests")
          .update({ status: "REJECTED" })
          .eq("id", loan.id)
      } else {
        await db
          .from("loans")
          .update({ status: "REJECTED", updated_at: nowIso })
          .eq("id", loan.id)
      }

      return NextResponse.json({
        success: true,
        action: "REJECTED",
        message: `Loan application for ${loan.amount} WORK rejected.`,
      })
    }
  } catch (error: any) {
    console.error("[director/approve-loan] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
