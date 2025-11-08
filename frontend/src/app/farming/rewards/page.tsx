"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useState } from "react";
import { formatUnits } from "viem";
import {
  useUserPositions,
  usePositionPendingRewards,
} from "@/hooks/farming/useStakedPositions";
import {
  useClaimRewards,
  useClaimAllRewards,
} from "@/hooks/farming/useFarmingActions";
import { useUserEvents } from "@/hooks/farming/useFarmingEvents";
import { RewardsDisplay } from "@/components/farming/RewardsDisplay";
import { TransactionHistory } from "@/components/farming/TransactionHistory";

export default function RewardsPage() {
  const { address, isConnected } = useAccount();
  const { positions, isLoading } = useUserPositions(address);
  const {
    claimAllRewards,
    isPending: isClaimingAll,
    isSuccess: claimAllSuccess,
  } = useClaimAllRewards();
  const {
    claimRewards,
    isPending: isClaimingSelected,
    isSuccess: claimSelectedSuccess,
  } = useClaimRewards();
  const userActivity = useUserEvents(address);
  const [selectedPositions, setSelectedPositions] = useState<bigint[]>([]);
  const [totalPending, setTotalPending] = useState<bigint>(BigInt(0));

  // Filter for claim events only
  const claimEvents = userActivity.filter(
    (activity) => activity.type === "claim"
  );

  const handleSelectPosition = (tokenId: bigint, checked: boolean) => {
    if (checked) {
      setSelectedPositions((prev) => [...prev, tokenId]);
    } else {
      setSelectedPositions((prev) => prev.filter((id) => id !== tokenId));
    }
  };

  const handleClaimSelected = async () => {
    if (selectedPositions.length === 0) return;
    await claimRewards(selectedPositions);
    setSelectedPositions([]);
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
              Please connect your wallet to claim your farming rewards
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
              Claim Rewards
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Claim your earned MWG farming rewards
            </p>
          </div>

          {/* Total Pending Rewards */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">
              Total Pending Rewards
            </h2>
            <RewardsDisplay
              pendingAmount={totalPending}
              onClaim={claimAllRewards}
              isLoading={isClaimingAll}
              showClaimButton={totalPending > BigInt(0) && !isLoading}
            />
          </div>

          {/* Success Messages */}
          {claimAllSuccess && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
              <p className="text-green-400 font-semibold">
                ✅ All rewards claimed successfully!
              </p>
            </div>
          )}
          {claimSelectedSuccess && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg">
              <p className="text-green-400 font-semibold">
                ✅ Selected rewards claimed successfully!
              </p>
            </div>
          )}

          {/* Individual Position Selection */}
          {positions && positions.length > 0 && (
            <div className="bg-gray-800/50 rounded-2xl p-6 border border-purple-500/20 mb-8">
              <h2 className="text-xl font-bold text-white mb-4">
                Claim Specific Positions
              </h2>
              <p className="text-sm text-gray-400 mb-6">
                Select individual positions to claim (max 50 at once)
              </p>

              <div className="space-y-3 mb-6">
                {positions.map((tokenId) => (
                  <PositionCheckbox
                    key={tokenId.toString()}
                    tokenId={tokenId}
                    checked={selectedPositions.some((id) => id === tokenId)}
                    onChange={handleSelectPosition}
                    onRewardsUpdate={(rewards) => {
                      setTotalPending((prev) => prev + rewards);
                    }}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                <p className="text-sm text-gray-400">
                  {selectedPositions.length} position
                  {selectedPositions.length !== 1 ? "s" : ""} selected
                </p>
                <button
                  onClick={handleClaimSelected}
                  disabled={
                    selectedPositions.length === 0 ||
                    isClaimingSelected ||
                    selectedPositions.length > 50
                  }
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  {isClaimingSelected
                    ? "Claiming..."
                    : `Claim Selected (${selectedPositions.length})`}
                </button>
              </div>

              {selectedPositions.length > 50 && (
                <p className="text-sm text-red-400 mt-2">
                  ⚠️ Cannot claim more than 50 positions at once
                </p>
              )}
            </div>
          )}

          {/* No Rewards */}
          {!isLoading && (!positions || positions.length === 0) && (
            <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-purple-500/20">
              <div className="text-6xl mb-4">💰</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                No Rewards Available
              </h2>
              <p className="text-gray-400 mb-6">
                Stake positions to start earning rewards
              </p>
              <Link
                href="/farming/stake"
                className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
              >
                Stake Position →
              </Link>
            </div>
          )}

          {/* Claim History */}
          {claimEvents.length > 0 && (
            <div className="mt-8">
              <h2 className="text-2xl font-bold text-white mb-4">
                Claim History
              </h2>
              <TransactionHistory
                events={claimEvents}
                filterBy="claim"
                maxItems={10}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Component for individual position checkbox
function PositionCheckbox({
  tokenId,
  checked,
  onChange,
  onRewardsUpdate,
}: {
  tokenId: bigint;
  checked: boolean;
  onChange: (tokenId: bigint, checked: boolean) => void;
  onRewardsUpdate?: (rewards: bigint) => void;
}) {
  const { pendingRewards, isLoading } = usePositionPendingRewards(tokenId);

  // Update parent component with rewards
  if (pendingRewards && onRewardsUpdate) {
    onRewardsUpdate(pendingRewards);
  }

  return (
    <label className="flex items-center justify-between p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 cursor-pointer transition-colors">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(tokenId, e.target.checked)}
          disabled={!pendingRewards || pendingRewards === BigInt(0)}
          className="w-5 h-5 rounded border-gray-600 text-purple-600 focus:ring-purple-500 disabled:cursor-not-allowed"
        />
        <div>
          <p className="text-white font-semibold">
            Position #{tokenId.toString()}
          </p>
          <p className="text-sm text-gray-400">
            {isLoading
              ? "Loading..."
              : `${formatUnits(pendingRewards || BigInt(0), 18)} MWG`}
          </p>
        </div>
      </div>
      {(!pendingRewards || pendingRewards === BigInt(0)) && (
        <span className="text-xs text-gray-500">No rewards</span>
      )}
    </label>
  );
}
