"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useState } from "react";
import { formatUnits } from "viem";
import {
  useUserPositions,
  usePositionDetails,
  usePositionPendingRewards,
} from "@/hooks/farming/useStakedPositions";
import {
  useUnstakePosition,
  useEmergencyUnstake,
} from "@/hooks/farming/useFarmingActions";
import { useEmergencyStatus } from "@/hooks/farming/useFarmingPool";
import { CountdownTimer } from "@/components/farming/CountdownTimer";
import { EmergencyBanner } from "@/components/farming/EmergencyBanner";
import { BoostMultiplierBadge } from "@/components/farming/BoostMultiplierBadge";

export default function UnstakePage() {
  const { address, isConnected } = useAccount();
  const { positions, isLoading } = useUserPositions(address);
  const { emergencyEnabled } = useEmergencyStatus();
  const [, setSelectedPosition] = useState<bigint | null>(null);
  // Calculate current timestamp
  const now = Math.floor(Date.now() / 1000);

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
              Please connect your wallet to unstake your positions
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

  // Note: we intentionally avoid calling hooks inside array callbacks.
  // Positions are rendered via PositionWrapper which calls hooks at component level.

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Link
              href="/farming"
              className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300 mb-4"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              Unstake Positions
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Withdraw your NFT positions and claim pending rewards
            </p>
          </div>

          {/* Emergency Mode Banner */}
          {emergencyEnabled && (
            <EmergencyBanner
              isActive={emergencyEnabled}
              severity="error"
              message="Emergency withdrawal mode is active. You can unstake without waiting for lock period, but no rewards will be claimed."
              dismissible={false}
            />
          )}

          {/* Unlocked Positions */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              All Positions
            </h2>
            <div className="space-y-4">
              {positions &&
                positions.map((tokenId) => (
                  <PositionWrapper
                    key={tokenId.toString()}
                    tokenId={tokenId}
                    now={now}
                    onSelect={setSelectedPosition}
                    isEmergencyMode={emergencyEnabled || false}
                  />
                ))}
            </div>
          </div>

          {/* No Positions */}
          {!isLoading && (!positions || positions.length === 0) && (
            <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-purple-500/20">
              <div className="text-6xl mb-4">📦</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                No Staked Positions
              </h2>
              <p className="text-gray-400 mb-6">
                You don&apos;t have any positions to unstake
              </p>
              <Link
                href="/farming/stake"
                className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
              >
                Stake Position →
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Wrapper to decide whether position is locked or unlocked
function PositionWrapper({
  tokenId,
  now,
  onSelect,
  isEmergencyMode,
}: {
  tokenId: bigint;
  now: number;
  onSelect: (tokenId: bigint | null) => void;
  isEmergencyMode: boolean;
}) {
  const { positionDetails } = usePositionDetails(tokenId);

  if (!positionDetails) return null;

  const isUnlocked = Number(positionDetails.lockUntil) <= now;

  if (isUnlocked || isEmergencyMode) {
    return (
      <UnstakeCard
        tokenId={tokenId}
        onSelect={onSelect}
        isEmergencyMode={isEmergencyMode}
      />
    );
  } else {
    return (
      <LockedPositionCard
        tokenId={tokenId}
        isEmergencyMode={isEmergencyMode}
        onEmergencyUnstake={onSelect}
      />
    );
  }
}

// Unlocked position card with unstake button
function UnstakeCard({
  tokenId,
  onSelect,
  isEmergencyMode,
}: {
  tokenId: bigint;
  onSelect: (tokenId: bigint | null) => void;
  isEmergencyMode: boolean;
}) {
  const { positionDetails } = usePositionDetails(tokenId);
  const { pendingRewards } = usePositionPendingRewards(tokenId);
  const { unstakePosition, isPending, isSuccess } = useUnstakePosition();

  const handleUnstake = async () => {
    onSelect(tokenId);
    await unstakePosition(tokenId);
    if (isSuccess) {
      setTimeout(() => onSelect(null), 2000);
    }
  };

  if (!positionDetails) return null;

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-bold text-white">
              Position #{tokenId.toString()}
            </h3>
            <BoostMultiplierBadge
              multiplier={Number(positionDetails.boostMultiplier)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Staked Value</p>
              <p className="text-white font-semibold">
                ${formatUnits(positionDetails.usdValue, 18)}
              </p>
            </div>
            <div>
              <p className="text-gray-400">Pending Rewards</p>
              <p className="text-green-400 font-semibold">
                {formatUnits(pendingRewards || BigInt(0), 18)} MWG
              </p>
            </div>
          </div>

          {!isEmergencyMode && (
            <p className="text-xs text-purple-400 mt-3">
              ✅ Unlocked - Rewards will be claimed automatically upon unstaking
            </p>
          )}
          {isEmergencyMode && (
            <p className="text-xs text-red-400 mt-3">
              ⚠️ Emergency mode - No rewards will be claimed
            </p>
          )}
        </div>

        <button
          onClick={handleUnstake}
          disabled={isPending}
          className="px-6 py-3 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed whitespace-nowrap"
        >
          {isPending ? "Unstaking..." : "Unstake Position"}
        </button>
      </div>

      {isSuccess && (
        <div className="mt-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
          <p className="text-green-400 text-sm font-semibold">
            ✅ Position unstaked successfully! NFT returned to your wallet.
          </p>
        </div>
      )}
    </div>
  );
}

// Locked position card with countdown
function LockedPositionCard({
  tokenId,
  isEmergencyMode,
  onEmergencyUnstake,
}: {
  tokenId: bigint;
  isEmergencyMode: boolean;
  onEmergencyUnstake: (tokenId: bigint | null) => void;
}) {
  const { positionDetails } = usePositionDetails(tokenId);
  const { pendingRewards } = usePositionPendingRewards(tokenId);
  const { emergencyUnstake, isPending, isSuccess } = useEmergencyUnstake();
  const [showConfirm, setShowConfirm] = useState(false);

  const handleEmergencyUnstake = async () => {
    onEmergencyUnstake(tokenId);
    await emergencyUnstake(tokenId);
    if (isSuccess) {
      setShowConfirm(false);
      setTimeout(() => onEmergencyUnstake(null), 2000);
    }
  };

  if (!positionDetails) return null;

  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-xl font-bold text-gray-400">
              Position #{tokenId.toString()}
            </h3>
            <BoostMultiplierBadge
              multiplier={Number(positionDetails.boostMultiplier)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm mb-4">
            <div>
              <p className="text-gray-500">Staked Value</p>
              <p className="text-gray-300 font-semibold">
                ${formatUnits(positionDetails.usdValue, 18)}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Pending Rewards</p>
              <p className="text-gray-300 font-semibold">
                {formatUnits(pendingRewards || BigInt(0), 18)} MWG
              </p>
            </div>
          </div>

          <div className="bg-gray-700/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-2">🔒 Unlocks in:</p>
            <CountdownTimer targetTimestamp={positionDetails.lockUntil} />
          </div>
        </div>

        {isEmergencyMode && !showConfirm && (
          <button
            onClick={() => setShowConfirm(true)}
            className="px-6 py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500 text-red-400 font-semibold rounded-lg transition-all whitespace-nowrap"
          >
            Emergency Unstake
          </button>
        )}

        {isEmergencyMode && showConfirm && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-red-400 mb-2">⚠️ Forfeit all rewards?</p>
            <div className="flex gap-2">
              <button
                onClick={handleEmergencyUnstake}
                disabled={isPending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed text-sm"
              >
                {isPending ? "Unstaking..." : "Confirm"}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {isSuccess && (
        <div className="mt-4 p-3 bg-orange-500/20 border border-orange-500/50 rounded-lg">
          <p className="text-orange-400 text-sm font-semibold">
            ⚠️ Emergency unstake complete. NFT returned (no rewards claimed).
          </p>
        </div>
      )}
    </div>
  );
}
