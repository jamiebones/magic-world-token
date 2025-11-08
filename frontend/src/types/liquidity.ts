export interface LiquidityPosition {
  tokenId: bigint;
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
  feeGrowthInside0: bigint;
  feeGrowthInside1: bigint;
  amount0?: bigint;
  amount1?: bigint;
  inRange?: boolean;
  currentPrice?: number; // Current price in USD
  minPrice?: number; // Min price of range in USD
  maxPrice?: number; // Max price of range in USD
  currentTick?: number; // Current pool tick
}

export interface PoolState {
  sqrtPriceX96: bigint;
  tick: number;
  observationIndex: number;
  observationCardinality: number;
  observationCardinalityNext: number;
  feeProtocol: number;
  unlocked: boolean;
  liquidity: bigint;
}

export interface AddLiquidityParams {
  token0: string;
  token1: string;
  fee: number;
  tickLower: number;
  tickUpper: number;
  amount0Desired: bigint;
  amount1Desired: bigint;
  amount0Min: bigint;
  amount1Min: bigint;
  recipient: string;
  deadline: number;
}

export interface CalculatedAmounts {
  bnbAmount: number;
  mwgAmount: number;
  bnbAmountWei: bigint;
  mwgAmountWei: bigint;
  targetPrice: number;
  lowerPrice: number;
  upperPrice: number;
  currentTick: number;
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint;
  feeTier: number;
}

export interface PriceData {
  bnbUsd: number;
  btcUsd: number;
  mwgBnb?: number;
  mwgUsd?: number;
}

export const FEE_TIERS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 2500,   // 0.25%
  HIGH: 10000,    // 1%
} as const;

export type FeeTier = typeof FEE_TIERS[keyof typeof FEE_TIERS];

export const TICK_SPACINGS: Record<FeeTier, number> = {
  [FEE_TIERS.LOWEST]: 1,
  [FEE_TIERS.LOW]: 10,
  [FEE_TIERS.MEDIUM]: 50,
  [FEE_TIERS.HIGH]: 200,
};
