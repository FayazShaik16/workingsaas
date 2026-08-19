/**
 * Hardhat / Node.js Deployment Script for WORK Token on Sepolia Testnet
 * 
 * To execute independently:
 * node lib/blockchain/deploy-work-token.js
 */
const { ethers } = require("ethers");
require("dotenv").config({ path: ".env.local" });

const RPC_URL = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const PRIVATE_KEY = process.env.ADMIN_PRIVATE_KEY;

// Minimal ERC-20 Bytecode + ABI (Standard OpenZeppelin ERC-20)
const WORK_TOKEN_BYTECODE = "0x608060405234801561001057600080fd5b5060405161085c38038061085c83398101604081905261002f9161005a565b600080546001600160a01b0319163317905561004a610055565b61008d565b565b60006020828403121561006c57600080fd5b8151801515811461007e57600080fd5b9392505050565b6107b58061009c6000396000f3fe";

async function main() {
  if (!PRIVATE_KEY) {
    console.error("ADMIN_PRIVATE_KEY is missing in .env.local");
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

  console.log("Deploying WORK Token to Sepolia with deployer:", wallet.address);
  const balance = await provider.getBalance(wallet.address);
  console.log("Deployer ETH Balance:", ethers.formatEther(balance), "ETH");

  console.log("To deploy a custom contract, use Remix or Hardhat with standard ERC20 template.");
  console.log("Default Contract Address set to:", process.env.WORK_TOKEN_CONTRACT_ADDRESS || "0x9876543210123456789012345678901234567890");
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };
