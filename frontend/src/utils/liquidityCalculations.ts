import { CalculatedAmounts, TICK_SPACINGS, FeeTier } from '@/types/liquidity';

/**
 * Calculate sqrtPriceX96 from price
 * Formula: sqrtPriceX96 = sqrt(price) * 2^96
 */
export function calculateSqrtPriceX96(priceToken1PerToken0: number): bigint {
  // Uniswap V3 uses price = token1/token0
  const sqrtPrice = Math.sqrt(priceToken1PerToken0);
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));
  return sqrtPriceX96;
}

/**
 * Calculate sqrt price from tick
 * Formula: sqrtPrice = 1.0001^(tick/2)
 */
function getSqrtRatioAtTick(tick: number): number {
  return Math.pow(1.0001, tick / 2);
}

/**
 * Calculate liquidity from amount0 (token0 amount)
 * Formula: L = amount0 * (sqrt(upper) * sqrt(lower)) / (sqrt(upper) - sqrt(lower))
 */
function getLiquidityForAmount0(
  sqrtRatioA: number,
  sqrtRatioB: number,
  amount0: number
): number {
  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }
  const intermediate = sqrtRatioA * sqrtRatioB;
  return (amount0 * intermediate) / (sqrtRatioB - sqrtRatioA);
}

/**
 * Calculate liquidity from amount1 (token1 amount)
 * Formula: L = amount1 / (sqrt(upper) - sqrt(lower))
 */
function getLiquidityForAmount1(
  sqrtRatioA: number,
  sqrtRatioB: number,
  amount1: number
): number {
  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }
  return amount1 / (sqrtRatioB - sqrtRatioA);
}

/**
 * Calculate liquidity from amounts
 * Takes the minimum of the two to ensure we don't exceed available tokens
 */
function getLiquidityForAmounts(
  sqrtRatioX: number,
  sqrtRatioA: number,
  sqrtRatioB: number,
  amount0: number,
  amount1: number
): number {
  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }

  let liquidity: number;
  if (sqrtRatioX <= sqrtRatioA) {
    // Current price is below range, only need token0
    liquidity = getLiquidityForAmount0(sqrtRatioA, sqrtRatioB, amount0);
  } else if (sqrtRatioX < sqrtRatioB) {
    // Current price is within range, need both tokens
    const liquidity0 = getLiquidityForAmount0(sqrtRatioX, sqrtRatioB, amount0);
    const liquidity1 = getLiquidityForAmount1(sqrtRatioA, sqrtRatioX, amount1);
    liquidity = Math.min(liquidity0, liquidity1);
  } else {
    // Current price is above range, only need token1
    liquidity = getLiquidityForAmount1(sqrtRatioA, sqrtRatioB, amount1);
  }

  return liquidity;
}

/**
 * Calculate amount0 from liquidity
 * Formula: amount0 = L * (sqrt(upper) - sqrt(lower)) / (sqrt(upper) * sqrt(lower))
 */
function getAmount0ForLiquidity(
  sqrtRatioA: number,
  sqrtRatioB: number,
  liquidity: number
): number {
  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }
  return (liquidity * (sqrtRatioB - sqrtRatioA)) / (sqrtRatioB * sqrtRatioA);
}

/**
 * Calculate amount1 from liquidity
 * Formula: amount1 = L * (sqrt(upper) - sqrt(lower))
 */
function getAmount1ForLiquidity(
  sqrtRatioA: number,
  sqrtRatioB: number,
  liquidity: number
): number {
  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }
  return liquidity * (sqrtRatioB - sqrtRatioA);
}

/**
 * Calculate amounts from liquidity value
 */
function getAmountsForLiquidity(
  sqrtRatioX: number,
  sqrtRatioA: number,
  sqrtRatioB: number,
  liquidity: number
): { amount0: number; amount1: number } {
  if (sqrtRatioA > sqrtRatioB) {
    [sqrtRatioA, sqrtRatioB] = [sqrtRatioB, sqrtRatioA];
  }

  let amount0 = 0;
  let amount1 = 0;

  if (sqrtRatioX <= sqrtRatioA) {
    // Current price is below range, only need token0
    amount0 = getAmount0ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity);
  } else if (sqrtRatioX < sqrtRatioB) {
    // Current price is within range, need both tokens
    amount0 = getAmount0ForLiquidity(sqrtRatioX, sqrtRatioB, liquidity);
    amount1 = getAmount1ForLiquidity(sqrtRatioA, sqrtRatioX, liquidity);
  } else {
    // Current price is above range, only need token1
    amount1 = getAmount1ForLiquidity(sqrtRatioA, sqrtRatioB, liquidity);
  }

  return { amount0, amount1 };
}

/**
 * Calculate price from sqrtPriceX96
 */
export function calculatePriceFromSqrtPriceX96(sqrtPriceX96: bigint, token0IsMWG: boolean): number {
  const Q96 = BigInt(2) ** BigInt(96);
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  const price = sqrtPrice ** 2;
  
  // If MWG is token0, price is BNB/MWG, so MWG/BNB = 1/price
  return token0IsMWG ? (1 / price) : price;
}

/**
 * Calculate tick from price
 * Formula: tick = floor(log_1.0001(price))
 */
export function calculateTick(priceToken1PerToken0: number): number {
  const tick = Math.floor(Math.log(priceToken1PerToken0) / Math.log(1.0001));
  return tick;
}

/**
 * Round tick to nearest valid tick spacing
 */
export function roundToTickSpacing(tick: number, feeTier: FeeTier): number {
  const spacing = TICK_SPACINGS[feeTier];
  return Math.floor(tick / spacing) * spacing;
}

/**
 * Get token order (token0 < token1 by address)
 */
export function getTokenOrder(tokenA: string, tokenB: string): {
  token0: string;
  token1: string;
  token0IsA: boolean;
} {
  const token0IsA = tokenA.toLowerCase() < tokenB.toLowerCase();
  return {
    token0: token0IsA ? tokenA : tokenB,
    token1: token0IsA ? tokenB : tokenA,
    token0IsA,
  };
}

/**
 * Calculate required token amounts for target price using V3 math
 */
export function calculateRequiredAmounts(
  targetPriceUSD: number,
  totalLiquidityUSD: number,
  bnbPriceUSD: number,
  feeTier: FeeTier,
  priceRangePercent: number,
  mwgTokenAddress: string,
  wbnbAddress: string
): CalculatedAmounts {
  // Convert USD price to BNB price (BNB per MWG)
  const bnbPerMwg = targetPriceUSD / bnbPriceUSD;

  // Determine token order
  const { token0IsA: token0IsMWG } = getTokenOrder(mwgTokenAddress, wbnbAddress);

  // Uniswap V3 price is token1/token0
  // If token0 is MWG, token1 is WBNB -> price = BNB per MWG = bnbPerMwg
  // If token0 is WBNB, token1 is MWG -> price = MWG per BNB = 1 / bnbPerMwg
  const poolPrice = token0IsMWG ? bnbPerMwg : (bnbPerMwg === 0 ? 0 : 1 / bnbPerMwg);

  // Calculate tick and range off the standardized pool price
  const currentTick = calculateTick(poolPrice);
  
  // Calculate price range, but cap the lower range to prevent going to 0
  // Max range percentage is 99% to avoid lowerPrice becoming 0
  const effectiveRangePercent = Math.min(priceRangePercent, 99);
  const lowerPrice = poolPrice * (1 - effectiveRangePercent / 100);
  const upperPrice = poolPrice * (1 + priceRangePercent / 100);

  const tickLower = roundToTickSpacing(calculateTick(lowerPrice), feeTier);
  const tickUpper = roundToTickSpacing(calculateTick(upperPrice), feeTier);

  console.log('🎯 Pool price (token1/token0):', poolPrice, 'token0IsMWG:', token0IsMWG);
  console.log('✅ Tick range:', tickLower, 'to', tickUpper);

  // Calculate sqrt prices for the range
  const sqrtRatioX = getSqrtRatioAtTick(currentTick);
  const sqrtRatioA = getSqrtRatioAtTick(tickLower);
  const sqrtRatioB = getSqrtRatioAtTick(tickUpper);

  console.log('📐 V3 Math - Current tick:', currentTick);
  console.log('📐 V3 Math - sqrtRatioX:', sqrtRatioX, '(at tick', currentTick, ')');
  console.log('📐 V3 Math - sqrtRatioA:', sqrtRatioA, '(at tick', tickLower, ')');
  console.log('📐 V3 Math - sqrtRatioB:', sqrtRatioB, '(at tick', tickUpper, ')');
  console.log('📐 V3 Math - Price within range?', currentTick >= tickLower && currentTick <= tickUpper);
  console.log('📐 V3 Math - sqrtRatio within range?', sqrtRatioX >= sqrtRatioA && sqrtRatioX <= sqrtRatioB);

  // Start with a target liquidity value based on total USD amount
  // For V3, liquidity (L) is measured differently than simple token amounts
  // We'll use an iterative approach: start with estimated amounts, calculate L, then derive actual amounts
  
  // Initial estimate: split USD value 50/50
  const liquidityPerSide = totalLiquidityUSD / 2;
  const estimatedBNB = liquidityPerSide / bnbPriceUSD;
  const estimatedMWG = token0IsMWG
    ? (poolPrice === 0 ? 0 : estimatedBNB / poolPrice)
    : estimatedBNB * poolPrice;

  console.log('💡 Initial estimates - BNB:', estimatedBNB, 'MWG:', estimatedMWG);

  // Convert to token0/token1 based on order
  // For V3, when current price is in range, we need BOTH tokens
  // The simplest reliable approach: just use the estimated amounts directly
  // and let the contract adjust them based on the actual pool state
  
  let bnbAmount, mwgAmount;
  if (token0IsMWG) {
    mwgAmount = estimatedMWG;
    bnbAmount = estimatedBNB;
  } else {
    bnbAmount = estimatedBNB;
    mwgAmount = estimatedMWG;
  }

  console.log('💰 Using estimated amounts directly - BNB:', bnbAmount, 'MWG:', mwgAmount);
  console.log('ℹ️  Note: Actual amounts used may differ based on pool state');

  // Calculate sqrtPriceX96
  const sqrtPriceX96 = calculateSqrtPriceX96(poolPrice);

  return {
    bnbAmount,
    mwgAmount,
    bnbAmountWei: BigInt(Math.floor(bnbAmount * 1e18)),
    mwgAmountWei: BigInt(Math.floor(mwgAmount * 1e18)),
  targetPrice: poolPrice,
    lowerPrice,
    upperPrice,
    currentTick,
    tickLower,
    tickUpper,
    sqrtPriceX96,
    feeTier,
  };
}

/**
 * Format large numbers with commas
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format token amount (from wei to human-readable)
 */
export function formatTokenAmount(amount: bigint, decimals: number = 18): string {
  const divisor = 10 ** decimals;
  const value = Number(amount) / divisor;
  return formatNumber(value, 6);
}

/**
 * Calculate slippage-adjusted amounts
 */
export function calculateMinAmounts(
  amount0: bigint,
  amount1: bigint,
  slippageTolerance: number
): { amount0Min: bigint; amount1Min: bigint } {
  const multiplier = Math.floor((1 - slippageTolerance / 100) * 10000);
  
  return {
    amount0Min: (amount0 * BigInt(multiplier)) / BigInt(10000),
    amount1Min: (amount1 * BigInt(multiplier)) / BigInt(10000),
  };
}

/**
 * Compute safe min amounts for a V3 mint based on current pool price and tick range.
 * This avoids reverts when one side is underutilized (or zero) by estimating
 * the actually-consumed amounts at the current sqrtPriceX96, then applying slippage.
 */
export function calculateMintMinFromPoolState(params: {
  amount0Desired: bigint;
  amount1Desired: bigint;
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint;
  slippageTolerance: number; // percent, e.g. 5 for 5%
}): { amount0Min: bigint; amount1Min: bigint } {
  const { amount0Desired, amount1Desired, tickLower, tickUpper, sqrtPriceX96, slippageTolerance } = params;

  // Convert desired to floating token amounts (assume 18 decimals for both MWG and WBNB)
  const d0 = Number(amount0Desired) / 1e18;
  const d1 = Number(amount1Desired) / 1e18;

  // Convert sqrtPriceX96 to float ratio
  const Q96 = 2 ** 96; // fits in JS number safely when used as divisor multiplier here
  const sqrtX = Number(sqrtPriceX96) / Q96;

  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);

  // Estimate max feasible liquidity given desired amounts
  const L = getLiquidityForAmounts(sqrtX, sqrtA, sqrtB, d0, d1);
  // Derive the actually-consumed amounts at current price
  const used = getAmountsForLiquidity(sqrtX, sqrtA, sqrtB, L);

  // Apply slippage buffer downward
  const factor = 1 - slippageTolerance / 100;
  const min0 = Math.max(0, Math.floor(used.amount0 * factor * 1e18));
  const min1 = Math.max(0, Math.floor(used.amount1 * factor * 1e18));

  return { amount0Min: BigInt(min0), amount1Min: BigInt(min1) };
}

/**
 * Estimate the actually-used amounts for a V3 mint at current pool price.
 * Useful for UI guidance (e.g., one-sided deposits) before sending the tx.
 */
export function estimateUsageFromPoolState(params: {
  amount0Desired: bigint;
  amount1Desired: bigint;
  tickLower: number;
  tickUpper: number;
  sqrtPriceX96: bigint;
}): {
  usedAmount0Wei: bigint;
  usedAmount1Wei: bigint;
  oneSided: 'token0' | 'token1' | null;
} {
  const { amount0Desired, amount1Desired, tickLower, tickUpper, sqrtPriceX96 } = params;

  const d0 = Number(amount0Desired) / 1e18;
  const d1 = Number(amount1Desired) / 1e18;

  const Q96 = 2 ** 96;
  const sqrtX = Number(sqrtPriceX96) / Q96;
  const sqrtA = getSqrtRatioAtTick(tickLower);
  const sqrtB = getSqrtRatioAtTick(tickUpper);

  const L = getLiquidityForAmounts(sqrtX, sqrtA, sqrtB, d0, d1);
  const used = getAmountsForLiquidity(sqrtX, sqrtA, sqrtB, L);

  const used0Wei = BigInt(Math.floor(used.amount0 * 1e18));
  const used1Wei = BigInt(Math.floor(used.amount1 * 1e18));

  const oneSided = used.amount0 === 0 ? 'token1' : used.amount1 === 0 ? 'token0' : null;

  return { usedAmount0Wei: used0Wei, usedAmount1Wei: used1Wei, oneSided };
}

/**
 * Check if current price is within position range
 */
export function isInRange(currentTick: number, tickLower: number, tickUpper: number): boolean {
  return currentTick >= tickLower && currentTick <= tickUpper;
}

/**
 * Calculate percentage of price range
 */
export function calculateRangePercentage(
  currentPrice: number,
  lowerPrice: number,
  upperPrice: number
): number {
  if (currentPrice < lowerPrice) return 0;
  if (currentPrice > upperPrice) return 100;
  
  const range = upperPrice - lowerPrice;
  const position = currentPrice - lowerPrice;
  return (position / range) * 100;
}
