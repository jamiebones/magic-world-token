"use client";

import Link from "next/link";
import { useState } from "react";
import {
  useCurrentAPR,
  useBoostMultiplier,
} from "@/hooks/farming/useFarmingPool";
import { useCompareLockTiers } from "@/hooks/farming/useFarmingCalculations";
import { APRBadge } from "@/components/farming/APRBadge";
import { BoostMultiplierBadge } from "@/components/farming/BoostMultiplierBadge";
import { LockPeriodSelector } from "@/components/farming/LockPeriodSelector";

export default function CalculatorPage() {
  const [stakeValue, setStakeValue] = useState<number>(1000);
  const [selectedLockDays, setSelectedLockDays] = useState<number>(0);

  const { currentAPR, isLoading: isLoadingAPR } = useCurrentAPR();
  const { boostMultiplier } = useBoostMultiplier(selectedLockDays);
  const tierComparisons = useCompareLockTiers(stakeValue);

  // Calculate boosted APR
  const baseAPR = currentAPR ? Number(currentAPR) / 100 : 0;
  const boost = boostMultiplier ? Number(boostMultiplier) / 1000 : 1;
  const boostedAPR = baseAPR * boost;

  // Calculate estimated rewards
  const dailyRewards = (stakeValue * boostedAPR) / 36500;
  const weeklyRewards = dailyRewards * 7;
  const monthlyRewards = dailyRewards * 30;
  const totalUntilUnlock =
    selectedLockDays > 0 ? dailyRewards * selectedLockDays : monthlyRewards;

  // Find optimal lock period
  interface TierComparison {
    lockDays?: number;
    days: number;
    label: string;
    multiplier: number;
    boost: string;
    boostedAPR: number;
    dailyRewards: number;
    totalRewards: number;
    roi: number;
    projectedRewards?: number;
  }

  const optimalTier = tierComparisons?.reduce(
    (best: TierComparison, current: TierComparison) =>
      (current.projectedRewards || current.totalRewards || 0) >
      (best.projectedRewards || best.totalRewards || 0)
        ? current
        : best,
    tierComparisons[0]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Link
              href="/farming"
              className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300 mb-4"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              Rewards Calculator
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Estimate your potential earnings before staking
            </p>
          </div>

          {/* Current APR Display */}
          {!isLoadingAPR && currentAPR && (
            <div className="mb-6 flex justify-center">
              <div className="flex items-center gap-3 bg-gray-800/50 backdrop-blur-sm rounded-xl px-6 py-3 border border-purple-500/20">
                <span className="text-sm text-gray-400">Current Base APR:</span>
                <APRBadge apr={baseAPR} size="md" />
              </div>
            </div>
          )}

          {/* Input Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-purple-500/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-6">Configuration</h2>

            {/* Stake Value Slider */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-300">
                  Stake Value (USD)
                </label>
                <span className="text-2xl font-bold text-purple-400">
                  ${stakeValue.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="100"
                max="10000"
                step="100"
                value={stakeValue}
                onChange={(e) => setStakeValue(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>$100</span>
                <span>$10,000</span>
              </div>
            </div>

            {/* Lock Period Selector */}
            <div className="mb-6">
              <label className="text-sm font-semibold text-gray-300 mb-3 block">
                Lock Period
              </label>
              <LockPeriodSelector
                selectedDays={selectedLockDays}
                onChange={setSelectedLockDays}
              />
            </div>

            {/* Boost Multiplier Display */}
            {boostMultiplier && (
              <div className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg">
                <span className="text-sm text-gray-400">
                  Your Boost Multiplier:
                </span>
                <BoostMultiplierBadge multiplier={Number(boostMultiplier)} />
              </div>
            )}
          </div>

          {/* Results Display */}
          <div className="bg-gradient-to-br from-purple-900/50 to-pink-900/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-purple-500/40 mb-6">
            <h2 className="text-xl font-bold text-white mb-6">
              Estimated Earnings
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Daily */}
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-2">Daily</p>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">
                  {dailyRewards.toFixed(2)}
                </p>
                <p className="text-xs text-purple-400">MWG</p>
              </div>

              {/* Weekly */}
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-2">Weekly</p>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">
                  {weeklyRewards.toFixed(2)}
                </p>
                <p className="text-xs text-purple-400">MWG</p>
              </div>

              {/* Monthly */}
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-2">Monthly</p>
                <p className="text-xl sm:text-2xl font-bold text-white mb-1">
                  {monthlyRewards.toFixed(2)}
                </p>
                <p className="text-xs text-purple-400">MWG</p>
              </div>

              {/* Total Until Unlock */}
              <div className="bg-gray-800/50 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-2">
                  {selectedLockDays > 0
                    ? `Until Unlock (${selectedLockDays}d)`
                    : "30 Days"}
                </p>
                <p className="text-xl sm:text-2xl font-bold text-green-400 mb-1">
                  {totalUntilUnlock.toFixed(2)}
                </p>
                <p className="text-xs text-purple-400">MWG</p>
              </div>
            </div>

            {/* Boosted APR Display */}
            <div className="bg-gray-800/30 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-400 mb-2">Your Effective APR</p>
              <p className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                {boostedAPR.toFixed(2)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Base: {baseAPR.toFixed(2)}% × {boost.toFixed(2)}x boost
              </p>
            </div>
          </div>

          {/* Lock Tier Comparison Table */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-purple-500/20">
            <h2 className="text-xl font-bold text-white mb-4">
              Lock Period Comparison
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              Compare potential returns across all lock periods for $
              {stakeValue.toLocaleString()} stake
            </p>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">
                      Lock Period
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
                      Boost
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-gray-400">
                      Effective APR
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                      Projected Rewards
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">
                      ROI
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tierComparisons?.map((tier: TierComparison) => {
                    const isOptimal = tier.days === optimalTier?.days;
                    const isSelected = tier.days === selectedLockDays;

                    return (
                      <tr
                        key={tier.days}
                        className={`border-b border-gray-700/50 ${
                          isSelected ? "bg-purple-500/10" : ""
                        } ${
                          isOptimal ? "bg-green-500/5" : ""
                        } hover:bg-gray-700/30 transition-colors cursor-pointer`}
                        onClick={() => setSelectedLockDays(tier.days)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="text-white font-semibold">
                              {tier.label}
                            </span>
                            {isOptimal && (
                              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                                Best ROI
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <BoostMultiplierBadge
                            multiplier={Number(tier.multiplier)}
                          />
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className="text-purple-400 font-semibold">
                            {tier.boostedAPR?.toFixed(2)}%
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-white font-semibold">
                            {tier.totalRewards?.toFixed(2)} MWG
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="text-green-400 font-semibold">
                            +{tier.roi?.toFixed(2)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-3">
              {tierComparisons?.map((tier: TierComparison) => {
                const isOptimal = tier.days === optimalTier?.days;
                const isSelected = tier.days === selectedLockDays;

                return (
                  <div
                    key={tier.days}
                    onClick={() => setSelectedLockDays(tier.days)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? "bg-purple-500/10 border-purple-500/50"
                        : "bg-gray-700/30 border-gray-600/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-white">{tier.label}</h3>
                      {isOptimal && (
                        <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">
                          Best ROI
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-gray-400 text-xs">Boost</p>
                        <BoostMultiplierBadge
                          multiplier={Number(tier.multiplier)}
                        />
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">APR</p>
                        <p className="text-purple-400 font-semibold">
                          {tier.boostedAPR?.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">Rewards</p>
                        <p className="text-white font-semibold">
                          {tier.totalRewards?.toFixed(2)} MWG
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-xs">ROI</p>
                        <p className="text-green-400 font-semibold">
                          +{tier.roi?.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Help Text */}
          <div className="mt-6 bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-sm text-blue-300">
              💡 <strong>Tip:</strong> Longer lock periods provide higher boost
              multipliers, resulting in better APR and more rewards. The
              calculator shows projected earnings based on current APR - actual
              rewards may vary.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
