import { useMemo } from "react";
import { useCurrentAPR, useBoostMultiplier } from "./useFarmingPool";
import { FARMING_CONFIG } from "@/config/contracts";
import type { StakedPosition } from "@/types/farming";

/**
 * Calculate estimated rewards based on stake value and lock period
 * @param stakeValueUSD USD value of the stake
 * @param lockDays Number of days to lock
 * @returns Estimated rewards breakdown
 */
export function useAPRCalculation(stakeValueUSD: number, lockDays: number) {
  const { currentAPR } = useCurrentAPR();
  const { boostMultiplier } = useBoostMultiplier(lockDays);

  return useMemo(() => {
    if (!currentAPR || !boostMultiplier) {
      return null;
    }

    // APR is in basis points (10000 = 100%)
    const baseAPR = Number(currentAPR) / 10000;

    // Boost multiplier is scaled by 1000 (1000 = 1x)
    const boost = Number(boostMultiplier) / 1000;

    // Apply boost to APR
    const boostedAPR = baseAPR * boost;

    // Calculate daily rewards
    const dailyRewardsMWG = (stakeValueUSD * boostedAPR) / 365;

    // Weekly rewards
    const weeklyRewardsMWG = dailyRewardsMWG * 7;

    // Monthly rewards
    const monthlyRewardsMWG = dailyRewardsMWG * 30;

    // Total until lock end
    const totalUntilUnlock = dailyRewardsMWG * lockDays;

    return {
      baseAPR,
      boost,
      boostedAPR,
      daily: dailyRewardsMWG,
      weekly: weeklyRewardsMWG,
      monthly: monthlyRewardsMWG,
      untilUnlock: totalUntilUnlock,
    };
  }, [currentAPR, boostMultiplier, stakeValueUSD, lockDays]);
}

/**
 * Calculate lock end date based on lock days
 * @param lockDays Number of days to lock
 * @returns Lock end timestamp and formatted date
 */
export function useLockEndDate(lockDays: number) {
  return useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const lockSeconds = lockDays * 24 * 60 * 60;
    const lockEndTimestamp = BigInt(now + lockSeconds);
    const lockEndDate = new Date((now + lockSeconds) * 1000);

    return {
      timestamp: lockEndTimestamp,
      date: lockEndDate,
      formatted: lockEndDate.toLocaleDateString(),
    };
  }, [lockDays]);
}

/**
 * Project future earnings for a staked position
 * @param position Staked position
 * @returns Projected earnings breakdown
 */
export function useRewardProjection(position: StakedPosition | null) {
  const { currentAPR } = useCurrentAPR();

  return useMemo(() => {
    if (!position || !currentAPR) {
      return null;
    }

    const stakeValueUSD = Number(position.usdValue) / 1e18;
    const boost = Number(position.boostMultiplier) / 1000;
    const baseAPR = Number(currentAPR) / 10000;
    const boostedAPR = baseAPR * boost;

    // Days remaining until unlock
    const now = Math.floor(Date.now() / 1000);
    const lockEnd = Number(position.lockUntil);
    const daysRemaining = Math.max(0, Math.floor((lockEnd - now) / 86400));

    // Calculate projected earnings
    const dailyRate = (stakeValueUSD * boostedAPR) / 365;
    const projectedUntilUnlock = dailyRate * daysRemaining;

    // Calculate annualized return
    const daysSinceStake = Math.floor((now - Number(position.stakedAt)) / 86400);
    const currentRewards = Number(position.usdValue) / 1e18; // Placeholder - should use pendingRewards
    const annualizedReturn = daysSinceStake > 0 ? (currentRewards / daysSinceStake) * 365 : 0;

    return {
      dailyRate,
      daysRemaining,
      projectedUntilUnlock,
      annualizedReturn,
      effectiveAPR: boostedAPR,
    };
  }, [position, currentAPR]);
}

/**
 * Compare all lock tiers for a given stake value
 * @param stakeValueUSD USD value to stake
 * @returns Comparison of all lock tiers
 */
export function useCompareLockTiers(stakeValueUSD: number) {
  const { currentAPR } = useCurrentAPR();

  return useMemo(() => {
    if (!currentAPR) {
      return [];
    }

    const baseAPR = Number(currentAPR) / 10000;

    return FARMING_CONFIG.LOCK_TIERS.map((tier) => {
      const boost = tier.multiplier / 1000;
      const boostedAPR = baseAPR * boost;
      const dailyRewards = (stakeValueUSD * boostedAPR) / 365;
      const totalRewards = dailyRewards * tier.days;
      const roi = tier.days > 0 ? (totalRewards / stakeValueUSD) * 100 : 0;

      return {
        ...tier,
        boostedAPR,
        dailyRewards,
        totalRewards,
        roi,
      };
    });
  }, [currentAPR, stakeValueUSD]);
}

/**
 * Calculate optimal lock period based on user's time horizon
 * @param stakeValueUSD USD value to stake
 * @param maxDays Maximum days user willing to lock
 * @returns Optimal lock tier
 */
export function useOptimalLockPeriod(stakeValueUSD: number, maxDays: number) {
  const comparison = useCompareLockTiers(stakeValueUSD);

  return useMemo(() => {
    if (!comparison.length) {
      return null;
    }

    // Filter tiers within user's time horizon
    const eligibleTiers = comparison.filter((tier) => tier.days <= maxDays);

    if (!eligibleTiers.length) {
      return null;
    }

    // Find tier with highest ROI
    const optimal = eligibleTiers.reduce((best, current) =>
      current.roi > best.roi ? current : best
    );

    return optimal;
  }, [comparison, maxDays]);
}

/**
 * Calculate gas cost estimates for farming operations
 * (Placeholder - actual gas costs depend on network conditions)
 */
export function useGasEstimates() {
  return useMemo(() => ({
    stake: "~0.01 BNB",
    unstake: "~0.008 BNB",
    claim: "~0.005 BNB",
    claimAll: "~0.01 BNB",
    approve: "~0.003 BNB",
  }), []);
}

/**
 * Format large numbers with appropriate units
 * @param value Number to format
 * @returns Formatted string
 */
export function useFormatNumber(value: number | bigint) {
  return useMemo(() => {
    const num = typeof value === "bigint" ? Number(value) : value;

    if (num >= 1e9) {
      return `${(num / 1e9).toFixed(2)}B`;
    }
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    }
    if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    }
    return num.toFixed(2);
  }, [value]);
}

/**
 * Calculate time remaining until unlock
 * @param lockUntil Unlock timestamp
 * @returns Time breakdown
 */
export function useTimeUntilUnlock(lockUntil: bigint) {
  return useMemo(() => {
    const now = Math.floor(Date.now() / 1000);
    const lockEnd = Number(lockUntil);
    const secondsRemaining = Math.max(0, lockEnd - now);

    const days = Math.floor(secondsRemaining / 86400);
    const hours = Math.floor((secondsRemaining % 86400) / 3600);
    const minutes = Math.floor((secondsRemaining % 3600) / 60);

    const isLocked = secondsRemaining > 0;

    return {
      isLocked,
      days,
      hours,
      minutes,
      totalSeconds: secondsRemaining,
      formatted: isLocked
        ? `${days}d ${hours}h ${minutes}m`
        : "Unlocked",
    };
  }, [lockUntil]);
}
