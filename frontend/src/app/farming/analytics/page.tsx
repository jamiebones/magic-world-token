"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { formatUnits } from "viem";
import {
  useFarmingStats,
  useCurrentAPR,
  useFarmingPeriod,
} from "@/hooks/farming/useFarmingPool";
import { FarmingChart } from "@/components/farming/FarmingChart";
import { FarmingStatsCard } from "@/components/farming/FarmingStatsCard";
import { APRBadge } from "@/components/farming/APRBadge";

// Historical data type
interface HistoricalDataPoint {
  timestamp: number;
  date: string;
  tvl: number;
  apr: number;
  rewards: number;
  participants: number;
  value: number; // Required by FarmingChart
  label?: string;
  [key: string]: number | string | undefined;
}

// Mock historical data - in production, this would come from an API or subgraph
const generateMockHistoricalData = (): HistoricalDataPoint[] => {
  const data = [];
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  for (let i = 30; i >= 0; i--) {
    const timestamp = now - i * dayMs;
    const tvl = 50000 + Math.random() * 50000 + i * 1000;
    data.push({
      timestamp,
      date: new Date(timestamp).toLocaleDateString(),
      tvl,
      apr: 15 + Math.random() * 10,
      rewards: 1000 + Math.random() * 500 + (30 - i) * 100,
      participants: 10 + Math.floor(Math.random() * 20) + (30 - i) * 2,
      value: tvl, // Set value for ChartDataPoint compatibility
    });
  }
  return data;
};

export default function AnalyticsPage() {
  const { farmingStats, isLoading: isLoadingStats } = useFarmingStats();
  const { currentAPR, isLoading: isLoadingAPR } = useCurrentAPR();
  const { endTime } = useFarmingPeriod();
  const [historicalData, setHistoricalData] = useState<HistoricalDataPoint[]>(
    []
  );

  useEffect(() => {
    // Generate mock data on client side
    setHistoricalData(generateMockHistoricalData());
  }, []);

  // Calculate pool health metrics
  const availableRewards = farmingStats
    ? parseFloat(formatUnits(farmingStats.availableRewards, 18))
    : 0;

  const totalRewards = farmingStats
    ? parseFloat(formatUnits(farmingStats.totalRewards, 18))
    : 0;

  const rewardsDistributed = totalRewards - availableRewards;
  const distributionPercentage =
    totalRewards > 0 ? (rewardsDistributed / totalRewards) * 100 : 0;

  // Calculate days until farming ends
  const now = Math.floor(Date.now() / 1000);
  const daysUntilEnd =
    endTime && endTime > BigInt(now)
      ? Number(endTime - BigInt(now)) / 86400
      : 0;

  // Calculate average daily rewards (last 7 days from mock data)
  const last7Days = historicalData.slice(-7);
  const avgDailyRewards =
    last7Days.length > 0
      ? last7Days.reduce((sum, day, idx, arr) => {
          if (idx === 0) return sum;
          return sum + (day.rewards - arr[idx - 1].rewards);
        }, 0) /
        (last7Days.length - 1)
      : 0;

  // Estimate depletion timeline
  const daysUntilDepletion =
    avgDailyRewards > 0 ? availableRewards / avgDailyRewards : Infinity;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Link
              href="/farming"
              className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300 mb-4"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              Farming Analytics
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Historical performance metrics and pool health indicators
            </p>
          </div>

          {/* Current Stats Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <FarmingStatsCard
              title="Current APR"
              value={currentAPR ? Number(currentAPR) / 100 : 0}
              icon="📈"
              suffix="%"
              isLoading={isLoadingAPR}
              trend="up"
            />
            <FarmingStatsCard
              title="Total Participants"
              value={
                farmingStats?.participantCount
                  ? Number(farmingStats.participantCount)
                  : 0
              }
              icon="👥"
              isLoading={isLoadingStats}
            />
            <FarmingStatsCard
              title="Distribution Rate"
              value={distributionPercentage.toFixed(1)}
              icon="⚡"
              suffix="%"
              isLoading={isLoadingStats}
              trend={distributionPercentage > 50 ? "up" : undefined}
            />
            <FarmingStatsCard
              title="Days Remaining"
              value={daysUntilEnd.toFixed(0)}
              icon="⏰"
              suffix=" days"
              isLoading={!endTime}
            />
          </div>

          {/* TVL Chart */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Total Value Locked (TVL)
            </h2>
            <FarmingChart
              data={historicalData}
              dataKey="tvl"
              type="area"
              color="#8b5cf6"
              yAxisLabel="TVL (USD)"
            />
          </div>

          {/* APR History Chart */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">APR History</h2>
              {currentAPR && <APRBadge apr={Number(currentAPR)} size="sm" />}
            </div>
            <FarmingChart
              data={historicalData}
              dataKey="apr"
              type="line"
              color="#ec4899"
              yAxisLabel="APR (%)"
            />
          </div>

          {/* Rewards Distribution Chart */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Cumulative Rewards Distributed
            </h2>
            <FarmingChart
              data={historicalData}
              dataKey="rewards"
              type="area"
              color="#10b981"
              yAxisLabel="MWG Tokens"
            />
          </div>

          {/* Participant Growth Chart */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">
              Participant Growth
            </h2>
            <FarmingChart
              data={historicalData}
              dataKey="participants"
              type="bar"
              color="#f59e0b"
              yAxisLabel="Participants"
            />
          </div>

          {/* Pool Health Metrics */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-6">
              Pool Health Metrics
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available Rewards */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-400">
                    Available Rewards
                  </h3>
                  <span className="text-2xl">🎁</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {availableRewards.toLocaleString()} MWG
                </p>
                <p className="text-xs text-gray-400">
                  {distributionPercentage.toFixed(1)}% of total distributed
                </p>
              </div>

              {/* Depletion Timeline */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-400">
                    Projected Depletion
                  </h3>
                  <span className="text-2xl">⏳</span>
                </div>
                <p className="text-2xl font-bold text-white mb-1">
                  {daysUntilDepletion === Infinity
                    ? "N/A"
                    : `${Math.floor(daysUntilDepletion)} days`}
                </p>
                <p className="text-xs text-gray-400">
                  Based on avg daily distribution: {avgDailyRewards.toFixed(0)}{" "}
                  MWG/day
                </p>
              </div>

              {/* Farming Period */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-400">
                    Farming Period
                  </h3>
                  <span className="text-2xl">📅</span>
                </div>
                <p className="text-lg font-bold text-white mb-1">
                  {daysUntilEnd > 0
                    ? `${Math.floor(daysUntilEnd)} days left`
                    : "Ended"}
                </p>
                <p className="text-xs text-gray-400">
                  {endTime
                    ? `Ends: ${new Date(
                        Number(endTime) * 1000
                      ).toLocaleDateString()}`
                    : "Loading..."}
                </p>
              </div>

              {/* Pool Status */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-400">
                    Pool Status
                  </h3>
                  <span className="text-2xl">
                    {farmingStats?.isActive ? "✅" : "⏸️"}
                  </span>
                </div>
                <p className="text-lg font-bold text-white mb-1">
                  {farmingStats?.isActive ? "Active" : "Inactive"}
                </p>
                <p className="text-xs text-gray-400">
                  {farmingStats?.isActive
                    ? "Staking and rewards distribution active"
                    : "Pool is currently paused"}
                </p>
              </div>
            </div>

            {/* Warning if depletion is imminent */}
            {daysUntilDepletion < 30 && daysUntilDepletion !== Infinity && (
              <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
                <p className="text-yellow-400 font-semibold text-sm">
                  ⚠️ Warning: Pool rewards may be depleted in{" "}
                  {Math.floor(daysUntilDepletion)} days at current distribution
                  rate. Admin should deposit more rewards.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
