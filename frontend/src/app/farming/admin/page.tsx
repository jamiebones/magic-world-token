"use client";

import Link from "next/link";
import { useState } from "react";
import { useAccount } from "wagmi";
import { formatUnits, parseUnits } from "viem";
import {
  useFarmingStats,
  useCurrentAPR,
  useRewardRate,
  useFarmingPeriod,
  usePaused,
  useEmergencyStatus,
} from "@/hooks/farming/useFarmingPool";
import {
  useDepositRewards,
  useSetRewardRate,
  useExtendFarming,
  useSetPaused,
  useEnableEmergencyWithdraw,
  useEmergencyWithdrawRewards,
} from "@/hooks/farming/useFarmingAdmin";
import { useRecentActivity } from "@/hooks/farming/useFarmingEvents";
import { FarmingStatsCard } from "@/components/farming/FarmingStatsCard";
import { TransactionHistory } from "@/components/farming/TransactionHistory";
import { EmergencyBanner } from "@/components/farming/EmergencyBanner";

export default function AdminPage() {
  const { isConnected } = useAccount();
  const { farmingStats, isLoading: isLoadingStats } = useFarmingStats();
  const { currentAPR } = useCurrentAPR();
  const { rewardPerSecond } = useRewardRate();
  const { endTime } = useFarmingPeriod();
  const { isPaused } = usePaused();
  const { emergencyEnabled } = useEmergencyStatus();
  const recentActivity = useRecentActivity(10);

  // Rewards Management State
  const [depositAmount, setDepositAmount] = useState("");
  const [newRewardRate, setNewRewardRate] = useState("");
  const [extendDays, setExtendDays] = useState("");
  const [emergencyWithdrawAmount, setEmergencyWithdrawAmount] = useState("");
  const [showEmergencyConfirm, setShowEmergencyConfirm] = useState(false);

  // Admin Actions
  const { depositRewards, isPending: isDepositing } = useDepositRewards();
  const { setRewardRate, isPending: isSettingRate } = useSetRewardRate();
  const { extendFarming, isPending: isExtending } = useExtendFarming();
  const { setPaused, isPending: isTogglingPause } = useSetPaused();
  const { enableEmergencyWithdraw, isPending: isEnablingEmergency } =
    useEnableEmergencyWithdraw();
  const { emergencyWithdrawRewards, isPending: isWithdrawingEmergency } =
    useEmergencyWithdrawRewards();

  // Calculate metrics
  const availableRewards = farmingStats
    ? parseFloat(formatUnits(farmingStats.availableRewards, 18))
    : 0;

  const totalRewards = farmingStats
    ? parseFloat(formatUnits(farmingStats.totalRewards, 18))
    : 0;

  const rewardsDistributed = totalRewards - availableRewards;

  const rewardRatePerDay = rewardPerSecond
    ? parseFloat(formatUnits(rewardPerSecond, 18)) * 86400
    : 0;

  const daysUntilDepletion =
    rewardRatePerDay > 0 ? availableRewards / rewardRatePerDay : Infinity;

  const now = Math.floor(Date.now() / 1000);
  const daysUntilEnd =
    endTime && endTime > BigInt(now)
      ? Number(endTime - BigInt(now)) / 86400
      : 0;

  // Action Handlers
  const handleDepositRewards = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) return;
    try {
      await depositRewards(parseUnits(depositAmount, 18));
      setDepositAmount("");
    } catch (error) {
      console.error("Deposit failed:", error);
    }
  };

  const handleSetRewardRate = async () => {
    if (!newRewardRate || parseFloat(newRewardRate) <= 0) return;
    try {
      await setRewardRate(parseUnits(newRewardRate, 18));
      setNewRewardRate("");
    } catch (error) {
      console.error("Set rate failed:", error);
    }
  };

  const handleExtendFarming = async () => {
    if (!extendDays || parseInt(extendDays) <= 0) return;
    try {
      const additionalSeconds = BigInt(parseInt(extendDays) * 86400);
      await extendFarming(additionalSeconds);
      setExtendDays("");
    } catch (error) {
      console.error("Extend farming failed:", error);
    }
  };

  const handleTogglePause = async () => {
    try {
      await setPaused(!isPaused);
    } catch (error) {
      console.error("Toggle pause failed:", error);
    }
  };

  const handleEnableEmergency = async () => {
    if (!showEmergencyConfirm) {
      setShowEmergencyConfirm(true);
      return;
    }
    try {
      await enableEmergencyWithdraw("I UNDERSTAND THIS IS IRREVERSIBLE");
      setShowEmergencyConfirm(false);
    } catch (error) {
      console.error("Enable emergency failed:", error);
    }
  };

  const handleEmergencyWithdraw = async () => {
    if (!emergencyWithdrawAmount || parseFloat(emergencyWithdrawAmount) <= 0)
      return;
    try {
      await emergencyWithdrawRewards(parseUnits(emergencyWithdrawAmount, 18));
      setEmergencyWithdrawAmount("");
    } catch (error) {
      console.error("Emergency withdraw failed:", error);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-6xl mb-6">🔌</div>
            <h1 className="text-3xl font-bold text-white mb-4">
              Connect Your Wallet
            </h1>
            <p className="text-gray-400 mb-8">
              Please connect your wallet to access the admin dashboard
            </p>
            <Link
              href="/farming"
              className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
            >
              ← Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

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
              Admin Dashboard
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Manage farming pool, rewards, and emergency controls
            </p>
          </div>

          {/* Emergency Mode Banner */}
          {emergencyEnabled && (
            <EmergencyBanner
              isActive={emergencyEnabled}
              severity="error"
              message="🚨 Emergency mode is ACTIVE. Users can unstake without lock period (no rewards)."
              dismissible={false}
            />
          )}

          {/* Paused Banner */}
          {isPaused && (
            <EmergencyBanner
              isActive={isPaused}
              severity="warning"
              message="⏸️ Contract is PAUSED. Staking and claiming operations are disabled."
              dismissible={false}
            />
          )}

          {/* Contract Health Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <FarmingStatsCard
              title="Available Rewards"
              value={availableRewards.toFixed(0)}
              icon="💰"
              suffix=" MWG"
              isLoading={isLoadingStats}
            />
            <FarmingStatsCard
              title="Total Distributed"
              value={rewardsDistributed.toFixed(0)}
              icon="📤"
              suffix=" MWG"
              isLoading={isLoadingStats}
            />
            <FarmingStatsCard
              title="Reward Rate"
              value={rewardRatePerDay.toFixed(2)}
              icon="⚡"
              suffix=" MWG/day"
              isLoading={!rewardPerSecond}
            />
            <FarmingStatsCard
              title="Depletion ETA"
              value={
                daysUntilDepletion === Infinity
                  ? "N/A"
                  : Math.floor(daysUntilDepletion).toString()
              }
              icon="⏳"
              suffix={daysUntilDepletion !== Infinity ? " days" : ""}
              isLoading={isLoadingStats}
              trend={
                daysUntilDepletion < 30 && daysUntilDepletion !== Infinity
                  ? "down"
                  : undefined
              }
            />
          </div>

          {/* Rewards Management Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">💎</span>
              <h2 className="text-xl font-bold text-white">
                Rewards Management
              </h2>
              <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded">
                REWARD_MANAGER_ROLE
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Deposit Rewards */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Deposit Rewards
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Current balance: {availableRewards.toLocaleString()} MWG
                </p>
                <input
                  type="number"
                  placeholder="Amount (MWG)"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm mb-3 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleDepositRewards}
                  disabled={
                    isDepositing ||
                    !depositAmount ||
                    parseFloat(depositAmount) <= 0
                  }
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed text-sm"
                >
                  {isDepositing ? "Depositing..." : "Deposit Rewards"}
                </button>
              </div>

              {/* Set Reward Rate */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Set Reward Rate
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Current: {rewardRatePerDay.toFixed(2)} MWG/day
                </p>
                <input
                  type="number"
                  placeholder="Rate (MWG/second)"
                  value={newRewardRate}
                  onChange={(e) => setNewRewardRate(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm mb-3 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleSetRewardRate}
                  disabled={
                    isSettingRate ||
                    !newRewardRate ||
                    parseFloat(newRewardRate) <= 0
                  }
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed text-sm"
                >
                  {isSettingRate ? "Updating..." : "Update Rate"}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Daily:{" "}
                  {newRewardRate
                    ? (parseFloat(newRewardRate) * 86400).toFixed(2)
                    : "0"}{" "}
                  MWG/day
                </p>
              </div>

              {/* Extend Farming Period */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Extend Farming Period
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Days remaining: {Math.floor(daysUntilEnd)}
                </p>
                <input
                  type="number"
                  placeholder="Additional days"
                  value={extendDays}
                  onChange={(e) => setExtendDays(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm mb-3 focus:outline-none focus:border-purple-500"
                />
                <button
                  onClick={handleExtendFarming}
                  disabled={
                    isExtending || !extendDays || parseInt(extendDays) <= 0
                  }
                  className="w-full px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed text-sm"
                >
                  {isExtending ? "Extending..." : "Extend Period"}
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  New end:{" "}
                  {extendDays && endTime
                    ? new Date(
                        (Number(endTime) + parseInt(extendDays) * 86400) * 1000
                      ).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Controls Section */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-red-500/20 mb-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-2xl">⚠️</span>
              <h2 className="text-xl font-bold text-white">
                Emergency Controls
              </h2>
              <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                ADMIN_ROLE / PAUSE_ROLE
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Pause Contract */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Pause Contract
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Status:{" "}
                  <span
                    className={isPaused ? "text-red-400" : "text-green-400"}
                  >
                    {isPaused ? "PAUSED" : "ACTIVE"}
                  </span>
                </p>
                <button
                  onClick={handleTogglePause}
                  disabled={isTogglingPause}
                  className={`w-full px-4 py-2 font-semibold rounded-lg transition-all disabled:cursor-not-allowed text-sm ${
                    isPaused
                      ? "bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white"
                      : "bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white"
                  }`}
                >
                  {isTogglingPause
                    ? "Processing..."
                    : isPaused
                    ? "Unpause Contract"
                    : "Pause Contract"}
                </button>
                <p className="text-xs text-gray-500 mt-3">
                  {isPaused
                    ? "Unpause to resume staking/claiming"
                    : "Pause to disable all staking operations"}
                </p>
              </div>

              {/* Enable Emergency Withdraw */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Enable Emergency Mode
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Status:{" "}
                  <span
                    className={
                      emergencyEnabled ? "text-red-400" : "text-gray-400"
                    }
                  >
                    {emergencyEnabled ? "ENABLED" : "DISABLED"}
                  </span>
                </p>
                {!emergencyEnabled && !showEmergencyConfirm && (
                  <button
                    onClick={handleEnableEmergency}
                    className="w-full px-4 py-2 bg-red-600/20 hover:bg-red-600/30 border border-red-500 text-red-400 font-semibold rounded-lg transition-all text-sm"
                  >
                    Enable Emergency Mode
                  </button>
                )}
                {!emergencyEnabled && showEmergencyConfirm && (
                  <div>
                    <p className="text-xs text-red-400 mb-3">
                      ⚠️ This action is IRREVERSIBLE!
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleEnableEmergency}
                        disabled={isEnablingEmergency}
                        className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-all text-sm"
                      >
                        {isEnablingEmergency ? "Enabling..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setShowEmergencyConfirm(false)}
                        className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {emergencyEnabled && (
                  <div className="text-xs text-red-400">
                    ✅ Emergency mode is active (permanent)
                  </div>
                )}
              </div>

              {/* Emergency Withdraw Rewards */}
              <div className="bg-gray-700/30 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3">
                  Emergency Withdraw
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Available: {availableRewards.toLocaleString()} MWG
                </p>
                <input
                  type="number"
                  placeholder="Amount (MWG)"
                  value={emergencyWithdrawAmount}
                  onChange={(e) => setEmergencyWithdrawAmount(e.target.value)}
                  disabled={!emergencyEnabled}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white text-sm mb-3 focus:outline-none focus:border-red-500 disabled:opacity-50"
                />
                <button
                  onClick={handleEmergencyWithdraw}
                  disabled={
                    !emergencyEnabled ||
                    isWithdrawingEmergency ||
                    !emergencyWithdrawAmount ||
                    parseFloat(emergencyWithdrawAmount) <= 0
                  }
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed text-sm"
                >
                  {isWithdrawingEmergency
                    ? "Withdrawing..."
                    : "Emergency Withdraw"}
                </button>
                {!emergencyEnabled && (
                  <p className="text-xs text-gray-500 mt-2">
                    Emergency mode must be enabled first
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Monitoring Dashboard */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 mb-6">
            <h2 className="text-xl font-bold text-white mb-6">
              Contract Monitoring
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-400">
                    Total Staked
                  </h3>
                  <span className="text-xl">💎</span>
                </div>
                <p className="text-xl font-bold text-white">
                  $
                  {farmingStats
                    ? formatUnits(farmingStats.totalStaked, 18)
                    : "0"}
                </p>
              </div>

              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-400">
                    Participants
                  </h3>
                  <span className="text-xl">👥</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {farmingStats?.participantCount
                    ? Number(farmingStats.participantCount)
                    : 0}
                </p>
              </div>

              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-400">
                    Current APR
                  </h3>
                  <span className="text-xl">📈</span>
                </div>
                <p className="text-xl font-bold text-white">
                  {currentAPR ? (Number(currentAPR) / 100).toFixed(2) : "0"}%
                </p>
              </div>

              <div className="bg-gray-700/30 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-gray-400">
                    Pool Status
                  </h3>
                  <span className="text-xl">
                    {farmingStats?.isActive ? "✅" : "⏸️"}
                  </span>
                </div>
                <p className="text-lg font-bold text-white">
                  {farmingStats?.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            </div>

            {/* Warning if low rewards */}
            {daysUntilDepletion < 30 && daysUntilDepletion !== Infinity && (
              <div className="p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg mb-6">
                <p className="text-yellow-400 font-semibold text-sm">
                  ⚠️ Critical: Pool rewards may be depleted in{" "}
                  {Math.floor(daysUntilDepletion)} days. Please deposit more
                  rewards immediately.
                </p>
              </div>
            )}
          </div>

          {/* Recent Activity */}
          {recentActivity.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <h2 className="text-xl font-bold text-white mb-4">
                Recent Activity
              </h2>
              <TransactionHistory
                events={recentActivity}
                maxItems={10}
                showPagination={false}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
