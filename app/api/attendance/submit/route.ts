import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized. Please log in." }, { status: 401 })
    }

    const {
      timetableSlotId,
      taskId,
      topicCovered,
      classDate = new Date().toISOString().split("T")[0],
    } = await req.json()

    if (!timetableSlotId && !taskId) {
      return NextResponse.json(
        { error: "Timetable slot ID or task ID is required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch timetable slot details if provided
    let orgId = user.organizationId
    let slotData = null

    if (timetableSlotId) {
      const { data: slot } = await db
        .from("timetable_slots")
        .select("id, organization_id, subject_assignment_id")
        .eq("id", timetableSlotId)
        .maybeSingle()

      if (slot) {
        slotData = slot
        orgId = slot.organization_id || orgId
      }
    }

    // 2. Insert or update the attendance record (auto-approved status = 'VERIFIED')
    let attendanceRecord = null
    if (timetableSlotId) {
      const { data: existingRecord } = await db
        .from("attendance_records")
        .select("id")
        .eq("timetable_slot_id", timetableSlotId)
        .eq("faculty_id", user.id)
        .limit(1)
        .maybeSingle()

      if (existingRecord) {
        const { data: updated } = await db
          .from("attendance_records")
          .update({
            status: "CONDUCTED",
            conducted_on: classDate,
            marked_at: new Date().toISOString(),
            topic_covered: topicCovered || "Teaching Session Conducted",
          })
          .eq("id", existingRecord.id)
          .select()
          .single()

        attendanceRecord = updated || existingRecord
      } else {
        const insertPayload: any = {
          organization_id: orgId,
          timetable_slot_id: timetableSlotId,
          faculty_id: user.id,
          status: "CONDUCTED",
          conducted_on: classDate,
          marked_at: new Date().toISOString(),
          topic_covered: topicCovered || "Teaching Session Conducted",
        }

        const { data: inserted, error: insError } = await db
          .from("attendance_records")
          .insert(insertPayload)
          .select()
          .single()

        attendanceRecord = inserted
      }
    }

    // 3. Auto-approve the corresponding structured task (status = 'CLOSED')
    let targetTaskId = taskId
    let creditValue = 1.0

    if (targetTaskId) {
      const { data: currentTask } = await db
        .from("tasks")
        .select("id, credit_value, status")
        .eq("id", targetTaskId)
        .single()

      if (currentTask) {
        creditValue = Number(currentTask.credit_value || 1.0)
        await db
          .from("tasks")
          .update({
            status: "CLOSED",
            lead_signed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetTaskId)
      }
    } else if (timetableSlotId) {
      // Find task associated with this slot
      const { data: slotTasks } = await db
        .from("tasks")
        .select("id, credit_value")
        .or(`source_timetable_slot_id.eq.${timetableSlotId},description.ilike.%${timetableSlotId}%`)
        .eq("assigned_to_id", user.id)
        .limit(1)

      if (slotTasks && slotTasks.length > 0) {
        targetTaskId = slotTasks[0].id
        creditValue = Number(slotTasks[0].credit_value || 1.0)
        await db
          .from("tasks")
          .update({
            status: "CLOSED",
            lead_signed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetTaskId)
      }
    }

    // 4. Update Faculty Wallet & Target Progress (Auto-mint credit)
    const { data: userWallet } = await db
      .from("wallets")
      .select("id, balance")
      .eq("owner_user_id", user.id)
      .eq("purpose", "PERSONAL")
      .maybeSingle()

    if (userWallet) {
      const newBal = Number(userWallet.balance || 0) + creditValue
      await db
        .from("wallets")
        .update({ balance: newBal })
        .eq("id", userWallet.id)
    }

    // 5. Update user progress percentage
    const { data: userProfile } = await db
      .from("users")
      .select("id, target_credits")
      .eq("id", user.id)
      .single()

    if (userProfile && Number(userProfile.target_credits) > 0) {
      const { data: allClosedTasks } = await db
        .from("tasks")
        .select("credit_value")
        .eq("assigned_to_id", user.id)
        .in("status", ["CLOSED", "VERIFIED", "LEAD_SIGNED", "APPROVED"])

      const totalEarned = (allClosedTasks || []).reduce(
        (sum: number, t: any) => sum + Number(t.credit_value || 0),
        0
      )
      const target = Number(userProfile.target_credits)
      const newProgress = Math.min(100, Math.round((totalEarned / target) * 100))

      await db
        .from("users")
        .update({ progress_percentage: newProgress, updated_at: new Date().toISOString() })
        .eq("id", user.id)
    }

    return NextResponse.json({
      success: true,
      autoApproved: true,
      attendanceRecordId: attendanceRecord?.id,
      taskId: targetTaskId,
      message: "Scheduled task marked as completed and auto-approved successfully!",
    })
  } catch (error: any) {
    console.error("[attendance/submit] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
