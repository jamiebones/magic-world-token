import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGFarmingPoolABI from "@/abis/MWGFarmingPool.json";
import { useMemo } from "react";

/**
 * Get comprehensive farming statistics
 * Returns: totalStaked, totalRewards, availableRewards, currentAPR, participantCount, isActive
 */
export function useFarmingStats() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "getFarmingStats",
  });

  const farmingStats = useMemo(() => {
    if (!data) return null;
    const result = data as readonly [bigint, bigint, bigint, bigint, bigint, boolean];
    return {
      totalStaked: result[0],
      totalRewards: result[1],
      availableRewards: result[2],
      currentAPR: result[3],
      participantCount: result[4],
      isActive: result[5],
    };
  }, [data]);

  return {
    farmingStats,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get current reward rate (MWG tokens per second per USD staked)
 */
export function useRewardRate() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "rewardPerSecond",
  });

  return {
    rewardPerSecond: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get farming period timestamps
 */
export function useFarmingPeriod() {
  const {
    data: startTime,
    isLoading: isLoadingStart,
    error: errorStart,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "farmingStartTime",
  });

  const {
    data: endTime,
    isLoading: isLoadingEnd,
    error: errorEnd,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "farmingEndTime",
  });

  return {
    startTime: startTime as bigint | undefined,
    endTime: endTime as bigint | undefined,
    isLoading: isLoadingStart || isLoadingEnd,
    error: errorStart || errorEnd,
  };
}

/**
 * Check if emergency withdraw is enabled
 */
export function useEmergencyStatus() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "emergencyWithdrawEnabled",
  });

  return {
    emergencyEnabled: data as boolean | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Check if contract is paused
 */
export function usePaused() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "paused",
  });

  return {
    isPaused: data as boolean | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get total staked value
 */
export function useTotalStakedValue() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "totalStakedValue",
  });

  return {
    totalStakedValue: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get available rewards in the pool
 */
export function useAvailableRewards() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "getAvailableRewards",
  });

  return {
    availableRewards: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get current APR (in basis points: 10000 = 100%)
 */
export function useCurrentAPR() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "getCurrentAPR",
  });

  return {
    currentAPR: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get boost multiplier for a specific lock period
 * @param lockDays Number of days to lock (0-365)
 */
export function useBoostMultiplier(lockDays: number) {
  const { data, isLoading, error } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "getBoostMultiplier",
    args: [BigInt(lockDays)],
  });

  return {
    boostMultiplier: data as bigint | undefined,
    isLoading,
    error,
  };
}

/**
 * Get total rewards deposited
 */
export function useTotalRewardsDeposited() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "totalRewardsDeposited",
  });

  return {
    totalRewardsDeposited: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get total rewards distributed
 */
export function useTotalRewardsDistributed() {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "totalRewardsDistributed",
  });

  return {
    totalRewardsDistributed: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}
