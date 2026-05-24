// ── POLYGON CONTRACT ADDRESSES ──────────────────────────
export const ADDRESSES = {
  WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
  USDC:   '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  USDT:   '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',

  // QuickSwap V2 Factory
  QUICKSWAP_FACTORY: '0x5757371414417b8C6CAad45bAeF941aBc7d3Ab32',
  // QuickSwap V2 Router
  QUICKSWAP_ROUTER:  '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff',

  // Uniswap V3 Factory on Polygon
  UNISWAP_V3_FACTORY: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
  // Uniswap V3 Router on Polygon
  UNISWAP_V3_ROUTER:  '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
};

// QuickSwap V2 PairCreated event ABI
export const QUICKSWAP_FACTORY_ABI = [
  'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
];

// Uniswap V3 PoolCreated event ABI
export const UNISWAP_V3_FACTORY_ABI = [
  'event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)',
];

// Minimal ERC20 ABI
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

// QuickSwap Router ABI (swap methods)
export const ROUTER_ABI = [
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) payable returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) returns (uint[] memory amounts)',
  'function getAmountsOut(uint amountIn, address[] calldata path) view returns (uint[] memory amounts)',
];
