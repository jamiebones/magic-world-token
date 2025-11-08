"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useUserPositions } from "@/hooks/farming/useStakedPositions";
import { usePositionPendingRewards } from "@/hooks/farming/useStakedPositions";
import { usePositionDetails } from "@/hooks/farming/useStakedPositions";
import {
  useClaimRewards,
  useUnstakePosition,
} from "@/hooks/farming/useFarmingActions";
import { PositionCard } from "@/components/farming/PositionCard";

export default function PositionsPage() {
  const { address, isConnected } = useAccount();
  const { positions, isLoading } = useUserPositions(address);

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
              Please connect your wallet to view your staked positions
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
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Link
              href="/farming"
              className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300 mb-4"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              My Staked Positions
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Manage your staked NFT positions and claim rewards
            </p>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4 animate-spin">⚙️</div>
              <p className="text-gray-400">Loading your positions...</p>
            </div>
          )}

          {/* No Positions */}
          {!isLoading && (!positions || positions.length === 0) && (
            <div className="text-center py-12 bg-gray-800/50 rounded-2xl border border-purple-500/20">
              <div className="text-6xl mb-4">📭</div>
              <h2 className="text-2xl font-bold text-white mb-2">
                No Staked Positions
              </h2>
              <p className="text-gray-400 mb-6">
                You haven&apos;t staked any positions yet
              </p>
              <Link
                href="/farming/stake"
                className="inline-block px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors"
              >
                Stake Your First Position →
              </Link>
            </div>
          )}

          {/* Positions Grid */}
          {!isLoading && positions && positions.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {positions.map((tokenId) => (
                <PositionCardWrapper
                  key={tokenId.toString()}
                  tokenId={tokenId}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// Wrapper component to fetch individual position data
function PositionCardWrapper({ tokenId }: { tokenId: bigint }) {
  const { positionDetails, isLoading } = usePositionDetails(tokenId);
  const { pendingRewards } = usePositionPendingRewards(tokenId);
  const { claimRewards, isPending: isClaiming } = useClaimRewards();
  const { unstakePosition, isPending: isUnstaking } = useUnstakePosition();

  if (isLoading || !positionDetails) {
    return (
      <div className="bg-gray-800/50 rounded-xl p-6 border border-purple-500/20 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const isUnlocked = Number(positionDetails.lockUntil) <= now;
  const hasPendingRewards = pendingRewards && pendingRewards > BigInt(0);

  return (
    <PositionCard
      position={positionDetails}
      pendingRewards={pendingRewards}
      onClaim={() => claimRewards([tokenId])}
      onUnstake={() => unstakePosition(tokenId)}
      isClaimable={!!hasPendingRewards}
      isUnstakable={isUnlocked}
      isLoading={isClaiming || isUnstaking}
    />
  );
}
