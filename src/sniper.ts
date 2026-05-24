import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

import { ADDRESSES, QUICKSWAP_FACTORY_ABI, ERC20_ABI, ROUTER_ABI } from './constants';
import { logger } from './logger';
import { getTokenInfo, getAmountOut, sendPrimeTax, sleep } from './utils';

// ── CONFIG ──────────────────────────────────────────────
const BUY_AMOUNT    = ethers.parseEther(process.env.BUY_AMOUNT    || '0.5');
const SLIPPAGE      = Number(process.env.SLIPPAGE      || 10);
const BUY_DELAY     = Number(process.env.BUY_DELAY     || 500);
const MAX_RETRIES   = Number(process.env.MAX_RETRIES   || 3);
const AUTO_SELL     = process.env.AUTO_SELL === 'true';
const AUTO_SELL_DELAY = Number(process.env.AUTO_SELL_DELAY || 60000);
const TAKE_PROFIT   = Number(process.env.TAKE_PROFIT   || 50);
const STOP_LOSS     = Number(process.env.STOP_LOSS     || 20);
const PRIME_TAX_ENABLED = process.env.PRIME_TAX_ENABLED === 'true';
const PRIME_TAX_WALLET  = process.env.PRIME_TAX_WALLET || '';
const MIN_LIQUIDITY = Number(process.env.MIN_LIQUIDITY || 1000);

// ── PROVIDER + WALLET ───────────────────────────────────
const provider = new ethers.WebSocketProvider(
  process.env.RPC_WEBSOCKET_ENDPOINT || 'wss://polygon-bor-rpc.publicnode.com'
);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

// Track active positions
const positions: Map<string, { buyAmount: bigint; buyPrice: bigint; buyTime: number }> = new Map();

// ── BUY ─────────────────────────────────────────────────
async function buyToken(tokenAddress: string): Promise<bigint | null> {
  const router = new ethers.Contract(ADDRESSES.QUICKSWAP_ROUTER, ROUTER_ABI, wallet);
  const path = [ADDRESSES.WMATIC, tokenAddress];

  // Get expected output with slippage
  const amountsOut = await getAmountOut(BUY_AMOUNT, path, provider);
  if (amountsOut === 0n) {
    logger.warn(`No liquidity found for ${tokenAddress} — skipping`);
    return null;
  }

  const amountOutMin = (amountsOut * BigInt(100 - SLIPPAGE)) / 100n;
  const deadline = Math.floor(Date.now() / 1000) + 60;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tx = await router.swapExactETHForTokens(
        amountOutMin,
        path,
        wallet.address,
        deadline,
        { value: BUY_AMOUNT, gasLimit: 300000 }
      );
      logger.info(`✅ BUY TX sent (attempt ${attempt}): ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`✅ BUY CONFIRMED — block ${receipt.blockNumber}`);
      return amountsOut;
    } catch (err) {
      logger.warn(`BUY attempt ${attempt} failed: ${err}`);
      if (attempt < MAX_RETRIES) await sleep(1000);
    }
  }
  return null;
}

// ── SELL ─────────────────────────────────────────────────
async function sellToken(tokenAddress: string, tokenAmount: bigint): Promise<void> {
  const router  = new ethers.Contract(ADDRESSES.QUICKSWAP_ROUTER, ROUTER_ABI, wallet);
  const token   = new ethers.Contract(tokenAddress, ERC20_ABI, wallet);
  const path    = [tokenAddress, ADDRESSES.WMATIC];

  const amountsOut   = await getAmountOut(tokenAmount, path, provider);
  const amountOutMin = (amountsOut * BigInt(100 - SLIPPAGE)) / 100n;
  const deadline     = Math.floor(Date.now() / 1000) + 60;

  // Approve router to spend token
  const approveTx = await token.approve(ADDRESSES.QUICKSWAP_ROUTER, tokenAmount);
  await approveTx.wait();

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const tx = await router.swapExactTokensForETH(
        tokenAmount,
        amountOutMin,
        path,
        wallet.address,
        deadline,
        { gasLimit: 300000 }
      );
      logger.info(`✅ SELL TX sent (attempt ${attempt}): ${tx.hash}`);
      const receipt = await tx.wait();
      logger.info(`✅ SELL CONFIRMED — block ${receipt.blockNumber}`);

      // $PRIME tax on profit
      if (PRIME_TAX_ENABLED && PRIME_TAX_WALLET && amountsOut > BUY_AMOUNT) {
        const profit = amountsOut - BUY_AMOUNT;
        await sendPrimeTax(wallet, profit, PRIME_TAX_WALLET);
      }
      return;
    } catch (err) {
      logger.warn(`SELL attempt ${attempt} failed: ${err}`);
      if (attempt < MAX_RETRIES) await sleep(1000);
    }
  }
}

// ── POSITION MONITOR ────────────────────────────────────
async function monitorPosition(tokenAddress: string, tokenAmount: bigint, buyPrice: bigint): Promise<void> {
  logger.info(`👁️  Monitoring position for ${tokenAddress}...`);
  await sleep(AUTO_SELL_DELAY);

  const path       = [tokenAddress, ADDRESSES.WMATIC];
  const currentOut = await getAmountOut(tokenAmount, path, provider);
  const pnlPct     = Number(((currentOut - buyPrice) * 100n) / buyPrice);

  logger.info(`📊 PnL for ${tokenAddress}: ${pnlPct.toFixed(2)}%`);

  if (pnlPct >= TAKE_PROFIT) {
    logger.info(`🎯 TAKE PROFIT triggered (${pnlPct.toFixed(2)}%) — selling`);
    await sellToken(tokenAddress, tokenAmount);
  } else if (pnlPct <= -STOP_LOSS) {
    logger.warn(`🛑 STOP LOSS triggered (${pnlPct.toFixed(2)}%) — selling`);
    await sellToken(tokenAddress, tokenAmount);
  } else if (AUTO_SELL) {
    logger.info(`⏱️  Auto-sell delay elapsed — selling`);
    await sellToken(tokenAddress, tokenAmount);
  }

  positions.delete(tokenAddress);
}

// ── NEW PAIR HANDLER ────────────────────────────────────
async function handleNewPair(token0: string, token1: string, pairAddress: string): Promise<void> {
  // Identify the snipe target (the non-WMATIC/USDC token)
  const quoteTokens = [ADDRESSES.WMATIC, ADDRESSES.USDC, ADDRESSES.USDT];
  const targetToken = quoteTokens.includes(token0.toLowerCase())
    ? token1
    : quoteTokens.includes(token1.toLowerCase())
    ? token0
    : null;

  if (!targetToken) {
    logger.debug(`Pair ${pairAddress} — no MATIC/USDC base, skipping`);
    return;
  }

  // Get token info
  const info = await getTokenInfo(targetToken, provider);
  if (!info) return;

  logger.info(`🎯 NEW PAIR DETECTED: ${info.symbol} (${info.name})`);
  logger.info(`   Token: ${targetToken}`);
  logger.info(`   Pair:  ${pairAddress}`);

  // Check liquidity
  const liquidity = await getAmountOut(
    ethers.parseEther('1'),
    [ADDRESSES.WMATIC, targetToken],
    provider
  );
  const liquidityUSD = Number(ethers.formatEther(liquidity));
  if (liquidityUSD < MIN_LIQUIDITY / 2000) {
    logger.warn(`⚠️  Low liquidity ($${(liquidityUSD * 2000).toFixed(0)}) — skipping`);
    return;
  }

  // Buy delay
  if (BUY_DELAY > 0) {
    logger.info(`⏳ Waiting ${BUY_DELAY}ms before sniping...`);
    await sleep(BUY_DELAY);
  }

  // Execute snipe
  logger.info(`🚀 SNIPING ${info.symbol}...`);
  const tokenAmount = await buyToken(targetToken);
  if (!tokenAmount) return;

  positions.set(targetToken, {
    buyAmount: BUY_AMOUNT,
    buyPrice: tokenAmount,
    buyTime: Date.now(),
  });

  // Monitor position in background
  if (AUTO_SELL) {
    monitorPosition(targetToken, tokenAmount, tokenAmount).catch((err) =>
      logger.error(`Position monitor error: ${err}`)
    );
  }
}

// ── MAIN WATCHER ─────────────────────────────────────────
export async function startSniper(): Promise<void> {
  logger.info('🐍 PolygonSniper v1.0 — Pantheon Edition');
  logger.info(`👛 Wallet: ${wallet.address}`);
  logger.info(`💸 Buy amount: ${ethers.formatEther(BUY_AMOUNT)} MATIC`);
  logger.info(`📈 Take profit: ${TAKE_PROFIT}% | Stop loss: ${STOP_LOSS}%`);
  logger.info(`💀 $PRIME tax: ${PRIME_TAX_ENABLED ? 'ENABLED' : 'disabled'}`);
  logger.info('👂 Listening for new pairs on QuickSwap...\n');

  const factory = new ethers.Contract(
    ADDRESSES.QUICKSWAP_FACTORY,
    QUICKSWAP_FACTORY_ABI,
    provider
  );

  factory.on('PairCreated', async (token0: string, token1: string, pairAddress: string) => {
    try {
      await handleNewPair(token0, token1, pairAddress);
    } catch (err) {
      logger.error(`PairCreated handler error: ${err}`);
    }
  });

  // Keep alive
  process.on('SIGINT', () => {
    logger.info('Shutting down PolygonSniper...');
    provider.destroy();
    process.exit(0);
  });
}
