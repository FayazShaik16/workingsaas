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
    let slotData: any = null

    if (timetableSlotId) {
      const { data: slot } = await db
        .from("timetable_slots")
        .select("id, organization_id, subject_assignment_id, faculty_id, day_of_week, period_number")
        .eq("id", timetableSlotId)
        .maybeSingle()

      if (slot) {
        slotData = slot
        orgId = slot.organization_id || orgId
      }
    }

    // 2. Prevent duplicate completion for another class in the same period on classDate
    if (slotData && slotData.period_number) {
      const { data: duplicatePeriodRecord } = await db
        .from("attendance_records")
        .select("id, timetable_slots!inner(period_number)")
        .eq("faculty_id", user.id)
        .eq("conducted_on", classDate)
        .eq("status", "CONDUCTED")
        .eq("timetable_slots.period_number", slotData.period_number)
        .neq("timetable_slot_id", timetableSlotId)
        .limit(1)
        .maybeSingle()

      if (duplicatePeriodRecord) {
        return NextResponse.json(
          {
            error: `You have already completed another class session during Period ${slotData.period_number} on ${classDate}. Duplicate completion rewards for the same period are prohibited.`,
          },
          { status: 400 }
        )
      }
    }

    // 3. Check if this specific slot or task was already completed
    let existingRecord: any = null
    if (timetableSlotId) {
      const { data: rec } = await db
        .from("attendance_records")
        .select("id, status")
        .eq("timetable_slot_id", timetableSlotId)
        .eq("faculty_id", user.id)
        .eq("conducted_on", classDate)
        .limit(1)
        .maybeSingle()

      existingRecord = rec
    }

    let alreadyCompleted = existingRecord?.status === "CONDUCTED"
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
        if (["CLOSED", "VERIFIED", "LEAD_SIGNED", "APPROVED"].includes(currentTask.status)) {
          alreadyCompleted = true
        } else {
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
    } else if (timetableSlotId) {
      // Find task associated with this slot
      const { data: slotTasks } = await db
        .from("tasks")
        .select("id, credit_value, status")
        .or(`source_timetable_slot_id.eq.${timetableSlotId},description.ilike.%${timetableSlotId}%`)
        .eq("assigned_to_id", user.id)
        .limit(1)

      if (slotTasks && slotTasks.length > 0) {
        targetTaskId = slotTasks[0].id
        creditValue = Number(slotTasks[0].credit_value || 1.0)
        if (["CLOSED", "VERIFIED", "LEAD_SIGNED", "APPROVED"].includes(slotTasks[0].status)) {
          alreadyCompleted = true
        } else {
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
    }

    // 4. Insert or update the attendance record
    let attendanceRecord = null
    if (timetableSlotId) {
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

        const { data: inserted } = await db
          .from("attendance_records")
          .insert(insertPayload)
          .select()
          .single()

        attendanceRecord = inserted
      }
    }

    // 5. Update Faculty Wallet & Target Progress ONLY if not previously completed
    if (!alreadyCompleted) {
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

      // Update user progress percentage
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
    }

    return NextResponse.json({
      success: true,
      already_completed: alreadyCompleted,
      autoApproved: true,
      attendanceRecordId: attendanceRecord?.id,
      taskId: targetTaskId,
      creditAwarded: alreadyCompleted ? 0 : creditValue,
      message: alreadyCompleted
        ? "This session was already completed. Attendance record updated without duplicate reward crediting."
        : "Scheduled task marked as completed and auto-approved successfully!",
    })
  } catch (error: any) {
    console.error("[attendance/submit] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
