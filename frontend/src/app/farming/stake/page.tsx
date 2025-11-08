"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useNFTApproval, useApproveNFT } from "@/hooks/farming/useNFTPositions";
import { useStakePosition } from "@/hooks/farming/useFarmingActions";
import { useBoostMultiplier } from "@/hooks/farming/useFarmingPool";
import { LockPeriodSelector } from "@/components/farming/LockPeriodSelector";
import { BoostMultiplierBadge } from "@/components/farming/BoostMultiplierBadge";
import { APRBadge } from "@/components/farming/APRBadge";

export default function StakePage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const [lockDays, setLockDays] = useState(0);
  const [tokenId, setTokenId] = useState("");
  const [step, setStep] = useState<"select" | "approve" | "stake">("select");

  // Hooks
  const { isApproved, isLoading: isCheckingApproval } = useNFTApproval(address);
  const {
    approveNFT,
    isPending: isApproving,
    isSuccess: approvalSuccess,
  } = useApproveNFT();
  const {
    stakePosition,
    isPending: isStaking,
    isSuccess: stakeSuccess,
  } = useStakePosition();
  const { boostMultiplier } = useBoostMultiplier(lockDays);

  // Handle approval
  const handleApprove = async () => {
    try {
      approveNFT();
    } catch (error) {
      console.error("Approval error:", error);
    }
  };

  // Handle stake
  const handleStake = async () => {
    if (!tokenId) {
      alert("Please enter a valid Token ID");
      return;
    }

    try {
      const tokenIdBigInt = BigInt(tokenId);
      stakePosition(tokenIdBigInt, lockDays);
    } catch (error) {
      console.error("Staking error:", error);
    }
  };

  // Success redirect
  if (stakeSuccess) {
    setTimeout(() => router.push("/farming/positions"), 2000);
  }

  // Not connected state
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
              Please connect your wallet to stake NFT positions
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

  // Success state
  if (stakeSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <main className="container mx-auto px-4 py-12">
          <div className="max-w-2xl mx-auto text-center">
            <div className="text-6xl mb-6 animate-bounce">✅</div>
            <h1 className="text-3xl font-bold text-green-400 mb-4">
              Position Staked Successfully!
            </h1>
            <p className="text-gray-400 mb-8">
              Redirecting to your positions...
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <Link
              href="/farming"
              className="inline-flex items-center text-sm text-purple-400 hover:text-purple-300 mb-4"
            >
              ← Back to Dashboard
            </Link>
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              Stake NFT Position
            </h1>
            <p className="text-sm sm:text-base text-gray-400">
              Stake your PancakeSwap V3 position to earn MWG rewards
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div
                className={`flex-1 text-center ${
                  step === "select" ? "text-purple-400" : "text-gray-500"
                }`}
              >
                <div className="text-2xl mb-1">1️⃣</div>
                <p className="text-xs sm:text-sm font-medium">
                  Select Position
                </p>
              </div>
              <div className="w-12 sm:w-20 h-1 bg-gray-700"></div>
              <div
                className={`flex-1 text-center ${
                  step === "approve" ? "text-purple-400" : "text-gray-500"
                }`}
              >
                <div className="text-2xl mb-1">2️⃣</div>
                <p className="text-xs sm:text-sm font-medium">Approve NFT</p>
              </div>
              <div className="w-12 sm:w-20 h-1 bg-gray-700"></div>
              <div
                className={`flex-1 text-center ${
                  step === "stake" ? "text-purple-400" : "text-gray-500"
                }`}
              >
                <div className="text-2xl mb-1">3️⃣</div>
                <p className="text-xs sm:text-sm font-medium">Stake</p>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-purple-500/20 mb-6">
            {/* Token ID Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                NFT Token ID
              </label>
              <input
                type="number"
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                placeholder="Enter your PancakeSwap V3 NFT Token ID"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all"
              />
              <p className="mt-2 text-xs text-gray-400">
                💡 You can find your Token ID in your wallet or on PancakeSwap
              </p>
            </div>

            {/* Lock Period Selector */}
            <LockPeriodSelector
              selectedDays={lockDays}
              onChange={setLockDays}
              disabled={isStaking || isApproving}
            />

            {/* Boost Display */}
            {boostMultiplier && (
              <div className="mt-6 p-4 bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg border border-purple-500/30">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Your Boost:</p>
                    <BoostMultiplierBadge
                      multiplier={Number(boostMultiplier)}
                      size="lg"
                      animated
                    />
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400 mb-1">Estimated APR:</p>
                    <APRBadge apr={5000} boosted size="lg" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-4">
            {!isApproved && !approvalSuccess ? (
              <button
                onClick={() => {
                  setStep("approve");
                  handleApprove();
                }}
                disabled={isApproving || isCheckingApproval || !tokenId}
                className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all text-lg"
              >
                {isApproving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span> Approving NFT...
                  </span>
                ) : (
                  "1. Approve NFT Transfer"
                )}
              </button>
            ) : (
              <button
                onClick={() => {
                  setStep("stake");
                  handleStake();
                }}
                disabled={isStaking || !tokenId}
                className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all text-lg shadow-lg hover:shadow-xl"
              >
                {isStaking ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚙️</span> Staking Position...
                  </span>
                ) : (
                  "🎯 Stake Position"
                )}
              </button>
            )}

            <Link
              href="/farming"
              className="block w-full px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white text-center font-semibold rounded-lg transition-all"
            >
              Cancel
            </Link>
          </div>

          {/* Info Box */}
          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-300 mb-2">
              📚 How to stake:
            </h3>
            <ul className="text-xs sm:text-sm text-blue-200 space-y-1">
              <li>1. Enter your PancakeSwap V3 NFT Token ID</li>
              <li>2. Choose your lock period (longer = higher rewards)</li>
              <li>3. Approve the NFT transfer (one-time)</li>
              <li>4. Stake your position and start earning!</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
