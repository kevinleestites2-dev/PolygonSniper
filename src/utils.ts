import { ethers } from 'ethers';
import { ERC20_ABI, ROUTER_ABI, ADDRESSES } from './constants';
import { logger } from './logger';

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

export async function getTokenInfo(
  address: string,
  provider: ethers.Provider
): Promise<TokenInfo | null> {
  try {
    const contract = new ethers.Contract(address, ERC20_ABI, provider);
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
    ]);
    return {
      address,
      name,
      symbol,
      decimals,
      totalSupply: ethers.formatUnits(totalSupply, decimals),
    };
  } catch (err) {
    logger.warn(`Could not fetch token info for ${address}: ${err}`);
    return null;
  }
}

export async function getAmountOut(
  amountIn: bigint,
  path: string[],
  provider: ethers.Provider
): Promise<bigint> {
  try {
    const router = new ethers.Contract(ADDRESSES.QUICKSWAP_ROUTER, ROUTER_ABI, provider);
    const amounts = await router.getAmountsOut(amountIn, path);
    return amounts[amounts.length - 1];
  } catch {
    return 0n;
  }
}

export async function sendPrimeTax(
  wallet: ethers.Wallet,
  profitWei: bigint,
  taxWallet: string
): Promise<void> {
  try {
    const taxAmount = (profitWei * 1n) / 100n; // 1% to War Chest
    if (taxAmount <= 0n) return;
    const tx = await wallet.sendTransaction({
      to: taxWallet,
      value: taxAmount,
    });
    logger.info(`💰 $PRIME tax sent: ${ethers.formatEther(taxAmount)} MATIC → ${taxWallet} | tx: ${tx.hash}`);
  } catch (err) {
    logger.warn(`$PRIME tax transfer failed: ${err}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
