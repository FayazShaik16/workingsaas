import { createClient } from "@/lib/supabase/server"
import { getSessionUser } from "@/lib/auth/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { createRandomWallet, fundWallet } from "@/lib/blockchain/wallet-utils"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { purpose = "PERSONAL", targetUserId, orgId: reqOrgId } = (await req.json().catch(() => ({}))) as {
      purpose?: "PERSONAL" | "SALARY_POOL" | "LOAN_POOL" | "GENESIS"
      targetUserId?: string
      orgId?: string
    }

    const orgId = reqOrgId || user.organizationId
    const effectiveUserId = targetUserId || user.id

    const admin = createAdminClient()
    const db = admin as any

    // 1. Check for existing blockchain wallet
    const { data: existingWallet } = await db
      .from("blockchain_wallets")
      .select("id, public_address, purpose, network, created_at")
      .eq("organization_id", orgId)
      .eq("user_id", purpose === "GENESIS" ? null : effectiveUserId)
      .eq("purpose", purpose)
      .maybeSingle()

    if (existingWallet) {
      return NextResponse.json({
        success: true,
        isNew: false,
        wallet: {
          id: existingWallet.id,
          address: existingWallet.public_address,
          purpose: existingWallet.purpose,
          network: existingWallet.network,
          createdAt: existingWallet.created_at,
        },
      })
    }

    // 2. Generate new AES-encrypted blockchain wallet
    const { address, encryptedPrivateKey } = createRandomWallet()

    const { data: newWallet, error: insertError } = await db
      .from("blockchain_wallets")
      .insert({
        organization_id: orgId,
        user_id: purpose === "GENESIS" ? null : effectiveUserId,
        public_address: address,
        encrypted_private_key: encryptedPrivateKey,
        purpose,
        network: "sepolia",
      })
      .select("id, public_address, purpose, network, created_at")
      .single()

    if (insertError) {
      console.error("[api/wallet/create] Insert error:", insertError)
      return NextResponse.json(
        { error: `Failed to store blockchain wallet: ${insertError.message}` },
        { status: 500 }
      )
    }

    // 3. Asynchronously trigger gas funding for personal wallets
    if (purpose === "PERSONAL") {
      fundWallet(address).catch((err) => {
        console.warn("[api/wallet/create] Background gas funding note:", err)
      })
    }

    return NextResponse.json({
      success: true,
      isNew: true,
      wallet: {
        id: newWallet.id,
        address: newWallet.public_address,
        purpose: newWallet.purpose,
        network: newWallet.network,
        createdAt: newWallet.created_at,
      },
    })
  } catch (error: any) {
    console.error("[api/wallet/create] Unhandled error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}
