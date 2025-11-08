"use client";

import React from "react";
import { formatUnits } from "viem";

export interface RewardsDisplayProps {
  pendingAmount: bigint;
  claimedAmount?: bigint;
  onClaim?: () => void;
  isLoading?: boolean;
  isClaiming?: boolean;
  showClaimButton?: boolean;
  mwgPriceUSD?: number;
}

export function RewardsDisplay({
  pendingAmount,
  claimedAmount,
  onClaim,
  isLoading = false,
  isClaiming = false,
  showClaimButton = true,
  mwgPriceUSD,
}: RewardsDisplayProps) {
  // Format rewards
  const pending = parseFloat(formatUnits(pendingAmount, 18));
  const claimed = claimedAmount
    ? parseFloat(formatUnits(claimedAmount, 18))
    : undefined;

  // Calculate USD value if price is provided
  const pendingUSD = mwgPriceUSD ? pending * mwgPriceUSD : undefined;
  const claimedUSD =
    mwgPriceUSD && claimed !== undefined ? claimed * mwgPriceUSD : undefined;

  const hasPendingRewards = pending > 0;

  return (
    <div className="bg-gradient-to-br from-purple-900/30 to-pink-900/30 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-500/30">
      {/* Pending Rewards */}
      <div className="mb-4 sm:mb-6">
        <p className="text-sm text-gray-400 mb-2">Pending Rewards</p>
        {isLoading ? (
          <div className="animate-pulse">
            <div className="h-10 sm:h-12 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2 flex-wrap">
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                {pending.toFixed(4)}
              </h2>
              <span className="text-lg sm:text-xl text-purple-300 font-semibold">
                MWG
              </span>
            </div>
            {pendingUSD !== undefined && (
              <p className="text-sm sm:text-base text-gray-400 mt-1">
                ≈ ${pendingUSD.toFixed(2)} USD
              </p>
            )}
          </>
        )}
      </div>

      {/* Claimed Rewards (if provided) */}
      {claimed !== undefined && (
        <div className="mb-4 sm:mb-6 pb-4 sm:pb-6 border-b border-gray-700">
          <p className="text-sm text-gray-400 mb-2">Total Claimed</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <h3 className="text-xl sm:text-2xl font-bold text-green-400">
              {claimed.toFixed(4)}
            </h3>
            <span className="text-base sm:text-lg text-green-300 font-semibold">
              MWG
            </span>
          </div>
          {claimedUSD !== undefined && (
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              ≈ ${claimedUSD.toFixed(2)} USD
            </p>
          )}
        </div>
      )}

      {/* Claim Button */}
      {showClaimButton && (
        <button
          onClick={onClaim}
          disabled={!hasPendingRewards || isClaiming || isLoading}
          className={`w-full px-6 py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg transition-all ${
            hasPendingRewards && !isClaiming && !isLoading
              ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isClaiming ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⚙️</span> Claiming Rewards...
            </span>
          ) : !hasPendingRewards ? (
            "No Rewards to Claim"
          ) : (
            <span className="flex items-center justify-center gap-2">
              💰 Claim {pending.toFixed(4)} MWG
            </span>
          )}
        </button>
      )}

      {/* Info Box */}
      {hasPendingRewards && (
        <div className="mt-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
          <p className="text-xs sm:text-sm text-purple-200">
            ✨ Your rewards are ready! Claim them anytime.
          </p>
        </div>
      )}
    </div>
  );
}
