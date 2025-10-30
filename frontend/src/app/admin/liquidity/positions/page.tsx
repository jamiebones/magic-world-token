"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { usePancakeSwapV3 } from "@/hooks/usePancakeSwapV3";
import { CONTRACT_ADDRESSES, PANCAKESWAP_V3 } from "@/config/contracts";
import { formatTokenAmount } from "@/utils/liquidityCalculations";
import type { LiquidityPosition } from "@/types/liquidity";

export default function LiquidityPositionsPage() {
  const { isConnected } = useAccount();
  const { getUserPositions, removeLiquidity, collectFees } = usePancakeSwapV3();

  const [positions, setPositions] = useState<LiquidityPosition[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<bigint | null>(null);
  const [actionLoading, setActionLoading] = useState<
    "remove" | "collect" | null
  >(null);

  /**
   * Load positions on mount
   */
  useEffect(() => {
    if (isConnected) {
      loadPositions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  /**
   * Load user positions
   */
  const loadPositions = async () => {
    setLoadingPositions(true);
    try {
      console.log("🔄 Loading positions...");
      const userPositions = await getUserPositions();
      console.log("📊 Found positions:", userPositions.length);
      console.log("📋 Positions:", userPositions);
      setPositions(userPositions);
    } catch (err) {
      console.error("❌ Error loading positions:", err);
    } finally {
      setLoadingPositions(false);
    }
  };

  /**
   * Handle remove liquidity
   */
  const handleRemoveLiquidity = async (position: LiquidityPosition) => {
    if (!confirm(`Remove all liquidity from position #${position.tokenId}?`)) {
      return;
    }

    setSelectedPosition(position.tokenId);
    setActionLoading("remove");

    try {
      const success = await removeLiquidity(
        position.tokenId,
        position.liquidity
      );

      if (success) {
        alert("✅ Liquidity removed successfully!");
        await loadPositions();
      } else {
        alert("❌ Failed to remove liquidity");
      }
    } catch (err) {
      console.error("Error removing liquidity:", err);
      alert("❌ Error removing liquidity");
    } finally {
      setSelectedPosition(null);
      setActionLoading(null);
    }
  };

  /**
   * Handle collect fees
   */
  const handleCollectFees = async (position: LiquidityPosition) => {
    setSelectedPosition(position.tokenId);
    setActionLoading("collect");

    try {
      const success = await collectFees(position.tokenId);

      if (success) {
        alert("✅ Fees collected successfully!");
        await loadPositions();
      } else {
        alert("❌ Failed to collect fees");
      }
    } catch (err) {
      console.error("Error collecting fees:", err);
      alert("❌ Error collecting fees");
    } finally {
      setSelectedPosition(null);
      setActionLoading(null);
    }
  };

  /**
   * Get token symbol from address
   */
  const getTokenSymbol = (address: string): string => {
    if (address.toLowerCase() === CONTRACT_ADDRESSES.TOKEN.toLowerCase()) {
      return "MWG";
    }
    if (address.toLowerCase() === PANCAKESWAP_V3.WBNB.toLowerCase()) {
      return "BNB";
    }
    return "???";
  };

  /**
   * Get fee tier label
   */
  const getFeeTierLabel = (fee: number): string => {
    return `${(fee / 10000).toFixed(2)}%`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            My Liquidity Positions
          </h1>
          <p className="text-gray-600 mt-2">
            Manage your PancakeSwap V3 liquidity positions
          </p>
        </div>

        {/* Connection Warning */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800">
              ⚠️ Please connect your wallet to view your positions
            </p>
          </div>
        )}

        {/* Refresh Button */}
        {isConnected && (
          <div className="mb-6">
            <button
              onClick={loadPositions}
              disabled={loadingPositions}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loadingPositions ? "⏳ Loading..." : "🔄 Refresh Positions"}
            </button>
          </div>
        )}

        {/* Loading State */}
        {loadingPositions && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">Loading your positions...</p>
          </div>
        )}

        {/* No Positions */}
        {!loadingPositions && positions.length === 0 && isConnected && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 text-lg mb-4">
              You don&apos;t have any liquidity positions yet
            </p>
            <a
              href="/admin/liquidity"
              className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              💧 Add Liquidity
            </a>
          </div>
        )}

        {/* Positions Grid */}
        {!loadingPositions && positions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {positions.map((position) => {
              const token0Symbol = getTokenSymbol(position.token0);
              const token1Symbol = getTokenSymbol(position.token1);
              const inRange = position.inRange ?? false;
              const isProcessing = selectedPosition === position.tokenId;

              return (
                <div
                  key={position.tokenId.toString()}
                  className="bg-white rounded-lg shadow-md p-6 border-2 border-gray-200 hover:border-blue-300 transition-colors"
                >
                  {/* Header */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {token0Symbol}/{token1Symbol}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Position #{position.tokenId.toString()}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        inRange
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {inRange ? "✅ In Range" : "❌ Out of Range"}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Fee Tier:</span>
                      <span className="font-medium">
                        {getFeeTierLabel(position.fee)}
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Tick Range:</span>
                      <span className="font-mono text-xs">
                        [{position.tickLower}, {position.tickUpper}]
                      </span>
                    </div>

                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Liquidity:</span>
                      <span className="font-medium">
                        {position.liquidity.toString()}
                      </span>
                    </div>

                    {/* Fees Earned */}
                    {(position.tokensOwed0 > BigInt(0) ||
                      position.tokensOwed1 > BigInt(0)) && (
                      <div className="bg-green-50 p-3 rounded-lg mt-4">
                        <p className="text-sm font-semibold text-green-900 mb-2">
                          💰 Fees Earned
                        </p>
                        <div className="space-y-1 text-sm">
                          {position.tokensOwed0 > BigInt(0) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                {token0Symbol}:
                              </span>
                              <span className="font-medium">
                                {formatTokenAmount(position.tokensOwed0)}
                              </span>
                            </div>
                          )}
                          {position.tokensOwed1 > BigInt(0) && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">
                                {token1Symbol}:
                              </span>
                              <span className="font-medium">
                                {formatTokenAmount(position.tokensOwed1)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleCollectFees(position)}
                      disabled={
                        isProcessing ||
                        (position.tokensOwed0 === BigInt(0) &&
                          position.tokensOwed1 === BigInt(0))
                      }
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-semibold"
                    >
                      {isProcessing && actionLoading === "collect"
                        ? "⏳ Collecting..."
                        : "💰 Collect Fees"}
                    </button>

                    <button
                      onClick={() => handleRemoveLiquidity(position)}
                      disabled={isProcessing}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-semibold"
                    >
                      {isProcessing && actionLoading === "remove"
                        ? "⏳ Removing..."
                        : "🗑️ Remove"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
