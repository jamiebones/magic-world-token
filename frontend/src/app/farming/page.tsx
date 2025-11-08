"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import {
  useFarmingStats,
  useCurrentAPR,
  useEmergencyStatus,
} from "@/hooks/farming/useFarmingPool";
import { useRecentActivity } from "@/hooks/farming/useFarmingEvents";
import { FarmingStatsCard } from "@/components/farming/FarmingStatsCard";
import { APRBadge } from "@/components/farming/APRBadge";
import { EmergencyBanner } from "@/components/farming/EmergencyBanner";
import { TransactionHistory } from "@/components/farming/TransactionHistory";
import { formatUnits } from "viem";

export default function FarmingDashboard() {
  const { isConnected } = useAccount();
  const { farmingStats, isLoading: isLoadingStats } = useFarmingStats();
  const { currentAPR, isLoading: isLoadingAPR } = useCurrentAPR();
  const { emergencyEnabled } = useEmergencyStatus();
  const recentActivity = useRecentActivity(5);

  // Format values
  const totalStaked = farmingStats
    ? parseFloat(formatUnits(farmingStats.totalStaked, 18)).toFixed(2)
    : "0";
  const availableRewards = farmingStats
    ? parseFloat(formatUnits(farmingStats.availableRewards, 18)).toFixed(2)
    : "0";
  const totalRewards = farmingStats
    ? parseFloat(formatUnits(farmingStats.totalRewards, 18)).toFixed(2)
    : "0";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Emergency Banner */}
      {emergencyEnabled && (
        <EmergencyBanner
          isActive={true}
          message="🚨 Emergency mode is active. Normal staking operations may be affected."
          severity="error"
        />
      )}

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              MWG Farming Pool
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Stake your PancakeSwap V3 NFT positions to earn MWG rewards
            </p>
            {!isConnected && (
              <p className="mt-2 text-sm text-yellow-400">
                💡 Connect your wallet to get started
              </p>
            )}
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <FarmingStatsCard
              title="Total Value Locked"
              value={totalStaked}
              icon="💎"
              prefix="$"
              suffix=" USD"
              isLoading={isLoadingStats}
              trend="up"
            />
            <FarmingStatsCard
              title="Current APR"
              value={currentAPR ? Number(currentAPR) / 100 : 0}
              icon="📈"
              suffix="%"
              isLoading={isLoadingAPR}
              trend="up"
            />
            <FarmingStatsCard
              title="Available Rewards"
              value={availableRewards}
              icon="🎁"
              suffix=" MWG"
              isLoading={isLoadingStats}
            />
            <FarmingStatsCard
              title="Total Distributed"
              value={totalRewards}
              icon="💰"
              suffix=" MWG"
              isLoading={isLoadingStats}
            />
          </div>

          {/* APR Display */}
          {currentAPR && !isLoadingAPR && (
            <div className="mb-8 flex justify-center">
              <APRBadge apr={Number(currentAPR)} size="lg" showTooltip />
            </div>
          )}

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <Link
              href="/farming/stake"
              className="p-4 sm:p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all group"
            >
              <div className="text-2xl sm:text-3xl mb-3">🎯</div>
              <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-purple-400 transition-colors mb-1">
                Stake Position
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Stake your NFT to earn rewards
              </p>
            </Link>

            <Link
              href="/farming/positions"
              className="p-4 sm:p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all group"
            >
              <div className="text-2xl sm:text-3xl mb-3">📊</div>
              <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-purple-400 transition-colors mb-1">
                My Positions
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                View and manage staked positions
              </p>
            </Link>

            <Link
              href="/farming/rewards"
              className="p-4 sm:p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all group"
            >
              <div className="text-2xl sm:text-3xl mb-3">💰</div>
              <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-purple-400 transition-colors mb-1">
                Claim Rewards
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Claim your earned MWG tokens
              </p>
            </Link>

            <Link
              href="/farming/calculator"
              className="p-4 sm:p-6 bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 hover:border-purple-500/40 transition-all group"
            >
              <div className="text-2xl sm:text-3xl mb-3">🧮</div>
              <h3 className="text-base sm:text-lg font-semibold text-white group-hover:text-purple-400 transition-colors mb-1">
                Calculator
              </h3>
              <p className="text-xs sm:text-sm text-gray-400">
                Estimate your potential rewards
              </p>
            </Link>
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="mb-8">
              <TransactionHistory
                events={recentActivity}
                maxItems={5}
                showPagination={false}
              />
            </div>
          )}

          {/* Additional Links */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-purple-500/20">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">
              More Tools
            </h2>
            <div className="flex flex-wrap gap-3 sm:gap-4">
              <Link
                href="/farming/analytics"
                className="text-sm sm:text-base text-purple-400 hover:text-purple-300 transition-colors"
              >
                Analytics →
              </Link>
              <Link
                href="/farming/unstake"
                className="text-sm sm:text-base text-purple-400 hover:text-purple-300 transition-colors"
              >
                Unstake →
              </Link>
              <Link
                href="/farming/admin"
                className="text-sm sm:text-base text-purple-400 hover:text-purple-300 transition-colors"
              >
                Admin →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
