"use client";

import React from "react";
import { formatUnits } from "viem";
import toast from "react-hot-toast";
import { OrderType, ORDER_TYPE_LABELS } from "@/types/orderbook";
import { copyToClipboard } from "@/hooks/orderbook/useOrderBookToasts";

export interface OrderBookDisplayProps {
  buyOrders: Array<{
    orderId: bigint;
    pricePerMWG: bigint;
    remaining: bigint;
  }>;
  sellOrders: Array<{
    orderId: bigint;
    pricePerMWG: bigint;
    remaining: bigint;
  }>;
  bestBuyPrice?: bigint;
  bestSellPrice?: bigint;
  isLoading?: boolean;
  onOrderClick?: (orderId: bigint, type: OrderType) => void;
}

export function OrderBookDisplay({
  buyOrders,
  sellOrders,
  bestBuyPrice,
  bestSellPrice,
  isLoading = false,
  onOrderClick,
}: OrderBookDisplayProps) {
  const spread =
    bestBuyPrice && bestSellPrice
      ? Number(formatUnits(bestSellPrice - bestBuyPrice, 18))
      : 0;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20">
      {/* Header */}
      <div className="p-4 sm:p-6 border-b border-purple-500/20">
        <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
          Order Book
        </h2>
        {bestBuyPrice && bestSellPrice && (
          <div className="flex items-center gap-4 text-sm">
            <div className="text-green-400">
              Best Bid: {formatUnits(bestBuyPrice, 18)} BNB
            </div>
            <div className="text-red-400">
              Best Ask: {formatUnits(bestSellPrice, 18)} BNB
            </div>
            <div className="text-gray-400">
              Spread: {spread.toFixed(8)} BNB
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 sm:p-6">
        {/* Sell Orders (Asks) */}
        <div>
          <h3 className="text-lg font-semibold text-red-400 mb-3">
            Sell Orders (Asks)
          </h3>
          <div className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-10 bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : sellOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No sell orders
              </div>
            ) : (
              sellOrders.slice(0, 10).map((order) => (
                <button
                  key={order.orderId.toString()}
                  onClick={() => onOrderClick?.(order.orderId, OrderType.SELL)}
                  className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg p-3 transition-all text-left"
                >
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-300">
                      Price: {formatUnits(order.pricePerMWG, 18)} BNB
                    </div>
                    <div className="text-sm text-red-400 font-medium">
                      {formatUnits(order.remaining, 18)} MWG
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Buy Orders (Bids) */}
        <div>
          <h3 className="text-lg font-semibold text-green-400 mb-3">
            Buy Orders (Bids)
          </h3>
          <div className="space-y-2">
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-10 bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            ) : buyOrders.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                No buy orders
              </div>
            ) : (
              buyOrders.slice(0, 10).map((order) => (
                <button
                  key={order.orderId.toString()}
                  onClick={() => onOrderClick?.(order.orderId, OrderType.BUY)}
                  className="w-full bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg p-3 transition-all text-left"
                >
                  <div className="flex justify-between items-center">
                    <div className="text-sm text-gray-300">
                      Price: {formatUnits(order.pricePerMWG, 18)} BNB
                    </div>
                    <div className="text-sm text-green-400 font-medium">
                      {formatUnits(order.remaining, 18)} MWG
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
