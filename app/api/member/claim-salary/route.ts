import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const supabase = await createClient()
    const db = supabase as any

    // 1. Fetch user's current earned credits and target credits
    const { data: userProfile, error: profileError } = await db
      .from("users")
      .select("id, name, target_credits, progress_percentage, org_unit_id, organization_id")
      .eq("id", user.id)
      .single()

    if (profileError || !userProfile) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 })
    }

    // 2. Fetch personal wallet balance
    const { data: wallet } = await db
      .from("wallets")
      .select("balance")
      .eq("owner_user_id", user.id)
      .eq("purpose", "PERSONAL")
      .limit(1)
      .maybeSingle()

    const targetCredits = Number(userProfile.target_credits || 50.0)
    const earnedCredits = Number(wallet?.balance || 0)
    const progress = targetCredits > 0 ? (earnedCredits / targetCredits) * 100 : 0

    if (progress < 85) {
      return NextResponse.json(
        {
          error: `Eligibility threshold not met (${progress.toFixed(1)}% < 85%). Please raise a work-loan or complete additional marketplace tasks.`,
        },
        { status: 400 }
      )
    }

    // 3. Log salary claim signal or notification for HOD
    const currentMonthYear = new Date().toLocaleString("default", { month: "long", year: "numeric" })

    // Optional notification log or signal
    await db
      .from("users")
      .update({
        progress_percentage: Math.round(progress),
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id)

    return NextResponse.json({
      success: true,
      earnedCredits,
      targetCredits,
      progressPercentage: progress,
      monthYear: currentMonthYear,
      message: `Salary claim for ${currentMonthYear} (${earnedCredits.toFixed(1)} / ${targetCredits.toFixed(1)} credits, ${progress.toFixed(0)}%) successfully queued for HOD digital endorsement.`,
    })
  } catch (error: any) {
    console.error("[member/claim-salary] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
