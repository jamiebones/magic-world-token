"use client";

import React from "react";
import { formatUnits } from "viem";
import toast from "react-hot-toast";
import type { Order } from "@/types/orderbook";
import { ORDER_TYPE_LABELS, ORDER_STATUS_LABELS } from "@/types/orderbook";

export interface OrderCardProps {
  order: Order;
  onCancel?: (orderId: bigint) => void;
  onFill?: (orderId: bigint) => void;
  showActions?: boolean;
  isPending?: boolean;
}

export function OrderCard({
  order,
  onCancel,
  onFill,
  showActions = true,
  isPending = false,
}: OrderCardProps) {
  const isExpired = BigInt(Math.floor(Date.now() / 1000)) > order.expiresAt;
  const filledPercentage = order.mwgAmount > BigInt(0)
    ? Number((order.filled * BigInt(100)) / order.mwgAmount)
    : 0;

  const typeColor = order.orderType === 0 ? "green" : "red";
  const statusColor =
    order.status === 0 ? "blue" : order.status === 1 ? "green" : order.status === 2 ? "yellow" : "gray";

  return (
    <div className={`bg-gray-800/50 backdrop-blur-sm rounded-xl border border-${typeColor}-500/20 p-4 sm:p-6`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-semibold px-2 py-1 rounded bg-${typeColor}-500/20 text-${typeColor}-400`}>
              {ORDER_TYPE_LABELS[order.orderType]}
            </span>
            <span className={`text-xs px-2 py-1 rounded bg-${statusColor}-500/20 text-${statusColor}-400`}>
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-xs text-gray-400">
            Order #{order.orderId.toString()}
          </p>
        </div>
        {isExpired && order.status === 0 && (
          <span className="text-xs bg-orange-500/20 text-orange-400 px-2 py-1 rounded">
            Expired
          </span>
        )}
      </div>

      {/* Order Details */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">MWG Amount:</span>
          <span className="text-white font-medium">{formatUnits(order.mwgAmount, 18)} MWG</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Price per MWG:</span>
          <span className="text-white font-medium">{formatUnits(order.pricePerMWG, 18)} BNB</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Value:</span>
          <span className="text-white font-medium">{formatUnits(order.bnbAmount, 18)} BNB</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Filled:</span>
          <span className="text-white font-medium">
            {formatUnits(order.filled, 18)} MWG ({filledPercentage.toFixed(1)}%)
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Remaining:</span>
          <span className={`font-medium text-${typeColor}-400`}>
            {formatUnits(order.remaining, 18)} MWG
          </span>
        </div>

        {/* Progress Bar */}
        {order.filled > BigInt(0) && (
          <div className="pt-2">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className={`bg-${typeColor}-500 h-2 rounded-full transition-all`}
                style={{ width: `${filledPercentage}%` }}
              ></div>
            </div>
          </div>
        )}

        <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
          <span className="text-gray-400">Expires:</span>
          <span className="text-white text-xs">
            {new Date(Number(order.expiresAt) * 1000).toLocaleString()}
          </span>
        </div>
      </div>

      {/* Actions */}
      {showActions && order.status === 0 && order.remaining > BigInt(0) && (
        <div className="flex gap-2 mt-4">
          {onFill && !isExpired && (
            <button
              onClick={() => onFill(order.orderId)}
              disabled={isPending}
              className={`flex-1 bg-${typeColor}-600 hover:bg-${typeColor}-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-all disabled:cursor-not-allowed text-sm`}
            >
              {isPending ? "Processing..." : "Fill Order"}
            </button>
          )}
          {onCancel && (
            <button
              onClick={() => onCancel(order.orderId)}
              disabled={isPending}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium py-2 px-4 rounded-lg transition-all disabled:cursor-not-allowed text-sm"
            >
              {isPending ? "Processing..." : "Cancel"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
