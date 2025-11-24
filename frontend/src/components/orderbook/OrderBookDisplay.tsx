"use client";

import React from "react";
import { formatUnits } from "viem";
import toast from "react-hot-toast";
import { OrderType } from "@/types/orderbook";

export interface OrderBookDisplayProps {
  buyOrders: Array<{
    orderId: bigint;
    pricePerMWG: bigint;
    remaining: bigint;
    user?: `0x${string}`;
  }>;
  sellOrders: Array<{
    orderId: bigint;
    pricePerMWG: bigint;
    remaining: bigint;
    user?: `0x${string}`;
  }>;
  bestBuyPrice?: bigint;
  bestSellPrice?: bigint;
  isLoading?: boolean;
  onOrderClick?: (orderId: bigint, type: OrderType) => void;
  connectedAddress?: `0x${string}`;
}

export function OrderBookDisplay({
  buyOrders,
  sellOrders,
  bestBuyPrice,
  bestSellPrice,
  isLoading = false,
  onOrderClick,
  connectedAddress,
}: OrderBookDisplayProps) {
  const spread =
    bestBuyPrice && bestSellPrice
      ? Number(formatUnits(bestSellPrice - bestBuyPrice, 18))
      : 0;

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl border border-purple-500/30 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-purple-500/30 bg-gradient-to-r from-purple-900/20 to-blue-900/20">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
              <span className="text-xl">📊</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Order Book
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-xs text-gray-400">Live</span>
          </div>
        </div>
        {bestBuyPrice && bestSellPrice && (
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
            <div className="flex items-center gap-2 bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-500/20">
              <span className="text-green-400 font-semibold">Best Bid:</span>
              <span className="text-white font-mono">{formatUnits(bestBuyPrice, 18)}</span>
              <span className="text-gray-400 text-xs">BNB</span>
            </div>
            <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-lg border border-red-500/20">
              <span className="text-red-400 font-semibold">Best Ask:</span>
              <span className="text-white font-mono">{formatUnits(bestSellPrice, 18)}</span>
              <span className="text-gray-400 text-xs">BNB</span>
            </div>
            <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1.5 rounded-lg border border-purple-500/20">
              <span className="text-purple-400 font-semibold">Spread:</span>
              <span className="text-white font-mono">{spread.toFixed(8)}</span>
              <span className="text-gray-400 text-xs">BNB</span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
        {/* Sell Orders (Asks) - Left Side */}
        <div className="p-4 sm:p-6 border-r border-purple-500/20">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🔴</span>
            <h3 className="text-lg font-bold text-red-400">
              Sell Orders
            </h3>
            <span className="ml-auto text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
              {sellOrders.length} orders
            </span>
          </div>
          
          {/* Table Header */}
          <div className="grid grid-cols-3 gap-2 px-3 py-2 mb-2 text-xs font-semibold text-gray-400 border-b border-gray-700">
            <div>Price (BNB)</div>
            <div className="text-right">Amount (MWG)</div>
            <div className="text-right">Total (BNB)</div>
          </div>

          <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-700/30 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : sellOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-sm">No sell orders available</div>
              </div>
            ) : (
              sellOrders.slice(0, 15).map((order) => {
                const price = formatUnits(order.pricePerMWG, 18);
                const amount = formatUnits(order.remaining, 18);
                const total = (Number(price) * Number(amount)).toFixed(6);
                const isOwnOrder = connectedAddress && order.user && order.user.toLowerCase() === connectedAddress.toLowerCase();
                
                return (
                  <button
                    key={order.orderId.toString()}
                    onClick={() => {
                      if (isOwnOrder) {
                        toast.error("❌ You cannot fill your own order");
                        return;
                      }
                      onOrderClick?.(order.orderId, OrderType.SELL);
                    }}
                    disabled={isOwnOrder}
                    className={`w-full group relative overflow-hidden rounded-lg p-3 transition-all duration-200 ${
                      isOwnOrder
                        ? "bg-gray-800/50 border border-gray-700/50 cursor-not-allowed opacity-50"
                        : "bg-gradient-to-r from-red-500/5 to-transparent hover:from-red-500/15 border border-red-500/20 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10"
                    }`}
                    title={isOwnOrder ? "You cannot fill your own order" : ""}
                  >
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className={`font-mono font-semibold ${
                        isOwnOrder ? "text-gray-500" : "text-red-400"
                      }`}>
                        {Number(price).toFixed(8)}
                      </div>
                      <div className={`text-right font-mono ${
                        isOwnOrder ? "text-gray-600" : "text-white"
                      }`}>
                        {Number(amount).toFixed(2)}
                      </div>
                      <div className={`text-right font-mono text-xs ${
                        isOwnOrder ? "text-gray-600" : "text-gray-400"
                      }`}>
                        {total}
                      </div>
                    </div>
                    {isOwnOrder && (
                      <div className="absolute top-1 right-1">
                        <span className="text-xs bg-gray-700/80 text-gray-400 px-2 py-0.5 rounded-full border border-gray-600">
                          Your Order
                        </span>
                      </div>
                    )}
                    {!isOwnOrder && (
                      <div className="absolute inset-0 bg-gradient-to-r from-red-500/0 via-red-500/5 to-red-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Buy Orders (Bids) - Right Side */}
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">🟢</span>
            <h3 className="text-lg font-bold text-green-400">
              Buy Orders
            </h3>
            <span className="ml-auto text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
              {buyOrders.length} orders
            </span>
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-3 gap-2 px-3 py-2 mb-2 text-xs font-semibold text-gray-400 border-b border-gray-700">
            <div>Price (BNB)</div>
            <div className="text-right">Amount (MWG)</div>
            <div className="text-right">Total (BNB)</div>
          </div>

          <div className="space-y-1.5 max-h-[400px] overflow-y-auto custom-scrollbar">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-12 bg-gray-700/30 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : buyOrders.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📭</div>
                <div className="text-sm">No buy orders available</div>
              </div>
            ) : (
              buyOrders.slice(0, 15).map((order) => {
                const price = formatUnits(order.pricePerMWG, 18);
                const amount = formatUnits(order.remaining, 18);
                const total = (Number(price) * Number(amount)).toFixed(6);
                const isOwnOrder = connectedAddress && order.user && order.user.toLowerCase() === connectedAddress.toLowerCase();
                
                return (
                  <button
                    key={order.orderId.toString()}
                    onClick={() => {
                      if (isOwnOrder) {
                        toast.error("❌ You cannot fill your own order");
                        return;
                      }
                      onOrderClick?.(order.orderId, OrderType.BUY);
                    }}
                    disabled={isOwnOrder}
                    className={`w-full group relative overflow-hidden rounded-lg p-3 transition-all duration-200 ${
                      isOwnOrder
                        ? "bg-gray-800/50 border border-gray-700/50 cursor-not-allowed opacity-50"
                        : "bg-gradient-to-r from-green-500/5 to-transparent hover:from-green-500/15 border border-green-500/20 hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/10"
                    }`}
                    title={isOwnOrder ? "You cannot fill your own order" : ""}
                  >
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className={`font-mono font-semibold ${
                        isOwnOrder ? "text-gray-500" : "text-green-400"
                      }`}>
                        {Number(price).toFixed(8)}
                      </div>
                      <div className={`text-right font-mono ${
                        isOwnOrder ? "text-gray-600" : "text-white"
                      }`}>
                        {Number(amount).toFixed(2)}
                      </div>
                      <div className={`text-right font-mono text-xs ${
                        isOwnOrder ? "text-gray-600" : "text-gray-400"
                      }`}>
                        {total}
                      </div>
                    </div>
                    {isOwnOrder && (
                      <div className="absolute top-1 right-1">
                        <span className="text-xs bg-gray-700/80 text-gray-400 px-2 py-0.5 rounded-full border border-gray-600">
                          Your Order
                        </span>
                      </div>
                    )}
                    {!isOwnOrder && (
                      <div className="absolute inset-0 bg-gradient-to-r from-green-500/0 via-green-500/5 to-green-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(75, 85, 99, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(147, 51, 234, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(147, 51, 234, 0.7);
        }
      `}</style>
    </div>
  );
}
