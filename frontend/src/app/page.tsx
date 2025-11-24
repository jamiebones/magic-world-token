"use client";

import { useAccount } from "wagmi";
import Link from "next/link";
import { useConnectModal } from "@rainbow-me/rainbowkit";

export default function Home() {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Hero Section */}
      <main className="container mx-auto px-4">
        <div className="min-h-screen flex flex-col items-center justify-center py-12">
          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto mb-16">
            {/* Logo/Icon */}
            <div className="mb-8 flex justify-center">
              <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center shadow-2xl shadow-purple-500/50">
                <span className="text-5xl">✨</span>
              </div>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6">
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600">
                Magic World Ecosystem
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-xl sm:text-2xl text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
              Complete DeFi platform for MWG token trading, liquidity farming, and reward distribution
            </p>

            {/* Description */}
            <p className="text-base sm:text-lg text-gray-400 mb-12 max-w-3xl mx-auto">
              Trade MWG tokens peer-to-peer with zero slippage, earn rewards through liquidity farming, and participate in our decentralized ecosystem on Binance Smart Chain.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              {!isConnected ? (
                <button
                  onClick={openConnectModal}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-xl shadow-2xl shadow-purple-500/50 transition-all transform hover:scale-105"
                >
                  Connect Wallet to Start
                </button>
              ) : (
                <>
                  <Link
                    href="/orderbook"
                    className="inline-block px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white text-lg font-semibold rounded-xl shadow-2xl shadow-purple-500/50 transition-all transform hover:scale-105"
                  >
                    Start Trading →
                  </Link>
                  <Link
                    href="/farming"
                    className="inline-block px-8 py-4 bg-gray-800/50 hover:bg-gray-800/70 border border-purple-500/30 hover:border-purple-500/50 text-white text-lg font-semibold rounded-xl transition-all"
                  >
                    Farm MWG
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto w-full mb-16">
            {/* Feature 1: Order Book */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
              <div className="text-5xl mb-6">📊</div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Order Book Trading
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Trade MWG/BNB pairs directly with other users. Create buy or sell orders at your desired price. Zero slippage, guaranteed execution at your price.
              </p>
              {isConnected && (
                <Link
                  href="/orderbook"
                  className="inline-flex items-center text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                >
                  Go to Order Book →
                </Link>
              )}
            </div>

            {/* Feature 2: Liquidity Farming */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
              <div className="text-5xl mb-6">🌾</div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                Liquidity Farming
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Stake your PancakeSwap V3 MWG/BNB LP positions to earn MWG rewards. Lock for longer periods to earn up to 2x boost multipliers.
              </p>
              {isConnected && (
                <Link
                  href="/farming"
                  className="inline-flex items-center text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                >
                  Start Farming →
                </Link>
              )}
            </div>

            {/* Feature 3: Token Distribution */}
            <div className="bg-gray-800/30 backdrop-blur-sm rounded-2xl p-8 border border-purple-500/20 hover:border-purple-500/40 transition-all group">
              <div className="text-5xl mb-6">💰</div>
              <h3 className="text-2xl font-semibold text-white mb-4">
                MWG Distribution
              </h3>
              <p className="text-gray-400 text-sm leading-relaxed mb-6">
                Transparent reward distribution system with vault-based allocation tracking. Automated airdrops, merkle tree distributions, and batch transfers.
              </p>
              {isConnected && (
                <Link
                  href="/distributions"
                  className="inline-flex items-center text-purple-400 hover:text-purple-300 text-sm font-medium transition-colors"
                >
                  View Distributions →
                </Link>
              )}
            </div>
          </div>

          {/* Key Benefits Section */}
          <div className="max-w-5xl mx-auto w-full mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">
              Why Magic World Ecosystem?
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex gap-4 items-start">
                <div className="text-3xl">🔒</div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Secure & Decentralized</h4>
                  <p className="text-gray-400 text-sm">Smart contracts on BSC with audited code. Your keys, your tokens. Full custody control.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="text-3xl">⚡</div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Low Gas Fees</h4>
                  <p className="text-gray-400 text-sm">Built on Binance Smart Chain for minimal transaction costs. Trade and farm without breaking the bank.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="text-3xl">📈</div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">No Slippage Trading</h4>
                  <p className="text-gray-400 text-sm">Order book model ensures you get exactly the price you want. No AMM price impact or front-running.</p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="text-3xl">🎯</div>
                <div>
                  <h4 className="text-lg font-semibold text-white mb-2">Boosted Farming Rewards</h4>
                  <p className="text-gray-400 text-sm">Earn up to 2x multiplier by locking your LP positions. Flexible lock periods from 7 days to 1 year.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Section */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 max-w-4xl mx-auto w-full mb-16">
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
                0%
              </div>
              <div className="text-gray-400 text-sm">Trading Fees</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
                2x
              </div>
              <div className="text-gray-400 text-sm">Max Farm Boost</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
                24/7
              </div>
              <div className="text-gray-400 text-sm">Always Available</div>
            </div>
            <div className="text-center">
              <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 mb-2">
                100%
              </div>
              <div className="text-gray-400 text-sm">On-Chain</div>
            </div>
          </div>

          {/* Footer Note */}
          <div className="text-center">
            <p className="text-gray-500 text-sm">
              Powered by Binance Smart Chain • Secured by Smart Contracts • Audited Code
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
