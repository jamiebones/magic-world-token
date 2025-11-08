import { Address } from "viem";

/**
 * Staked Position structure matching smart contract
 */
export interface StakedPosition {
  tokenId: bigint;
  liquidity: bigint;
  usdValue: bigint;
  rewardDebt: bigint;
  stakedAt: bigint;
  lockUntil: bigint;
  boostMultiplier: bigint;
  owner: Address;
  tickLower: number;
  tickUpper: number;
}

/**
 * Farming statistics returned from getFarmingStats()
 */
export interface FarmingStats {
  totalStaked: bigint;
  totalRewards: bigint;
  availableRewards: bigint;
  currentAPR: bigint;
  participantCount: bigint;
  isActive: boolean;
}

/**
 * Lock tier configuration
 */
export interface LockTier {
  days: number;
  multiplier: number;
  label: string;
  boost: string;
}

/**
 * NFT Position from PancakeSwap Position Manager
 */
export interface NFTPosition {
  tokenId: bigint;
  nonce: bigint;
  operator: Address;
  token0: Address;
  token1: Address;
  fee: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

/**
 * Pool information
 */
export interface PoolInfo {
  sqrtPriceX96: bigint;
  currentTick: number;
  lastUpdated: bigint;
}

/**
 * Reward claim event data
 */
export interface RewardClaimEvent {
  user: Address;
  amount: bigint;
  tokenIds: bigint[];
  timestamp: bigint;
  txHash: string;
}

/**
 * Position stake event data
 */
export interface PositionStakeEvent {
  user: Address;
  tokenId: bigint;
  usdValue: bigint;
  lockDays: bigint;
  boostMultiplier: bigint;
  timestamp: bigint;
  txHash: string;
}

/**
 * Position unstake event data
 */
export interface PositionUnstakeEvent {
  user: Address;
  tokenId: bigint;
  rewards: bigint;
  timestamp: bigint;
  txHash: string;
}

/**
 * Activity feed item (union of all event types)
 */
export type ActivityFeedItem =
  | { type: "stake"; data: PositionStakeEvent }
  | { type: "unstake"; data: PositionUnstakeEvent }
  | { type: "claim"; data: RewardClaimEvent };

/**
 * Chart data point
 */
export interface ChartDataPoint {
  timestamp: number;
  value: number;
  label?: string;
}

/**
 * APR calculation parameters
 */
export interface APRCalculation {
  baseAPR: number; // Annual percentage rate
  boost: number; // Multiplier (1.0 - 2.0)
  boostedAPR: number; // Base APR * boost
  dailyRate: number; // Daily percentage
  weeklyRate: number; // Weekly percentage
  monthlyRate: number; // Monthly percentage
}

/**
 * Position performance metrics
 */
export interface PositionPerformance {
  tokenId: bigint;
  stakedValue: bigint; // USD value when staked
  currentValue: bigint; // Current USD value
  totalRewardsEarned: bigint; // Total MWG earned
  totalRewardsUSD: bigint; // USD value of rewards
  roi: number; // Return on investment percentage
  apr: number; // Actual APR achieved
  daysStaked: number;
}

/**
 * User portfolio summary
 */
export interface UserPortfolio {
  totalPositions: number;
  totalStakedValue: bigint;
  totalPendingRewards: bigint;
  totalClaimedRewards: bigint;
  averageAPR: number;
  averageLockDays: number;
  positions: StakedPosition[];
}

/**
 * Admin dashboard metrics
 */
export interface AdminMetrics {
  totalStakedValue: bigint;
  totalRewardsDeposited: bigint;
  totalRewardsDistributed: bigint;
  availableRewards: bigint;
  rewardPerSecond: bigint;
  farmingStartTime: bigint;
  farmingEndTime: bigint;
  isPaused: boolean;
  emergencyWithdrawEnabled: boolean;
  totalPositions: number;
  uniqueStakers: number;
}

/**
 * Transaction status
 */
export type TransactionStatus =
  | "idle"
  | "preparing"
  | "pending"
  | "confirming"
  | "success"
  | "error";

/**
 * Form validation error
 */
export interface FormError {
  field: string;
  message: string;
}
