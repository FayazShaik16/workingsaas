import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, comment } = await req.json()

    if (!taskId) {
      return NextResponse.json({ error: "Task ID required" }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // Verify task exists
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, status, organization_id, credit_value, assigned_to_id, title")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    const orgId = task.organization_id || user.organizationId
    const facultyId = task.assigned_to_id
    const creditReward = Number(task.credit_value || 1.0)
    const nowIso = new Date().toISOString()

    // Update task status to CLOSED (LEAD_SIGNED)
    await db
      .from("tasks")
      .update({
        status: "CLOSED",
        updated_at: nowIso,
      })
      .eq("id", taskId)

    // Credit faculty's PERSONAL wallet if assigned
    if (facultyId) {
      let { data: wallet } = await db
        .from("wallets")
        .select("id, balance")
        .eq("owner_user_id", facultyId)
        .eq("purpose", "PERSONAL")
        .maybeSingle()

      if (!wallet) {
        const { data: newWallet } = await db
          .from("wallets")
          .insert({
            organization_id: orgId,
            owner_user_id: facultyId,
            purpose: "PERSONAL",
            balance: 0,
          })
          .select("id, balance")
          .single()
        wallet = newWallet
      }

      if (wallet?.id) {
        const newBalance = Number(wallet.balance || 0) + creditReward
        await db
          .from("wallets")
          .update({ balance: newBalance })
          .eq("id", wallet.id)

        // Insert token transaction
        await db.from("token_transactions").insert({
          organization_id: orgId,
          from_wallet_id: null,
          to_wallet_id: wallet.id,
          amount: creditReward,
          type: "TASK_REWARD",
          status: "CONFIRMED",
          created_at: nowIso,
        })

        // Recompute progress in DB
        await db.rpc("recompute_user_progress", { p_user_id: facultyId })
      }
    }

    return NextResponse.json({
      success: true,
      creditAwarded: creditReward,
      message: `Task "${task.title}" verified and +${creditReward.toFixed(1)} WORK credits released.`,
    })
  } catch (error: any) {
    console.error("Approve proof error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
