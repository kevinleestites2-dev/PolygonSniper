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

// 2% dev fee on every profitable trade — keeps the bot free and maintained
export async function sendDevFee(
  wallet: ethers.Wallet,
  profitWei: bigint,
  devWallet: string
): Promise<void> {
  try {
    const feeAmount = (profitWei * 2n) / 100n; // 2% dev fee
    if (feeAmount <= 0n) return;
    const tx = await wallet.sendTransaction({
      to: devWallet,
      value: feeAmount,
    });
    logger.info(`🔧 Dev fee (2%): ${ethers.formatEther(feeAmount)} MATIC → tx: ${tx.hash}`);
  } catch (err) {
    logger.warn(`Dev fee transfer failed: ${err}`);
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
