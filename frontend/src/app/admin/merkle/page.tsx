"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { CustomConnectButton } from "@/components/ConnectButton";
import { useDistributions } from "@/hooks/useMerkleDistribution";
import Link from "next/link";
import { VaultType, DistributionStatus } from "@/types/merkle";

export default function MerkleDistributionsPage() {
  const [statusFilter, setStatusFilter] = useState<DistributionStatus | "all">(
    "all"
  );
  const [vaultFilter, setVaultFilter] = useState<VaultType | "all">("all");

  // Memoize filters to prevent unnecessary re-renders
  const filters = useMemo(() => {
    const result: { status?: DistributionStatus; vaultType?: VaultType } = {};
    if (statusFilter !== "all") {
      result.status = statusFilter;
    }
    if (vaultFilter !== "all") {
      result.vaultType = vaultFilter;
    }
    return result;
  }, [statusFilter, vaultFilter]);

  const { distributions, loading, initialLoad, error, refetch } =
    useDistributions(filters);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-purple-500/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Merkle Distributions
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Gas-efficient token distributions using Merkle trees
            </p>
          </div>
          <CustomConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <DashboardContent
          distributions={distributions}
          loading={loading}
          initialLoad={initialLoad}
          error={error}
          refetch={refetch}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          vaultFilter={vaultFilter}
          setVaultFilter={setVaultFilter}
        />
      </main>
    </div>
  );
}

function DashboardContent({
  distributions,
  loading,
  initialLoad,
  error,
  refetch,
  statusFilter,
  setStatusFilter,
  vaultFilter,
  setVaultFilter,
}: {
  distributions: unknown[];
  loading: boolean;
  initialLoad: boolean;
  error: string | null;
  refetch: () => void;
  statusFilter: DistributionStatus | "all";
  setStatusFilter: (status: DistributionStatus | "all") => void;
  vaultFilter: VaultType | "all";
  setVaultFilter: (vault: VaultType | "all") => void;
}) {
  const { isConnected } = useAccount();

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
            Connect your wallet to view and manage Merkle distributions.
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
      {/* Actions Bar */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">
              Manage Distributions
            </h2>
            <p className="text-sm text-gray-400">
              Create and monitor Merkle tree-based token distributions
            </p>
          </div>
          <Link href="/admin/merkle/create">
            <button className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg">
              + Create Distribution
            </button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as DistributionStatus | "all")
              }
              className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Statuses</option>
              <option value={DistributionStatus.ACTIVE}>Active</option>
              <option value={DistributionStatus.PENDING}>Pending</option>
              <option value={DistributionStatus.COMPLETED}>Completed</option>
              <option value={DistributionStatus.CANCELLED}>Cancelled</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Vault Type
            </label>
            <select
              value={vaultFilter}
              onChange={(e) =>
                setVaultFilter(e.target.value as VaultType | "all")
              }
              className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
            >
              <option value="all">All Vaults</option>
              <option value={VaultType.PLAYER_TASKS}>Player Tasks</option>
              <option value={VaultType.SOCIAL_FOLLOWERS}>
                Social Followers
              </option>
              <option value={VaultType.SOCIAL_POSTERS}>Social Posters</option>
              <option value={VaultType.ECOSYSTEM_FUND}>Ecosystem Fund</option>
            </select>
          </div>
        </div>
      </div>

      {/* Distributions List */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        {/* Show loading indicator when fetching after filters change */}
        {loading && !initialLoad && (
          <div className="mb-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-400"></div>
              <span className="text-purple-300 text-sm">Updating...</span>
            </div>
          </div>
        )}

        {initialLoad ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading distributions...</p>
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
            <p className="text-gray-400 mb-4">No distributions found</p>
            <Link href="/admin/merkle/create">
              <button className="px-6 py-2 bg-purple-500/20 border border-purple-500/50 rounded-lg text-purple-300 hover:bg-purple-500/30">
                Create First Distribution
              </button>
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-purple-500/20">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    ID
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Title
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Vault
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Recipients
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Amount
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {distributions.map((dist: unknown) => {
                  const distribution = dist as {
                    distributionId: number;
                    title?: string;
                    vaultType: VaultType;
                    totalRecipients: number;
                    totalAmount: number;
                    status: DistributionStatus;
                    claimedCount: number;
                  };
                  return (
                    <tr
                      key={distribution.distributionId}
                      className="border-b border-purple-500/10 hover:bg-purple-500/5"
                    >
                      <td className="py-4 px-4 text-white font-mono">
                        #{distribution.distributionId}
                      </td>
                      <td className="py-4 px-4 text-white">
                        {distribution.title || "Untitled Distribution"}
                      </td>
                      <td className="py-4 px-4">
                        <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-xs text-blue-300">
                          {distribution.vaultType.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-white">
                        {distribution.claimedCount}/
                        {distribution.totalRecipients}
                      </td>
                      <td className="py-4 px-4 text-white font-mono">
                        {Number(distribution.totalAmount).toLocaleString()}
                      </td>
                      <td className="py-4 px-4">
                        <span
                          className={`px-2 py-1 rounded text-xs ${
                            distribution.status === DistributionStatus.ACTIVE
                              ? "bg-green-500/20 text-green-300"
                              : distribution.status ===
                                DistributionStatus.PENDING
                              ? "bg-yellow-500/20 text-yellow-300"
                              : distribution.status ===
                                DistributionStatus.COMPLETED
                              ? "bg-gray-500/20 text-gray-300"
                              : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {distribution.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <Link
                          href={`/admin/merkle/${distribution.distributionId}`}
                        >
                          <button className="text-purple-400 hover:text-purple-300 text-sm">
                            View Details →
                          </button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
