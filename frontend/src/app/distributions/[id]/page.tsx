"use client";

import { use } from "react";
import Link from "next/link";
import {
  useDistribution,
  useDistributionEligibility,
  useMerkleProof,
} from "@/hooks/useMerkleDistribution";
import { DistributionStatus } from "@/types/merkle";

export default function UserDistributionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const distributionId = parseInt(resolvedParams.id);

  const { distribution, loading, error } = useDistribution(distributionId);
  const { eligibility, loading: eligibilityLoading } =
    useDistributionEligibility(distributionId);
  const {
    proof,
    getProof,
    loading: proofLoading,
  } = useMerkleProof(distributionId);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading distribution...</p>
        </div>
      </div>
    );
  }

  if (error || !distribution) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
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
          <h2 className="text-2xl font-bold text-white mb-2">
            Distribution Not Found
          </h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <Link href="/distributions">
            <button className="px-6 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-500/30">
              Back to My Distributions
            </button>
          </Link>
        </div>
      </div>
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const hasStarted = now >= distribution.startTime;
  const hasEnded = now > distribution.endTime;
  const isActive =
    distribution.status === DistributionStatus.ACTIVE &&
    hasStarted &&
    !hasEnded;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Back Button */}
          <Link href="/distributions">
            <button className="text-purple-400 hover:text-purple-300 flex items-center gap-2">
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to My Distributions
            </button>
          </Link>

          {/* Distribution Overview */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  {distribution.title || "Untitled Distribution"}
                </h2>
                {distribution.description && (
                  <p className="text-gray-400">{distribution.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <span
                  className={`px-3 py-1 rounded text-sm ${
                    isActive
                      ? "bg-green-500/20 text-green-300"
                      : hasEnded
                      ? "bg-gray-500/20 text-gray-300"
                      : "bg-yellow-500/20 text-yellow-300"
                  }`}
                >
                  {hasEnded ? "ENDED" : hasStarted ? "ACTIVE" : "UPCOMING"}
                </span>
                <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-sm text-blue-300">
                  {distribution.vaultType.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Recipients</p>
                <p className="text-2xl font-bold text-white">
                  {distribution.totalRecipients}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Total Amount</p>
                <p className="text-2xl font-bold text-white">
                  {Number(distribution.totalAmount).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Progress</p>
                <p className="text-2xl font-bold text-white">
                  {distribution.totalRecipients > 0
                    ? Math.round(
                        (distribution.claimedCount /
                          distribution.totalRecipients) *
                          100
                      )
                    : 0}
                  %
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Claimed</p>
                <p className="text-2xl font-bold text-white">
                  {distribution.claimedCount}/{distribution.totalRecipients}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6">
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-purple-500 to-pink-600 h-2 rounded-full transition-all"
                  style={{
                    width: `${
                      distribution.totalRecipients > 0
                        ? (distribution.claimedCount /
                            distribution.totalRecipients) *
                          100
                        : 0
                    }%`,
                  }}
                ></div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <h3 className="text-lg font-bold text-white mb-4">Timeline</h3>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    hasStarted ? "bg-green-500" : "bg-gray-500"
                  }`}
                ></div>
                <div className="flex-1">
                  <p className="text-white font-medium">Start Time</p>
                  <p className="text-gray-400 text-sm">
                    {new Date(distribution.startTime * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full ${
                    hasEnded
                      ? "bg-red-500"
                      : hasStarted
                      ? "bg-yellow-500"
                      : "bg-gray-500"
                  }`}
                ></div>
                <div className="flex-1">
                  <p className="text-white font-medium">End Time</p>
                  <p className="text-gray-400 text-sm">
                    {new Date(distribution.endTime * 1000).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Your Allocation */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <h3 className="text-lg font-bold text-white mb-4">
              Your Allocation
            </h3>
            {eligibilityLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
                <p className="text-gray-400">Checking your eligibility...</p>
              </div>
            ) : eligibility?.eligible ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3 text-green-400 mb-4">
                  <svg
                    className="w-8 h-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span className="text-xl font-semibold">
                    You are eligible for this distribution!
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-2">
                      Your Allocation
                    </p>
                    <p className="text-3xl font-bold text-white">
                      {Number(eligibility.allocation?.amount).toLocaleString()}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">MWG tokens</p>
                  </div>
                  <div className="bg-gray-900/50 rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-2">Claim Status</p>
                    <p
                      className={`text-3xl font-bold ${
                        eligibility.allocation?.claimed
                          ? "text-green-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {eligibility.allocation?.claimed ? "Claimed" : "Pending"}
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      {eligibility.allocation?.claimed
                        ? "Tokens claimed"
                        : "Ready to claim"}
                    </p>
                  </div>
                </div>

                {!eligibility.allocation?.claimed && isActive && (
                  <div className="space-y-4">
                    <button
                      onClick={() => getProof()}
                      disabled={proofLoading}
                      className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 text-lg"
                    >
                      {proofLoading
                        ? "Generating Proof..."
                        : "Generate Merkle Proof to Claim"}
                    </button>

                    {proof && (
                      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
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
                          <div className="flex-1">
                            <h4 className="text-blue-300 font-semibold mb-2">
                              Merkle Proof Generated
                            </h4>
                            <p className="text-blue-200/80 text-sm mb-4">
                              Use this proof to claim your tokens on the
                              blockchain. You&apos;ll need to call the claim
                              function on the Game contract with the following
                              parameters:
                            </p>
                            <div className="space-y-2 text-xs">
                              <div className="bg-gray-900/50 p-3 rounded font-mono">
                                <span className="text-gray-400">Amount:</span>{" "}
                                <span className="text-white">
                                  {proof.amount}
                                </span>
                              </div>
                              <div className="bg-gray-900/50 p-3 rounded font-mono overflow-x-auto">
                                <span className="text-gray-400">Proof:</span>{" "}
                                <span className="text-white break-all">
                                  [{proof.proof.join(", ")}]
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isActive && (
                  <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                    <p className="text-yellow-300 text-sm">
                      {hasEnded
                        ? "This distribution has ended. Claims are no longer possible."
                        : "This distribution has not started yet. Check back later."}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg
                  className="mx-auto h-16 w-16 text-gray-500 mb-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-gray-400 text-lg font-semibold mb-2">
                  Not Eligible
                </p>
                <p className="text-gray-500 text-sm">
                  Your wallet is not included in this distribution.
                </p>
              </div>
            )}
          </div>

          {/* Contract Info */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <h3 className="text-lg font-bold text-white mb-4">
              Contract Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Merkle Root:</span>
                <span className="text-white font-mono text-xs">
                  {distribution.merkleRoot.slice(0, 12)}...
                  {distribution.merkleRoot.slice(-10)}
                </span>
              </div>
              {distribution.transactionHash && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Transaction:</span>
                  <a
                    href={`https://bscscan.com/tx/${distribution.transactionHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 font-mono text-xs flex items-center gap-1"
                  >
                    View on BSCScan
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
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
