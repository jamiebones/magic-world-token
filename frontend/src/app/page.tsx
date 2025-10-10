"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import { useMultiRoleGate } from "@/hooks/useRoleGate";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { hasAnyAdminRole, roles } = useMultiRoleGate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        {!isConnected ? (
          <div className="text-center py-20">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 max-w-2xl mx-auto border border-purple-500/20">
              <h2 className="text-4xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
                Welcome to Magic World
              </h2>
              <p className="text-gray-300 text-lg mb-8">
                Connect your wallet to start interacting with the Magic World
                Token ecosystem
              </p>
              <div className="text-center text-sm text-gray-400 mt-4">
                Click the &quot;Connect Wallet&quot; button in the top right
                corner to get started
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Connected Address */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <h3 className="text-sm font-medium text-gray-400 mb-2">
                Connected Wallet
              </h3>
              <p className="text-xl font-mono text-purple-400">{address}</p>

              {/* Admin Role Badge */}
              {hasAnyAdminRole && (
                <div className="mt-4 flex items-center space-x-2">
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-medium rounded-full border border-purple-500/30">
                    Admin Access
                  </span>
                  <Link
                    href="/admin"
                    className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
                  >
                    Go to Admin Dashboard →
                  </Link>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {hasAnyAdminRole && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
                <h3 className="text-lg font-semibold mb-4 text-purple-400">
                  Quick Actions
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {roles.rewardDistributor && (
                    <Link
                      href="/admin/game/distribute"
                      className="p-4 bg-gray-700/50 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all group"
                    >
                      <div className="text-2xl mb-2">💰</div>
                      <div className="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">
                        Distribute Rewards
                      </div>
                    </Link>
                  )}
                  {roles.gameAdmin && (
                    <Link
                      href="/admin/game/config"
                      className="p-4 bg-gray-700/50 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all group"
                    >
                      <div className="text-2xl mb-2">⚙️</div>
                      <div className="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">
                        Game Configuration
                      </div>
                    </Link>
                  )}
                  {roles.vaultAdmin && (
                    <Link
                      href="/admin/partners/allocate"
                      className="p-4 bg-gray-700/50 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all group"
                    >
                      <div className="text-2xl mb-2">🤝</div>
                      <div className="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">
                        Partner Allocations
                      </div>
                    </Link>
                  )}
                  {hasAnyAdminRole && (
                    <Link
                      href="/admin/emergency"
                      className="p-4 bg-gray-700/50 rounded-lg border border-purple-500/20 hover:border-purple-500/40 transition-all group"
                    >
                      <div className="text-2xl mb-2">🚨</div>
                      <div className="text-sm font-medium text-white group-hover:text-purple-400 transition-colors">
                        Emergency Controls
                      </div>
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Contract Information */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Token Contract */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                <h3 className="text-lg font-semibold mb-2 text-purple-400">
                  Token Contract
                </h3>
                <p className="text-xs font-mono text-gray-400 break-all">
                  {CONTRACT_ADDRESSES.TOKEN}
                </p>
                <div className="mt-4 pt-4 border-t border-purple-500/20">
                  <p className="text-sm text-gray-300">
                    ERC20 token with batch transfers and role-based access
                    control
                  </p>
                </div>
              </div>

              {/* Game Contract */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                <h3 className="text-lg font-semibold mb-2 text-purple-400">
                  Game Contract
                </h3>
                <p className="text-xs font-mono text-gray-400 break-all">
                  {CONTRACT_ADDRESSES.GAME}
                </p>
                <div className="mt-4 pt-4 border-t border-purple-500/20">
                  <p className="text-sm text-gray-300">
                    Manages play-to-earn distribution with vault system
                  </p>
                </div>
              </div>

              {/* Partner Vault Contract */}
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
                <h3 className="text-lg font-semibold mb-2 text-purple-400">
                  Partner Vault
                </h3>
                <p className="text-xs font-mono text-gray-400 break-all">
                  {CONTRACT_ADDRESSES.PARTNER_VAULT}
                </p>
                <div className="mt-4 pt-4 border-t border-purple-500/20">
                  <p className="text-sm text-gray-300">
                    Time-locked vault for partner allocations
                  </p>
                </div>
              </div>
            </div>

      
          </div>
        )}
      </main>
    </div>
  );
}
