import { requireAuth, requireScope } from "@/lib/auth/protect"
import { createAdminClient } from "@/lib/supabase/admin"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    await requireScope("DIRECTOR", "SYSTEM_ADMIN")

    const body = await request.json()
    const { orgUnitId, allocatedBudget, budgetCurrency = "WORK", budgetPeriod = "MONTHLY", budgetNotes = "" } = body

    if (!orgUnitId) {
      return NextResponse.json({ error: "Department (orgUnitId) is required." }, { status: 400 })
    }

    if (allocatedBudget === undefined || isNaN(Number(allocatedBudget)) || Number(allocatedBudget) < 0) {
      return NextResponse.json({ error: "A valid positive budget amount is required." }, { status: 400 })
    }

    const admin = createAdminClient()
    const db = admin as any

    // 1. Fetch current org_unit metadata
    const { data: unit, error: unitError } = await db
      .from("org_units")
      .select("id, name, metadata, organization_id")
      .eq("id", orgUnitId)
      .single()

    if (unitError || !unit) {
      return NextResponse.json({ error: "Department not found." }, { status: 404 })
    }

    // 2. Prepare merged metadata
    const currentMetadata = unit.metadata && typeof unit.metadata === "object" ? unit.metadata : {}
    const updatedMetadata = {
      ...currentMetadata,
      allocated_budget: Number(allocatedBudget),
      budget_currency: budgetCurrency,
      budget_period: budgetPeriod,
      budget_notes: budgetNotes,
      budget_updated_at: new Date().toISOString(),
      budget_updated_by: user.id,
    }

    // 3. Update org_unit record
    const { data: updatedUnit, error: updateError } = await db
      .from("org_units")
      .update({
        metadata: updatedMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orgUnitId)
      .select("id, name, metadata")
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      success: true,
      message: `Budget of ${allocatedBudget} ${budgetCurrency} successfully allocated to ${unit.name}.`,
      unit: updatedUnit,
    })
  } catch (error: any) {
    console.error("[allocate-budget] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to allocate department budget." },
      { status: 500 }
    )
  }
}
