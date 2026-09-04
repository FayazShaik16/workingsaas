import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { amount, reason } = await req.json()
    const requestedAmount = parseFloat(amount)

    if (!requestedAmount || requestedAmount <= 0) {
      return NextResponse.json({ error: "Please enter a valid loan amount." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any
    const orgId = user.organizationId

    // Insert into loans table
    const { data: newLoan, error: loanError } = await db
      .from("loans")
      .insert({
        organization_id: orgId,
        user_id: user.id,
        amount: requestedAmount,
        remaining: requestedAmount,
        reason: reason || "Bridging monthly target credit deficit for salary authorization.",
        buffer_eligible: true,
        status: "PENDING",
      })
      .select()
      .single()

    if (loanError) {
      console.error("[request-loan] insert error:", loanError)
      return NextResponse.json(
        { error: `Failed to submit loan request: ${loanError.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      loan: newLoan,
      amount: requestedAmount,
      message: `Work-loan request for ${requestedAmount} WORK tokens submitted to Director Loan Desk.`,
    })
  } catch (error: any) {
    console.error("[member/request-loan] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
