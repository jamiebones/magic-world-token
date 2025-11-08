"use client";

import React from "react";
import type { StakedPosition } from "@/types/farming";
import { formatUnits } from "viem";

export interface PositionCardProps {
  position: StakedPosition;
  pendingRewards?: bigint;
  onClaim?: () => void;
  onUnstake?: () => void;
  isClaimable?: boolean;
  isUnstakable?: boolean;
  isLoading?: boolean;
  showActions?: boolean;
}

export function PositionCard({
  position,
  pendingRewards,
  onClaim,
  onUnstake,
  isClaimable = false,
  isUnstakable = false,
  isLoading = false,
  showActions = true,
}: PositionCardProps) {
  const now = Math.floor(Date.now() / 1000);
  const lockEnd = Number(position.lockUntil);
  const isLocked = lockEnd > now;
  const timeRemaining = Math.max(0, lockEnd - now);

  // Calculate days, hours, minutes
  const daysRemaining = Math.floor(timeRemaining / 86400);
  const hoursRemaining = Math.floor((timeRemaining % 86400) / 3600);
  const minutesRemaining = Math.floor((timeRemaining % 3600) / 60);

  // Format values
  const usdValue = parseFloat(formatUnits(position.usdValue, 18)).toFixed(2);
  const rewards = pendingRewards
    ? parseFloat(formatUnits(pendingRewards, 18)).toFixed(4)
    : "0.00";
  const boost = (Number(position.boostMultiplier) / 1000).toFixed(2);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
      {/* Header with Token ID and Status */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
            Position #{position.tokenId.toString()}
          </h3>
          <p className="text-xs sm:text-sm text-gray-400">PancakeSwap V3 NFT</p>
        </div>

        {/* Lock Status Badge */}
        <div
          className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-semibold flex-shrink-0 ml-2 ${
            isLocked
              ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"
              : "bg-green-500/20 text-green-400 border border-green-500/30"
          }`}
        >
          {isLocked ? "🔒 Locked" : "🔓 Unlocked"}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
        {/* USD Value */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Staked Value</p>
          <p className="text-base sm:text-lg font-bold text-white">
            ${usdValue}
          </p>
        </div>

        {/* Pending Rewards */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Pending Rewards</p>
          <p className="text-base sm:text-lg font-bold text-purple-400">
            {rewards} MWG
          </p>
        </div>

        {/* Boost Multiplier */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Boost</p>
          <p className="text-base sm:text-lg font-bold text-green-400">
            {boost}x
          </p>
        </div>

        {/* Lock Time */}
        <div className="bg-gray-900/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">
            {isLocked ? "Unlocks In" : "Unlocked"}
          </p>
          <p className="text-base sm:text-lg font-bold text-white">
            {isLocked ? (
              <span className="text-sm sm:text-base">
                {daysRemaining}d {hoursRemaining}h {minutesRemaining}m
              </span>
            ) : (
              <span className="text-green-400">Ready</span>
            )}
          </p>
        </div>
      </div>

      {/* Liquidity Info */}
      <div className="mb-4 p-3 bg-gray-900/30 rounded-lg">
        <p className="text-xs text-gray-400 mb-1">Liquidity</p>
        <p className="text-sm text-white font-mono">
          {position.liquidity.toString()}
        </p>
        <div className="flex gap-2 mt-2 text-xs text-gray-500">
          <span>Tick: {position.tickLower}</span>
          <span>→</span>
          <span>{position.tickUpper}</span>
        </div>
      </div>

      {/* Action Buttons */}
      {showActions && (
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={onClaim}
            disabled={!isClaimable || isLoading}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-all ${
              isClaimable && !isLoading
                ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg hover:shadow-xl"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⚙️</span> Processing...
              </span>
            ) : (
              `Claim Rewards ${
                pendingRewards && pendingRewards > BigInt(0) ? "💰" : ""
              }`
            )}
          </button>

          <button
            onClick={onUnstake}
            disabled={!isUnstakable || isLoading || isLocked}
            className={`flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm sm:text-base transition-all ${
              isUnstakable && !isLoading && !isLocked
                ? "bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isLocked ? "🔒 Locked" : "Unstake Position"}
          </button>
        </div>
      )}
    </div>
  );
}
