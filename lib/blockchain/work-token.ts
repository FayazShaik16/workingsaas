import { ethers } from "ethers"
import crypto from "crypto"

export const WORK_TOKEN_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function owner() view returns (address)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]

export const SEPOLIA_CHAIN_ID = 11155111

/**
 * Standard Sepolia Etherscan transaction URL builder
 */
export function getEtherscanTxUrl(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`
}

/**
 * Authenticated AES-256-GCM encryption for custodial wallet private keys
 */
export function encryptPrivateKey(privateKeyHex: string): string {
  const masterKey = process.env.WALLET_ENCRYPTION_KEY
  if (!masterKey) {
    throw new Error("WALLET_ENCRYPTION_KEY is not configured in server environment.")
  }

  const key = crypto.createHash("sha256").update(masterKey).digest()
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)

  let encrypted = cipher.update(privateKeyHex, "utf8", "hex")
  encrypted += cipher.final("hex")
  const authTag = cipher.getAuthTag().toString("hex")

  return `${iv.toString("hex")}:${authTag}:${encrypted}`
}

/**
 * Authenticated AES-256-GCM decryption for custodial wallet private keys
 */
export function decryptPrivateKey(encryptedPayload: string): string {
  const masterKey = process.env.WALLET_ENCRYPTION_KEY
  if (!masterKey) {
    throw new Error("WALLET_ENCRYPTION_KEY is not configured in server environment.")
  }

  const parts = encryptedPayload.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted private key format.")
  }

  const [ivHex, authTagHex, encryptedHex] = parts
  const key = crypto.createHash("sha256").update(masterKey).digest()
  const iv = Buffer.from(ivHex, "hex")
  const authTag = Buffer.from(authTagHex, "hex")

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Safe Blockchain Readiness Check (No private keys exposed)
 */
export async function checkBlockchainReadiness(): Promise<{
  configured: boolean
  chainId?: number
  rpcReachable: boolean
  workTokenAddress?: string
  tokenName?: string
  tokenSymbol?: string
  tokenDecimals?: number
  contractOwner?: string
  isOwnerMatched?: boolean
  treasuryAddress?: string
  treasuryEthBalance?: string
  treasuryWorkBalance?: string
  codeExists?: boolean
  statusMessage: string
}> {
  const rpcUrl = process.env.SEPOLIA_RPC_URL
  const tokenAddress = process.env.WORK_TOKEN_ADDRESS
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY

  if (!rpcUrl || !tokenAddress || !treasuryKey) {
    return {
      configured: false,
      rpcReachable: false,
      statusMessage: "Sepolia RPC, Work Token Address, or Treasury Key not configured in environment.",
    }
  }

  if (!ethers.isAddress(tokenAddress)) {
    return {
      configured: false,
      rpcReachable: false,
      statusMessage: `Invalid WORK_TOKEN_ADDRESS format: ${tokenAddress}`,
    }
  }

  try {
    const provider = new ethers.JsonRpcProvider(rpcUrl)
    const network = await provider.getNetwork()
    const chainId = Number(network.chainId)

    const code = await provider.getCode(tokenAddress)
    const codeExists = Boolean(code && code !== "0x")

    const treasuryWallet = new ethers.Wallet(treasuryKey, provider)
    const treasuryAddress = treasuryWallet.address

    const ethBalanceWei = await provider.getBalance(treasuryAddress)
    const treasuryEthBalance = ethers.formatEther(ethBalanceWei)

    const contract = new ethers.Contract(tokenAddress, WORK_TOKEN_ABI, provider)
    const [name, symbol, decimals, tokenBalanceWei, owner] = await Promise.all([
      contract.name().catch(() => "WorkLedger Token"),
      contract.symbol().catch(() => "WORK"),
      contract.decimals().catch(() => 18),
      contract.balanceOf(treasuryAddress).catch(() => BigInt(0)),
      contract.owner().catch(() => null),
    ])

    const treasuryWorkBalance = ethers.formatUnits(tokenBalanceWei, decimals)
    const isOwnerMatched = owner ? owner.toLowerCase() === treasuryAddress.toLowerCase() : false

    return {
      configured: true,
      chainId,
      rpcReachable: true,
      codeExists,
      workTokenAddress: tokenAddress,
      tokenName: name,
      tokenSymbol: symbol,
      tokenDecimals: Number(decimals),
      contractOwner: owner || undefined,
      isOwnerMatched,
      treasuryAddress,
      treasuryEthBalance,
      treasuryWorkBalance,
      statusMessage: codeExists
        ? "Sepolia testnet connection active, contract bytecode verified, and treasury ready."
        : "RPC connected, but no bytecode found at contract address (not deployed on this chain).",
    }
  } catch (error: any) {
    return {
      configured: false,
      rpcReachable: false,
      statusMessage: `Sepolia connection check failed: ${error?.message || error}`,
    }
  }
}

/**
 * Execute real Sepolia ERC-20 salary settlement mint/transfer
 */
export async function executeSalaryMint(params: {
  recipientAddress: string
  amount: number
}): Promise<{
  txHash: string
  blockNumber: number
  gasUsed: string
  etherscanUrl: string
}> {
  const rpcUrl = process.env.SEPOLIA_RPC_URL
  const tokenAddress = process.env.WORK_TOKEN_ADDRESS
  const treasuryKey = process.env.TREASURY_PRIVATE_KEY

  if (!rpcUrl || !tokenAddress || !treasuryKey) {
    throw new Error("Blockchain integration is not configured. Missing required environment variables.")
  }

  if (!ethers.isAddress(params.recipientAddress)) {
    throw new Error(`Invalid recipient address format: ${params.recipientAddress}`)
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const treasuryWallet = new ethers.Wallet(treasuryKey, provider)
  const contract = new ethers.Contract(tokenAddress, WORK_TOKEN_ABI, treasuryWallet)

  const decimals = await contract.decimals().catch(() => 18)
  const amountWei = ethers.parseUnits(params.amount.toString(), decimals)

  // Call mint(to, amount) as owner
  let tx
  try {
    tx = await contract.mint(params.recipientAddress, amountWei)
  } catch (mintErr: any) {
    // If contract does not have mint or caller is not owner, attempt transfer fallback
    console.warn("[executeSalaryMint] mint failed, falling back to treasury transfer:", mintErr?.message)
    tx = await contract.transfer(params.recipientAddress, amountWei)
  }

  const receipt = await tx.wait(1)

  if (!receipt || receipt.status !== 1) {
    throw new Error(`On-chain transaction failed or reverted. Tx hash: ${tx.hash}`)
  }

  return {
    txHash: tx.hash,
    blockNumber: receipt.blockNumber,
    gasUsed: receipt.gasUsed ? receipt.gasUsed.toString() : "45000",
    etherscanUrl: getEtherscanTxUrl(tx.hash),
  }
}

export const executeSalaryTransfer = executeSalaryMint
