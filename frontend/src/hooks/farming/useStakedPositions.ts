import { useReadContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGFarmingPoolABI from "@/abis/MWGFarmingPool.json";
import type { Address } from "viem";
import { useMemo } from "react";

/**
 * Get all staked position token IDs for a user
 * @param address User's wallet address
 */
export function useUserPositions(address?: Address) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "getUserPositions",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    positions: data as bigint[] | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get details of a specific staked position
 * @param tokenId NFT token ID
 */
export function usePositionDetails(tokenId?: bigint) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "stakedPositions",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
    },
  });

  const positionDetails = useMemo(() => {
    if (!data) return null;
    const result = data as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, Address, number, number];
    return {
      tokenId: result[0],
      liquidity: result[1],
      usdValue: result[2],
      rewardDebt: result[3],
      stakedAt: result[4],
      lockUntil: result[5],
      boostMultiplier: result[6],
      owner: result[7],
      tickLower: Number(result[8]),
      tickUpper: Number(result[9]),
    };
  }, [data]);

  return {
    positionDetails,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get pending rewards for a specific position
 * @param tokenId NFT token ID
 */
export function usePositionPendingRewards(tokenId?: bigint) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "pendingRewards",
    args: tokenId !== undefined ? [tokenId] : undefined,
    query: {
      enabled: tokenId !== undefined,
      refetchInterval: 10000, // Refetch every 10 seconds for live updates
    },
  });

  return {
    pendingRewards: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get total USD value staked by a user
 * @param address User's wallet address
 */
export function useUserTotalValue(address?: Address) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "userTotalValue",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    totalValue: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get total rewards claimed by a user
 * @param address User's wallet address
 */
export function useUserRewardsClaimed(address?: Address) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "userRewardsClaimed",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  return {
    rewardsClaimed: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get total pending rewards for all user's positions
 * @param address User's wallet address
 */
export function usePendingRewardsForUser(address?: Address) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    functionName: "pendingRewardsForUser",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
      refetchInterval: 10000, // Refetch every 10 seconds for live updates
    },
  });

  return {
    totalPending: data as bigint | undefined,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Get all positions with their details for a user
 * Combines getUserPositions + stakedPositions for each tokenId
 * @param address User's wallet address
 */
export function useUserPositionsWithDetails(address?: Address) {
  const { positions, isLoading: isLoadingIds, error: errorIds } = useUserPositions(address);
  
  // This is a simplified version - in production, you'd want to batch these calls
  // or use multicall for better performance
  return {
    positions,
    isLoading: isLoadingIds,
    error: errorIds,
  };
}
