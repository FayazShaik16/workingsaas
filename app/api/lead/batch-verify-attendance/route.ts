import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"
import { anchorTaskRewardOnChain } from "@/lib/blockchain/relayer"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { recordIds, action, rejectionReason } = await req.json()

    if (!Array.isArray(recordIds) || recordIds.length === 0) {
      return NextResponse.json({ error: "No attendance record IDs provided." }, { status: 400 })
    }

    const isApprove = action === "APPROVE"

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch the target attendance records with timetable slot and subject details
    const { data: records, error: recordsError } = await db
      .from("attendance_records")
      .select(`
        id,
        organization_id,
        faculty_id,
        conducted_on,
        timetable_slot_id,
        timetable_slots (
          id,
          task_type_id,
          subject_assignments (
            subject_id,
            batch_id,
            subjects (id, name, code, credits)
          )
        )
      `)
      .in("id", recordIds)

    if (recordsError) throw recordsError
    if (!records || records.length === 0) {
      return NextResponse.json({ error: "No matching attendance records found." }, { status: 404 })
    }

    let processedCount = 0
    let totalTokensDisbursed = 0

    const nowIso = new Date().toISOString()

    for (const record of records) {
      const facultyId = record.faculty_id
      const orgId = record.organization_id || user.organizationId
      const slotId = record.timetable_slot_id
      const classDate = record.conducted_on

      if (isApprove) {
        // A. Mark attendance_record as CONDUCTED
        await db
          .from("attendance_records")
          .update({
            status: "CONDUCTED",
            marked_at: nowIso,
          })
          .eq("id", record.id)

        // B. Update corresponding task to CLOSED
        const { data: task } = await db
          .from("tasks")
          .select("id, credit_value")
          .eq("source_timetable_slot_id", slotId)
          .eq("scheduled_date", classDate)
          .eq("assigned_to_id", facultyId)
          .limit(1)
          .maybeSingle()

        const creditReward = Number(task?.credit_value || 1.0)

        if (task?.id) {
          await db
            .from("tasks")
            .update({
              status: "CLOSED",
              updated_at: nowIso,
            })
            .eq("id", task.id)
        }

        // C. Disburse tokens to faculty's PERSONAL wallet
        let { data: wallet } = await db
          .from("wallets")
          .select("id, balance")
          .eq("owner_user_id", facultyId)
          .eq("purpose", "PERSONAL")
          .limit(1)
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

          // Anchor on-chain cryptographic receipt
          let receipt = { txHash: "off-chain-ledger" }
          try {
            receipt = await anchorTaskRewardOnChain({
              recipientId: facultyId,
              amount: creditReward,
              taskId: task?.id || record.id,
              organizationId: orgId,
              metadata: {
                slotId,
                classDate,
                verifierId: user.id,
              },
            })
          } catch (anchorErr) {
            console.warn("[batch-verify] On-chain anchor skipped:", anchorErr)
          }

          // Record token transaction
          await db.from("token_transactions").insert({
            organization_id: orgId,
            from_wallet_id: null,
            to_wallet_id: wallet.id,
            amount: creditReward,
            type: "TASK_REWARD",
            status: "CONFIRMED",
            notes: `Teaching session verification on ${classDate}. Receipt: ${receipt.txHash}`,
            timestamp: nowIso,
          })

          // Record in credit_ledger_entries
          await db.from("credit_ledger_entries").insert({
            organization_id: orgId,
            user_id: facultyId,
            credit_type: "TEACHING",
            amount: creditReward,
            source_entity_type: "ATTENDANCE",
            source_entity_id: record.id,
            month_start: classDate ? `${classDate.slice(0, 7)}-01` : `${nowIso.slice(0, 7)}-01`,
            idempotency_key: `attendance-${record.id}-reward`,
            created_by: user.id,
          })

          totalTokensDisbursed += creditReward

          // Update user progress percentage
          const { data: userRec } = await db.from("users").select("target_credits").eq("id", facultyId).single()
          const target = Number(userRec?.target_credits || 0)
          const progress = target > 0 ? Math.min(100, Math.round((newBalance / target) * 100)) : 0
          await db.from("users").update({ progress_percentage: progress, updated_at: nowIso }).eq("id", facultyId)
        }

        processedCount++
      } else {
        // Reject flow -> mark CANCELLED
        await db
          .from("attendance_records")
          .update({
            status: "CANCELLED",
            marked_at: nowIso,
            topic_covered: rejectionReason ? `[REJECTED: ${rejectionReason}]` : "[CANCELLED_BY_LEAD]",
          })
          .eq("id", record.id)

        // Return task to ASSIGNED state
        await db
          .from("tasks")
          .update({
            status: "ASSIGNED",
            updated_at: nowIso,
          })
          .eq("source_timetable_slot_id", slotId)
          .eq("scheduled_date", classDate)
          .eq("assigned_to_id", facultyId)

        processedCount++
      }
    }

    return NextResponse.json({
      success: true,
      action: isApprove ? "APPROVED" : "REJECTED",
      processedCount,
      totalTokensDisbursed,
      message: isApprove
        ? `Successfully verified ${processedCount} attendance records and disbursed ${totalTokensDisbursed.toFixed(1)} WORK tokens.`
        : `Successfully rejected ${processedCount} attendance records.`,
    })
  } catch (error: any) {
    console.error("[batch-verify-attendance] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
