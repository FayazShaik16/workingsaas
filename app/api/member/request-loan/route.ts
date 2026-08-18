import { createClient } from "@/lib/supabase/server"
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

    const supabase = await createClient()
    const db = supabase as any
    const orgId = user.organizationId

    // Insert into loan_requests / loans table
    const { data: newLoan, error: loanError } = await db
      .from("loan_requests")
      .insert({
        organization_id: orgId,
        borrower_user_id: user.id,
        amount: requestedAmount,
        reason: reason || "Bridging monthly target credit deficit for salary authorization.",
        status: "PENDING",
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (loanError) {
      // Also try loans table
      const { data: fallbackLoan, error: fallbackErr } = await db
        .from("loans")
        .insert({
          organization_id: orgId,
          user_id: user.id,
          amount: requestedAmount,
          status: "PENDING",
          description: reason || "Work loan deficit advance",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single()

      if (fallbackErr) {
        throw new Error(`Failed to submit loan request: ${fallbackErr.message}`)
      }
    }

    return NextResponse.json({
      success: true,
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
