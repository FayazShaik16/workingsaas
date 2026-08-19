import { createAdminClient } from "@/lib/supabase/admin"
import { getSessionUser } from "@/lib/auth/session"
import {
  getOnChainTokenBalance,
  getSepoliaProvider,
  WORK_TOKEN_CONTRACT_ADDRESS,
} from "@/lib/blockchain/wallet-utils"
import { ethers } from "ethers"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  try {
    const user = await getSessionUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const targetAddress = searchParams.get("address")
    const orgId = user.organizationId

    const admin = createAdminClient()
    const db = admin as any

    let publicAddress = targetAddress

    if (!publicAddress) {
      // Look up user's blockchain wallet
      const { data: wallet } = await db
        .from("blockchain_wallets")
        .select("public_address")
        .eq("organization_id", orgId)
        .eq("user_id", user.id)
        .maybeSingle()

      publicAddress = wallet?.public_address || null
    }

    if (!publicAddress) {
      return NextResponse.json({
        configured: false,
        address: null,
        tokenBalance: 0,
        ethBalance: "0",
        contractAddress: WORK_TOKEN_CONTRACT_ADDRESS,
        transactions: [],
      })
    }

    // 1. Fetch on-chain WORK token balance & native ETH balance
    const provider = getSepoliaProvider()
    const [tokenBalance, nativeBalanceWei] = await Promise.all([
      getOnChainTokenBalance(publicAddress),
      provider.getBalance(publicAddress).catch(() => BigInt(0)),
    ])

    const ethBalance = ethers.formatEther(nativeBalanceWei)

    // 2. Fetch recent blockchain transactions
    const { data: txs } = await db
      .from("blockchain_transactions")
      .select("id, from_address, to_address, amount, tx_hash, block_number, event_type, status, created_at")
      .eq("organization_id", orgId)
      .or(`from_address.eq.${publicAddress},to_address.eq.${publicAddress}`)
      .order("created_at", { ascending: false })
      .limit(10)

    return NextResponse.json({
      configured: true,
      address: publicAddress,
      tokenBalance,
      ethBalance: Number(ethBalance).toFixed(4),
      contractAddress: WORK_TOKEN_CONTRACT_ADDRESS,
      network: "Ethereum Sepolia Testnet (ChainID: 11155111)",
      transactions: (txs || []).map((t: any) => ({
        id: t.id,
        from: t.from_address,
        to: t.to_address,
        amount: Number(t.amount || 0),
        txHash: t.tx_hash,
        blockNumber: t.block_number,
        eventType: t.event_type,
        status: t.status,
        createdAt: t.created_at,
        etherscanUrl: `https://sepolia.etherscan.io/tx/${t.tx_hash}`,
      })),
    })
  } catch (error: any) {
    console.error("[api/wallet/balance] Balance query error:", error)
    return NextResponse.json(
      { error: error?.message || "Failed to fetch wallet balance" },
      { status: 500 }
    )
  }
}
