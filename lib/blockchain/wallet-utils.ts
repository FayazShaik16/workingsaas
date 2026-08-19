import { ethers } from "ethers"
import CryptoJS from "crypto-js"
import WORK_TOKEN_ABI from "./WorkTokenABI.json"

const DEFAULT_SEPOLIA_RPC = "https://ethereum-sepolia-rpc.publicnode.com"
const DEFAULT_ENCRYPTION_KEY = "workledger-sepolia-aes-master-key-2026!"
export const WORK_TOKEN_CONTRACT_ADDRESS =
  process.env.WORK_TOKEN_CONTRACT_ADDRESS || "0x9876543210123456789012345678901234567890"

/**
 * Helper to build standard Sepolia Etherscan link.
 */
export function getEtherscanTxUrl(txHash: string): string {
  return `https://sepolia.etherscan.io/tx/${txHash}`
}

/**
 * Get configured JSON-RPC provider for Sepolia testnet.
 */
export function getSepoliaProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.SEPOLIA_RPC_URL || DEFAULT_SEPOLIA_RPC
  return new ethers.JsonRpcProvider(rpcUrl)
}

/**
 * Generates a fresh random Ethereum wallet, encrypts the private key via AES-256.
 */
export function createRandomWallet(): {
  address: string
  encryptedPrivateKey: string
  mnemonic?: string
} {
  const randomWallet = ethers.Wallet.createRandom()
  const encryptionKey = process.env.WALLET_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY

  const encryptedPrivateKey = CryptoJS.AES.encrypt(
    randomWallet.privateKey,
    encryptionKey
  ).toString()

  return {
    address: randomWallet.address,
    encryptedPrivateKey,
    mnemonic: randomWallet.mnemonic?.phrase,
  }
}

/**
 * Decrypts an AES-256 encrypted private key in server memory.
 * Keys are never logged and never exposed to the client.
 */
export function decryptPrivateKey(encryptedPrivateKey: string): string {
  const primaryKey = process.env.WALLET_ENCRYPTION_KEY || DEFAULT_ENCRYPTION_KEY
  const backupKey = process.env.BACKUP_WALLET_ENCRYPTION_KEY

  try {
    const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, primaryKey)
    const decrypted = bytes.toString(CryptoJS.enc.Utf8)
    if (decrypted && decrypted.startsWith("0x")) return decrypted
  } catch (err) {
    console.warn("[wallet-utils] Primary AES key failed, attempting backup key...")
  }

  if (backupKey) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedPrivateKey, backupKey)
      const decrypted = bytes.toString(CryptoJS.enc.Utf8)
      if (decrypted && decrypted.startsWith("0x")) return decrypted
    } catch (err) {
      console.error("[wallet-utils] Backup AES decryption also failed.")
    }
  }

  throw new Error("Unable to decrypt blockchain private key.")
}

/**
 * Instantiate an ethers.Wallet instance for an encrypted private key attached to Sepolia.
 */
export function getWalletInstance(encryptedPrivateKey: string): ethers.Wallet {
  const privateKey = decryptPrivateKey(encryptedPrivateKey)
  const provider = getSepoliaProvider()
  return new ethers.Wallet(privateKey, provider)
}

/**
 * Get the Director / Org Admin Genesis Signer that pays gas for relays.
 */
export function getAdminWallet(): ethers.Wallet | null {
  const adminKey = process.env.ADMIN_PRIVATE_KEY
  if (!adminKey) {
    return null
  }
  const provider = getSepoliaProvider()
  return new ethers.Wallet(adminKey, provider)
}

/**
 * Instantiate the WORK Token contract attached to a signer or provider.
 */
export function getTokenContract(
  signerOrProvider?: ethers.Signer | ethers.Provider
): ethers.Contract {
  const provider = signerOrProvider || getSepoliaProvider()
  return new ethers.Contract(WORK_TOKEN_CONTRACT_ADDRESS, WORK_TOKEN_ABI, provider)
}

/**
 * Funds a new user's wallet with Sepolia ETH from the admin wallet so they can broadcast transactions.
 */
export async function fundWallet(
  recipientAddress: string,
  amountEth: string = "0.005"
): Promise<{ txHash: string; success: boolean }> {
  const adminWallet = getAdminWallet()
  if (!adminWallet) {
    console.warn("[wallet-utils] Admin wallet key not configured, skipping gas funding.")
    return { txHash: `sim_fund_${Date.now()}`, success: true }
  }

  try {
    const tx = await adminWallet.sendTransaction({
      to: recipientAddress,
      value: ethers.parseEther(amountEth),
    })
    return { txHash: tx.hash, success: true }
  } catch (error: any) {
    console.error("[wallet-utils] Gas funding failed:", error)
    return { txHash: "", success: false }
  }
}

/**
 * Fetch real-time on-chain ERC-20 token balance for an address.
 */
export async function getOnChainTokenBalance(address: string): Promise<number> {
  try {
    const contract = getTokenContract()
    const rawBalance = await contract.balanceOf(address)
    const decimals = await contract.decimals().catch(() => 18)
    return Number(ethers.formatUnits(rawBalance, decimals))
  } catch (error) {
    // Return 0 if contract query fails or address has 0 balance
    return 0
  }
}
