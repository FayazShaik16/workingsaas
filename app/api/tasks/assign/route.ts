import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser, hasScope } from "@/lib/auth/session"
import { assertDepartmentScope } from "@/lib/workledger/permissions"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { taskId, facultyId, assigneeId, nominationId, deadline } = await req.json()
    const targetFacultyId = facultyId || assigneeId

    if (!taskId || !targetFacultyId) {
      return NextResponse.json(
        { error: "Both taskId and facultyId are required." },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch task
    const { data: task, error: taskError } = await db
      .from("tasks")
      .select("id, title, organization_id, org_unit_id, visibility_scope, status, source_timetable_slot_id, deadline, assigned_to_id, custom_fields")
      .eq("id", taskId)
      .single()

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 })
    }

    // 2. Enforce department isolation
    assertDepartmentScope(user, task.org_unit_id)

    // 3. Fetch target faculty to ensure they belong to permitted department
    const { data: facultyUser, error: facultyErr } = await db
      .from("users")
      .select("id, name, org_unit_id, organization_id")
      .eq("id", targetFacultyId)
      .single()

    if (facultyErr || !facultyUser) {
      return NextResponse.json({ error: "Assigned faculty member not found." }, { status: 404 })
    }

    if (task.visibility_scope === "ORG_UNIT" && task.org_unit_id) {
      if (facultyUser.org_unit_id !== task.org_unit_id) {
        return NextResponse.json(
          { error: "Cannot assign a department task to a faculty member outside the department." },
          { status: 400 }
        )
      }
    }

    const effectiveDeadline = deadline || task.deadline

    // 4. Scheduling & duplicate assignment collision check
    if (task.source_timetable_slot_id) {
      const { data: duplicateSlotTask } = await db
        .from("tasks")
        .select("id, title")
        .eq("assigned_to_id", targetFacultyId)
        .eq("source_timetable_slot_id", task.source_timetable_slot_id)
        .neq("status", "CANCELLED")
        .neq("status", "REJECTED")
        .neq("id", taskId)
        .limit(1)
        .maybeSingle()

      if (duplicateSlotTask) {
        return NextResponse.json(
          {
            error: `Task assignment conflict: Faculty ${facultyUser.name} is already assigned to a task for this timetable slot ("${duplicateSlotTask.title}"). Duplicate task assignments for the same slot are prohibited.`,
          },
          { status: 400 }
        )
      }

      // Check slot time interval overlaps
      const { data: targetSlot } = await db
        .from("timetable_slots")
        .select("id, day_of_week, start_time, end_time")
        .eq("id", task.source_timetable_slot_id)
        .maybeSingle()

      if (targetSlot) {
        const { data: facultySlots } = await db
          .from("timetable_slots")
          .select("id, day_of_week, start_time, end_time")
          .eq("faculty_id", targetFacultyId)
          .eq("day_of_week", targetSlot.day_of_week)
          .neq("id", targetSlot.id)

        const slotConflict = facultySlots?.find((s: any) =>
          s.start_time < targetSlot.end_time && targetSlot.start_time < s.end_time
        )

        if (slotConflict) {
          return NextResponse.json(
            {
              error: `Timetable slot conflict: Faculty ${facultyUser.name} already has a class assigned at ${slotConflict.start_time}-${slotConflict.end_time} on ${targetSlot.day_of_week}. Overlapping time slots are prohibited.`,
            },
            { status: 400 }
          )
        }
      }
    }

    if (effectiveDeadline) {
      const taskDate = new Date(effectiveDeadline).toISOString().slice(0, 10)
      const { data: duplicateTask } = await db
        .from("tasks")
        .select("id, title")
        .eq("assigned_to_id", targetFacultyId)
        .eq("title", task.title)
        .gte("deadline", `${taskDate}T00:00:00.000Z`)
        .lte("deadline", `${taskDate}T23:59:59.999Z`)
        .neq("status", "CANCELLED")
        .neq("status", "REJECTED")
        .neq("id", taskId)
        .limit(1)
        .maybeSingle()

      if (duplicateTask) {
        return NextResponse.json(
          {
            error: `Task assignment conflict: Faculty ${facultyUser.name} already has an active assignment for "${task.title}" on this date (${taskDate}). Duplicate assignments for the same task and date are prohibited.`,
          },
          { status: 400 }
        )
      }

      // Check if target faculty has overlapping scheduled_work_instances
      const { data: instances } = await db
        .from("scheduled_work_instances")
        .select("id, title, scheduled_start, scheduled_end, status")
        .eq("assigned_to_id", targetFacultyId)
        .eq("work_date", taskDate)
        .neq("status", "CANCELLED")

      if (instances && instances.length > 0 && task.source_timetable_slot_id) {
        const { data: slot } = await db
          .from("timetable_slots")
          .select("start_time, end_time")
          .eq("id", task.source_timetable_slot_id)
          .maybeSingle()

        if (slot?.start_time && slot?.end_time) {
          const instConflict = instances.find((inst: any) => {
            const s = inst.scheduled_start?.slice(11, 16)
            const e = inst.scheduled_end?.slice(11, 16)
            return s && e && s < slot.end_time && slot.start_time < e
          })

          if (instConflict) {
            return NextResponse.json(
              {
                error: `Schedule collision: Faculty ${facultyUser.name} has an active class/session ("${instConflict.title}") on ${taskDate} during this time slot. Overlapping assignments are prohibited.`,
              },
              { status: 400 }
            )
          }
        }
      }
    }

    const nowIso = new Date().toISOString()

    const requiredPeople = Math.max(1, parseInt(String(task.custom_fields?.required_people || 1), 10))

    // 5. Update nomination states
    // First, mark target faculty's nomination as ACCEPTED (or insert if direct assign)
    const { data: existingNom } = await db
      .from("nominations")
      .select("id, status")
      .eq("task_id", taskId)
      .eq("user_id", targetFacultyId)
      .maybeSingle()

    if (existingNom) {
      await db
        .from("nominations")
        .update({ status: "ACCEPTED" })
        .eq("id", existingNom.id)
    } else {
      await db
        .from("nominations")
        .insert({
          task_id: taskId,
          user_id: targetFacultyId,
          status: "ACCEPTED",
          message: "Assigned by department lead / administrator.",
          created_at: nowIso,
        })
    }

    // Fetch all currently accepted nominations for this task
    const { data: acceptedNoms } = await db
      .from("nominations")
      .select("user_id")
      .eq("task_id", taskId)
      .eq("status", "ACCEPTED")

    const acceptedUserIds: string[] = Array.from(
      new Set([
        ...(task.custom_fields?.assigned_user_ids || []),
        ...(acceptedNoms?.map((n: any) => n.user_id) || []),
        targetFacultyId,
      ])
    )

    const acceptedCount = acceptedUserIds.length
    const isFullyAssigned = acceptedCount >= requiredPeople
    const newStatus = isFullyAssigned ? "ASSIGNED" : "OPEN"

    // If fully assigned, reject remaining pending nominations
    if (isFullyAssigned) {
      await db
        .from("nominations")
        .update({ status: "REJECTED" })
        .eq("task_id", taskId)
        .eq("status", "PENDING")
    }

    // Update task record with updated custom_fields and primary assignee
    const primaryAssigneeId = task.assigned_to_id || targetFacultyId
    const updatedCustomFields = {
      ...(task.custom_fields || {}),
      required_people: requiredPeople,
      assigned_user_ids: acceptedUserIds,
    }

    const { data: updatedTask, error: updateErr } = await db
      .from("tasks")
      .update({
        assigned_to_id: primaryAssigneeId,
        assigned_by_id: user.id,
        status: newStatus,
        custom_fields: updatedCustomFields,
        deadline: effectiveDeadline ? new Date(effectiveDeadline).toISOString() : task.deadline,
        updated_at: nowIso,
      })
      .eq("id", taskId)
      .select()
      .single()

    if (updateErr) {
      console.error("[tasks/assign] update error:", updateErr)
      return NextResponse.json({ error: `Failed to assign task: ${updateErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      task: updatedTask,
      isFullyAssigned,
      acceptedCount,
      requiredPeople,
      slotsRemaining: Math.max(0, requiredPeople - acceptedCount),
      message: isFullyAssigned
        ? `Task "${task.title}" successfully assigned to ${facultyUser.name}. All ${requiredPeople} position(s) are now filled!`
        : `Assigned ${facultyUser.name} to "${task.title}". (${acceptedCount}/${requiredPeople} positions filled — ${requiredPeople - acceptedCount} slots remaining).`,
    })
  } catch (error: any) {
    console.error("[tasks/assign] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: error?.statusCode || 500 }
    )
  }
}
