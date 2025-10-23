"use client";

import { useAccount } from "wagmi";
import { CustomConnectButton } from "@/components/ConnectButton";
import { useUserDistributions } from "@/hooks/useMerkleDistribution";
import Link from "next/link";
import { DistributionStatus, VaultType } from "@/types/merkle";

export default function UserDistributionsPage() {
  const { isConnected, address } = useAccount();
  const { distributions, loading, initialLoad, error, refetch } = useUserDistributions();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-purple-500/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              My Distributions
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              View your token allocations and claim status
            </p>
          </div>
          <CustomConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <DashboardContent
          isConnected={isConnected}
          address={address}
          distributions={distributions}
          loading={loading}
          initialLoad={initialLoad}
          error={error}
          refetch={refetch}
        />
      </main>
    </div>
  );
}

function DashboardContent({
  isConnected,
  address,
  distributions,
  loading,
  initialLoad,
  error,
  refetch,
}: {
  isConnected: boolean;
  address?: `0x${string}`;
  distributions: unknown[];
  loading: boolean;
  initialLoad: boolean;
  error: string | null;
  refetch: () => void;
}) {
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 border border-purple-500/20">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Connect Your Wallet
          </h2>
          <p className="text-gray-400 mb-8">
            Connect your wallet to view your token distributions and claim
            rewards.
          </p>
          <div className="inline-block">
            <CustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Wallet Info */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Your Wallet</h2>
            <p className="text-sm text-gray-400 font-mono">{address}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400 mb-1">Eligible Distributions</p>
            <p className="text-2xl font-bold text-white">
              {distributions.length}
            </p>
          </div>
        </div>
      </div>

      {/* Distributions List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Your Distributions</h2>
          <button
            onClick={refetch}
            className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>

        {/* Show subtle indicator during refresh */}
        {loading && !initialLoad && (
          <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
            <div className="inline-flex items-center gap-2">
              <div className="animate-spin h-4 w-4 border-b-2 border-purple-400 rounded-full"></div>
              <span className="text-purple-400">Refreshing distributions...</span>
            </div>
          </div>
        )}

        {initialLoad ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading your distributions...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-400 mb-4">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={refetch}
              className="px-6 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-500/30"
            >
              Retry
            </button>
          </div>
        ) : distributions.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-16 w-16"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                />
              </svg>
            </div>
            <p className="text-gray-400 mb-2 text-lg font-semibold">
              No distributions found
            </p>
            <p className="text-gray-500 text-sm">
              You don&apos;t have any token allocations yet. Check back later!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {distributions.map((dist: unknown) => {
              const distribution = dist as {
                distributionId: number;
                title?: string;
                description?: string;
                vaultType: VaultType;
                totalAmount: number;
                status: DistributionStatus;
                startTime: number;
                endTime: number;
              };
              const now = Math.floor(Date.now() / 1000);
              const isActive =
                distribution.status === DistributionStatus.ACTIVE;
              const hasStarted = now >= distribution.startTime;
              const hasEnded = now > distribution.endTime;

              return (
                <div
                  key={distribution.distributionId}
                  className="border border-purple-500/20 rounded-xl p-6 hover:border-purple-500/40 transition-all"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-bold text-white">
                          {distribution.title ||
                            `Distribution #${distribution.distributionId}`}
                        </h3>
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            isActive && hasStarted && !hasEnded
                              ? "bg-green-500/20 text-green-300"
                              : hasEnded
                              ? "bg-gray-500/20 text-gray-300"
                              : "bg-yellow-500/20 text-yellow-300"
                          }`}
                        >
                          {hasEnded
                            ? "ENDED"
                            : hasStarted
                            ? "ACTIVE"
                            : "UPCOMING"}
                        </span>
                        <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-xs text-blue-300">
                          {distribution.vaultType.replace(/_/g, " ")}
                        </span>
                      </div>
                      {distribution.description && (
                        <p className="text-gray-400 text-sm mb-2">
                          {distribution.description}
                        </p>
                      )}
                      <div className="flex gap-6 text-sm">
                        <div>
                          <span className="text-gray-400">Total: </span>
                          <span className="text-white font-mono">
                            {Number(distribution.totalAmount).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">Start: </span>
                          <span className="text-white">
                            {new Date(
                              distribution.startTime * 1000
                            ).toLocaleDateString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400">End: </span>
                          <span className="text-white">
                            {new Date(
                              distribution.endTime * 1000
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/distributions/${distribution.distributionId}`}
                    >
                      <button className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all text-sm">
                        View Details
                      </button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <svg
            className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-blue-300 font-semibold mb-2">
              About Merkle Distributions
            </h3>
            <p className="text-blue-200/80 text-sm">
              Merkle distributions use gas-efficient Merkle trees to allow you
              to claim your allocated tokens. When a distribution is active, you
              can view your allocation and generate a Merkle proof to claim your
              tokens on-chain.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
