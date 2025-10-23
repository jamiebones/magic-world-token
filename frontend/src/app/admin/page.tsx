"use client";

import { useAccount } from "wagmi";
import { CustomConnectButton } from "@/components/ConnectButton";
import { useMultiRoleGate } from "@/hooks/useRoleGate";
import {
  useTokenStats,
  useGameStats,
  usePartnerVaultStats,
} from "@/hooks/useContractStats";
import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-purple-500/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Admin Dashboard
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Magic World Token Administration
            </p>
          </div>
          <CustomConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <DashboardContent />
      </main>
    </div>
  );
}

function DashboardContent() {
  const { isConnected, address } = useAccount();
  const roleCheck = useMultiRoleGate();
  const tokenStats = useTokenStats();
  const gameStats = useGameStats();
  const vaultStats = usePartnerVaultStats();

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
            Connect your wallet to access the admin dashboard and manage the
            Magic World Token ecosystem.
          </p>
          <div className="inline-block">
            <CustomConnectButton />
          </div>
        </div>
      </div>
    );
  }

  if (roleCheck.isLoading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 border border-purple-500/20">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-400 mx-auto mb-6"></div>
          <p className="text-gray-400">Checking your permissions...</p>
        </div>
      </div>
    );
  }

  if (!roleCheck.hasAnyAdminRole) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 border border-red-500/20">
          <div className="mb-4">
            <svg
              className="mx-auto h-16 w-16 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">Access Denied</h2>
          <p className="text-gray-400 mb-4">
            Your wallet does not have any administrative roles.
          </p>
          <div className="bg-gray-900/50 rounded-lg p-4 text-left">
            <p className="text-sm text-gray-400 mb-2">Connected Address:</p>
            <p className="text-xs font-mono text-purple-400 break-all">
              {address}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Welcome Section */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome, Administrator
            </h2>
            <p className="text-sm text-gray-400 font-mono">{address}</p>
          </div>
          <div className="flex gap-2">
            {roleCheck.roles.tokenAdmin && (
              <span className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
                Token Admin
              </span>
            )}
            {roleCheck.roles.gameAdmin && (
              <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/50 rounded-full text-xs text-blue-300">
                Game Admin
              </span>
            )}
            {roleCheck.roles.rewardDistributor && (
              <span className="px-3 py-1 bg-green-500/20 border border-green-500/50 rounded-full text-xs text-green-300">
                Distributor
              </span>
            )}
            {roleCheck.roles.vaultAdmin && (
              <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/50 rounded-full text-xs text-yellow-300">
                Vault Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Token Contract</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                tokenStats.paused
                  ? "bg-red-500/20 text-red-300"
                  : "bg-green-500/20 text-green-300"
              }`}
            >
              {tokenStats.paused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Total Supply:</span>
              <span className="text-white font-mono">
                {Number(tokenStats.totalSupply).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Symbol:</span>
              <span className="text-white font-mono">{tokenStats.symbol}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Game Contract</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                gameStats.paused
                  ? "bg-red-500/20 text-red-300"
                  : "bg-green-500/20 text-green-300"
              }`}
            >
              {gameStats.paused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Distributed:</span>
              <span className="text-white font-mono">
                {Number(gameStats.totalDistributed).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Players:</span>
              <span className="text-white font-mono">
                {gameStats.playersCount}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Partner Vault</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs ${
                vaultStats.paused
                  ? "bg-red-500/20 text-red-300"
                  : "bg-green-500/20 text-green-300"
              }`}
            >
              {vaultStats.paused ? "PAUSED" : "ACTIVE"}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Allocated:</span>
              <span className="text-white font-mono">
                {Number(vaultStats.totalAllocated).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Available:</span>
              <span className="text-white font-mono">
                {Number(vaultStats.unallocated).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Actions */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-xl font-semibold text-white mb-6">
          Administrative Actions
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Merkle Distributions */}
          {(roleCheck.roles.rewardDistributor ||
            roleCheck.roles.gameDefaultAdmin ||
            roleCheck.roles.gameAdmin) && (
            <Link href="/admin/merkle">
              <div className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-2 border-green-500/30 rounded-xl hover:border-green-500/50 transition-all cursor-pointer group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  🌳
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Merkle Distributions
                </h3>
                <p className="text-sm text-gray-400">
                  Gas-efficient batch token distributions
                </p>
              </div>
            </Link>
          )}

          {/* Reward Distribution */}
          {(roleCheck.roles.rewardDistributor ||
            roleCheck.roles.gameDefaultAdmin) && (
            <Link href="/admin/game/distribute">
              <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-2 border-purple-500/30 rounded-xl hover:border-purple-500/50 transition-all cursor-pointer group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  💰
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Distribute Rewards
                </h3>
                <p className="text-sm text-gray-400">
                  Send tokens from vaults to players
                </p>
              </div>
            </Link>
          )}

          {/* Game Configuration */}
          {(roleCheck.roles.gameAdmin || roleCheck.roles.gameDefaultAdmin) && (
            <Link href="/admin/game/config">
              <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-2 border-blue-500/30 rounded-xl hover:border-blue-500/50 transition-all cursor-pointer group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  ⚙️
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Game Settings
                </h3>
                <p className="text-sm text-gray-400">
                  Configure limits and cooldowns
                </p>
              </div>
            </Link>
          )}

          {/* Partner Allocation */}
          {(roleCheck.roles.vaultAdmin ||
            roleCheck.roles.vaultDefaultAdmin) && (
            <Link href="/admin/partners/allocate">
              <div className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-2 border-yellow-500/30 rounded-xl hover:border-yellow-500/50 transition-all cursor-pointer group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  🤝
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Partner Allocation
                </h3>
                <p className="text-sm text-gray-400">
                  Allocate tokens to partners
                </p>
              </div>
            </Link>
          )}

          {/* Emergency Controls */}
          {roleCheck.hasAnyAdminRole && (
            <Link href="/admin/emergency">
              <div className="p-6 bg-gradient-to-br from-red-500/10 to-orange-500/10 border-2 border-red-500/30 rounded-xl hover:border-red-500/50 transition-all cursor-pointer group">
                <div className="text-3xl mb-3 group-hover:scale-110 transition-transform">
                  🚨
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Emergency Controls
                </h3>
                <p className="text-sm text-gray-400">Pause/unpause contracts</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Quick Links */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-xl font-semibold text-white mb-4">Quick Links</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href={`https://bscscan.com/address/${tokenStats.name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-all"
          >
            <div>
              <p className="text-sm text-gray-400">Token Contract</p>
              <p className="text-white font-semibold">View on BSCScan</p>
            </div>
            <svg
              className="w-5 h-5 text-purple-400"
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

          <Link
            href="/"
            className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-all"
          >
            <div>
              <p className="text-sm text-gray-400">Public Dashboard</p>
              <p className="text-white font-semibold">View Main Site</p>
            </div>
            <svg
              className="w-5 h-5 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </Link>

          <a
            href="https://docs.magicworld.io"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg hover:bg-gray-900/70 transition-all"
          >
            <div>
              <p className="text-sm text-gray-400">Documentation</p>
              <p className="text-white font-semibold">Read the Docs</p>
            </div>
            <svg
              className="w-5 h-5 text-purple-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
