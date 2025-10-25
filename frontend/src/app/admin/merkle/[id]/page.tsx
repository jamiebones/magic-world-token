"use client";

import { use } from "react";
import Link from "next/link";
import {
  useDistribution,
  useDistributionEligibility,
  useMerkleProof,
  useMerkleAdmin,
} from "@/hooks/useMerkleDistribution";
import { DistributionStatus } from "@/types/merkle";
import { useState } from "react";

export default function DistributionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const distributionId = parseInt(resolvedParams.id);

  const { distribution, loading, error, refetch } =
    useDistribution(distributionId);
  const { eligibility, loading: eligibilityLoading } =
    useDistributionEligibility(distributionId);
  const {
    proof,
    getProof,
    loading: proofLoading,
  } = useMerkleProof(distributionId);
  const {
    syncDistribution,
    getDistributionLeaves,
    loading: adminLoading,
  } = useMerkleAdmin();

  const [showLeaves, setShowLeaves] = useState(false);
  const [leaves, setLeaves] = useState<unknown[]>([]);

  const handleSync = async () => {
    try {
      await syncDistribution(distributionId);
      refetch();
    } catch (err) {
      console.error("Failed to sync:", err);
    }
  };

  const handleGetLeaves = async () => {
    try {
      const result = await getDistributionLeaves(distributionId);
      setLeaves(result);
      setShowLeaves(true);
    } catch (err) {
      console.error("Failed to get leaves:", err);
    }
  };

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
          <Link href="/admin/merkle">
            <button className="px-6 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-500/30">
              Back to Distributions
            </button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Back Button */}
          <Link href="/admin/merkle">
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
              Back to Distributions
            </button>
          </Link>

          {/* Overview */}
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
              <span
                className={`px-3 py-1 rounded text-sm ${
                  distribution.status === DistributionStatus.ACTIVE
                    ? "bg-green-500/20 text-green-300"
                    : distribution.status === DistributionStatus.PENDING
                    ? "bg-yellow-500/20 text-yellow-300"
                    : distribution.status === DistributionStatus.COMPLETED
                    ? "bg-gray-500/20 text-gray-300"
                    : "bg-red-500/20 text-red-300"
                }`}
              >
                {distribution.status.toUpperCase()}
              </span>
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
                <p className="text-gray-400 text-sm mb-1">Claimed</p>
                <p className="text-2xl font-bold text-white">
                  {distribution.claimedCount}/{distribution.totalRecipients}
                </p>
              </div>
              <div>
                <p className="text-gray-400 text-sm mb-1">Claimed Amount</p>
                <p className="text-2xl font-bold text-white">
                  {Number(distribution.claimedAmount).toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Technical Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-bold text-white mb-4">
                Technical Details
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Merkle Root:</span>
                  <span className="text-white font-mono text-xs">
                    {distribution.merkleRoot.slice(0, 10)}...
                    {distribution.merkleRoot.slice(-8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Vault Type:</span>
                  <span className="text-white">
                    {distribution.vaultType.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Start Time:</span>
                  <span className="text-white">
                    {new Date(distribution.startTime * 1000).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">End Time:</span>
                  <span className="text-white">
                    {new Date(distribution.endTime * 1000).toLocaleString()}
                  </span>
                </div>
                {distribution.transactionHash && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">TX Hash:</span>
                    <a
                      href={`https://bscscan.com/tx/${distribution.transactionHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 font-mono text-xs"
                    >
                      {distribution.transactionHash.slice(0, 10)}...
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-bold text-white mb-4">
                Your Eligibility
              </h3>
              {eligibilityLoading ? (
                <div className="text-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto"></div>
                </div>
              ) : eligibility?.eligible ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <svg
                      className="w-6 h-6"
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
                    <span className="font-semibold">You are eligible!</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Your Allocation:</span>
                      <span className="text-white font-mono">
                        {Number(
                          eligibility.allocation?.amount
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Claimed:</span>
                      <span
                        className={
                          eligibility.allocation?.claimed
                            ? "text-green-400"
                            : "text-yellow-400"
                        }
                      >
                        {eligibility.allocation?.claimed ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                  {!eligibility.allocation?.claimed && (
                    <button
                      onClick={() => getProof()}
                      disabled={proofLoading}
                      className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all disabled:opacity-50"
                    >
                      {proofLoading ? "Loading..." : "Get Merkle Proof"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-400">
                  <svg
                    className="w-6 h-6"
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
                  <span>Not eligible for this distribution</span>
                </div>
              )}
            </div>
          </div>

          {/* Merkle Proof */}
          {proof && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-bold text-white mb-4">
                Merkle Proof
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-400 mb-2">Address:</p>
                  <p className="text-white font-mono text-sm bg-gray-900/50 p-3 rounded">
                    {proof.address}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-2">Amount:</p>
                  <p className="text-white font-mono text-sm bg-gray-900/50 p-3 rounded">
                    {proof.amount}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-400 mb-2">
                    Proof ({proof.proof.length} hashes):
                  </p>
                  <div className="bg-gray-900/50 p-3 rounded max-h-48 overflow-y-auto">
                    {proof.proof.map((hash, index) => (
                      <p
                        key={index}
                        className="text-white font-mono text-xs mb-1"
                      >
                        {hash}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Admin Actions */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
            <h3 className="text-lg font-bold text-white mb-4">Admin Actions</h3>
            <div className="flex gap-4">
              <button
                onClick={handleSync}
                disabled={adminLoading}
                className="px-6 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
              >
                {adminLoading ? "Syncing..." : "Sync from Blockchain"}
              </button>
              <button
                onClick={handleGetLeaves}
                disabled={adminLoading}
                className="px-6 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-500/30 disabled:opacity-50"
              >
                {adminLoading ? "Loading..." : "View All Leaves"}
              </button>
            </div>
          </div>

          {/* Leaves List */}
          {showLeaves && leaves.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <h3 className="text-lg font-bold text-white mb-4">
                Distribution Leaves ({leaves.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-purple-500/20">
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">
                        Index
                      </th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">
                        Address
                      </th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">
                        Amount
                      </th>
                      <th className="text-left py-3 px-4 text-gray-400 font-medium">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((leaf: unknown) => {
                      const l = leaf as {
                        index: number;
                        address?: string;
                        amount: number;
                        claimed: boolean;
                      };

                      // Skip invalid entries
                      if (!l.address) {
                        return null;
                      }

                      return (
                        <tr
                          key={l.index}
                          className="border-b border-purple-500/10 hover:bg-purple-500/5"
                        >
                          <td className="py-3 px-4 text-white font-mono">
                            {l.index}
                          </td>
                          <td className="py-3 px-4 text-white font-mono text-sm">
                            {l.address.slice(0, 10)}...{l.address.slice(-8)}
                          </td>
                          <td className="py-3 px-4 text-white font-mono">
                            {Number(l.amount).toLocaleString()}
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`px-2 py-1 rounded text-xs ${
                                l.claimed
                                  ? "bg-green-500/20 text-green-300"
                                  : "bg-gray-500/20 text-gray-300"
                              }`}
                            >
                              {l.claimed ? "CLAIMED" : "UNCLAIMED"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
