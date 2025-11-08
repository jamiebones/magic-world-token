import { useWatchContractEvent } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import MWGFarmingPoolABI from "@/abis/MWGFarmingPool.json";
import type {
  PositionStakeEvent,
  PositionUnstakeEvent,
  RewardClaimEvent,
  ActivityFeedItem,
} from "@/types/farming";
import { useState, useEffect } from "react";
import type { Address } from "viem";

/**
 * Watch for PositionStaked events
 * @param onStake Callback function when position is staked
 */
export function usePositionStakedEvents(
  onStake?: (event: PositionStakeEvent) => void
) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    eventName: "PositionStaked",
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args;
        if (args && onStake) {
          const event: PositionStakeEvent = {
            user: args.user as Address,
            tokenId: args.tokenId as bigint,
            usdValue: args.usdValue as bigint,
            lockDays: args.lockDays as bigint,
            boostMultiplier: args.boostMultiplier as bigint,
            timestamp: BigInt(Date.now() / 1000),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            txHash: (log as any).transactionHash || "",
          };
          onStake(event);
        }
      });
    },
  });
}

/**
 * Watch for PositionUnstaked events
 * @param onUnstake Callback function when position is unstaked
 */
export function usePositionUnstakedEvents(
  onUnstake?: (event: PositionUnstakeEvent) => void
) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    eventName: "PositionUnstaked",
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args;
        if (args && onUnstake) {
          const event: PositionUnstakeEvent = {
            user: args.user as Address,
            tokenId: args.tokenId as bigint,
            rewards: args.rewards as bigint,
            timestamp: BigInt(Date.now() / 1000),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            txHash: (log as any).transactionHash || "",
          };
          onUnstake(event);
        }
      });
    },
  });
}

/**
 * Watch for RewardsClaimed events
 * @param onClaim Callback function when rewards are claimed
 */
export function useRewardsClaimedEvents(
  onClaim?: (event: RewardClaimEvent) => void
) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    eventName: "RewardsClaimed",
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args;
        if (args && onClaim) {
          const event: RewardClaimEvent = {
            user: args.user as Address,
            amount: args.amount as bigint,
            tokenIds: args.tokenIds as bigint[],
            timestamp: BigInt(Date.now() / 1000),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            txHash: (log as any).transactionHash || "",
          };
          onClaim(event);
        }
      });
    },
  });
}

/**
 * Watch all farming events and maintain an activity feed
 * @param limit Maximum number of activities to keep
 */
export function useRecentActivity(limit = 10) {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);

  // Watch stake events
  usePositionStakedEvents((event) => {
    setActivities((prev) => [
      { type: "stake", data: event },
      ...prev.slice(0, limit - 1),
    ]);
  });

  // Watch unstake events
  usePositionUnstakedEvents((event) => {
    setActivities((prev) => [
      { type: "unstake", data: event },
      ...prev.slice(0, limit - 1),
    ]);
  });

  // Watch claim events
  useRewardsClaimedEvents((event) => {
    setActivities((prev) => [
      { type: "claim", data: event },
      ...prev.slice(0, limit - 1),
    ]);
  });

  return activities;
}

/**
 * Watch for user-specific events
 * @param userAddress User's wallet address
 */
export function useUserEvents(userAddress?: Address) {
  const [userActivity, setUserActivity] = useState<ActivityFeedItem[]>([]);

  useEffect(() => {
    if (!userAddress) {
      setUserActivity([]);
    }
  }, [userAddress]);

  // Watch user's stake events
  usePositionStakedEvents((event) => {
    if (
      userAddress &&
      event.user.toLowerCase() === userAddress.toLowerCase()
    ) {
      setUserActivity((prev) => [{ type: "stake", data: event }, ...prev]);
    }
  });

  // Watch user's unstake events
  usePositionUnstakedEvents((event) => {
    if (
      userAddress &&
      event.user.toLowerCase() === userAddress.toLowerCase()
    ) {
      setUserActivity((prev) => [{ type: "unstake", data: event }, ...prev]);
    }
  });

  // Watch user's claim events
  useRewardsClaimedEvents((event) => {
    if (
      userAddress &&
      event.user.toLowerCase() === userAddress.toLowerCase()
    ) {
      setUserActivity((prev) => [{ type: "claim", data: event }, ...prev]);
    }
  });

  return userActivity;
}

/**
 * Watch for reward rate updates (admin events)
 */
export function useRewardRateUpdates(
  onUpdate?: (newRate: bigint) => void
) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    eventName: "RewardRateUpdated",
    onLogs(logs) {
      logs.forEach((log) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = (log as any).args;
        if (args && onUpdate) {
          onUpdate(args.newRate as bigint);
        }
      });
    },
  });
}

/**
 * Watch for emergency withdraw enabled
 */
export function useEmergencyWithdrawEnabled(onEnabled?: () => void) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.FARMING_POOL,
    abi: MWGFarmingPoolABI,
    eventName: "EmergencyWithdrawEnabled",
    onLogs() {
      if (onEnabled) {
        onEnabled();
      }
    },
  });
}
