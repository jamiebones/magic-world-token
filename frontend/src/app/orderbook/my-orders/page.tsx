"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { formatUnits } from "viem";
import toast from "react-hot-toast";
import { 
  useUserOrders, 
  usePendingWithdrawal,
  useOrderBookPaused 
} from "@/hooks/orderbook/useOrderBook";
import { 
  useCancelOrder, 
  useWithdraw 
} from "@/hooks/orderbook/useOrderBookActions";

// Helper function to copy to clipboard
const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard!`);
};

export default function MyOrdersPage() {
  const { address, isConnected } = useAccount();
  const { orderIds: rawOrderIds, isLoading: isLoadingIds } = useUserOrders(address);
  const { amount: pendingAmount, isLoading: isLoadingWithdrawal } = usePendingWithdrawal(address);
  const { isPaused } = useOrderBookPaused();

  // The hook returns full order objects, not just IDs - extract the orderId from each
  const orderIds = Array.isArray(rawOrderIds) 
    ? rawOrderIds.map((item: any) => item?.orderId || item).filter(Boolean)
    : [];

  // Cancel order hook
  const { cancelOrder, isPending: isCancelling } = useCancelOrder();
  
  // Withdraw hook
  const { withdraw, isPending: isWithdrawing } = useWithdraw();

  const orderCount = orderIds?.length || 0;

  // Handle order cancellation
  const handleCancelOrder = async (orderId: bigint) => {
    if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
      return;
    }

    try {
      await cancelOrder(orderId);
      toast.success("✅ Order cancelled successfully!");
    } catch (error) {
      toast.error("Failed to cancel order");
    }
  };

  // Handle withdrawal
  const handleWithdraw = async () => {
    if (!pendingAmount || pendingAmount === BigInt(0)) {
      toast.error("No funds available to withdraw");
      return;
    }

    if (!confirm(`Withdraw ${formatUnits(pendingAmount, 18)} BNB?`)) {
      return;
    }

    try {
      await withdraw();
      toast.success("✅ Withdrawal successful!");
    } catch (error) {
      toast.error("Withdrawal failed");
    }
  };

  // Redirect if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md bg-gray-800/50 backdrop-blur-sm rounded-2xl p-12 border border-purple-500/20">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Wallet Not Connected
          </h2>
          <p className="text-gray-400 mb-6">
            Please connect your wallet to view your orders
          </p>
          <Link
            href="/orderbook"
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-all"
          >
            Go to Order Book
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Paused Banner */}
      {isPaused && (
        <div className="bg-red-500/20 border-b border-red-500/30 p-4">
          <p className="text-center text-red-400 font-medium">
            ⚠️ Order Book is currently paused. Some operations may be disabled.
          </p>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <Link
            href="/orderbook"
            className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Order Book
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              My Orders
            </h1>
            <p className="text-gray-400">
              Manage your buy and sell orders
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-purple-500/20">
              <div className="text-sm text-gray-400 mb-1">Total Orders</div>
              <div className="text-2xl font-bold text-white">{orderCount}</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-yellow-500/20">
              <div className="text-sm text-gray-400 mb-1">Pending Withdrawal</div>
              <div className="text-2xl font-bold text-yellow-400">
                {isLoadingWithdrawal ? "..." : `${formatUnits(pendingAmount || BigInt(0), 18)} BNB`}
              </div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-blue-500/20">
              <div className="text-sm text-gray-400 mb-1">Status</div>
              <div className="text-sm text-blue-400">
                {isPaused ? "⏸️ Paused" : "✅ Active"}
              </div>
            </div>
          </div>

          {/* Pending Withdrawals Section */}
          {pendingAmount && pendingAmount > BigInt(0) && (
            <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl p-6 mb-8">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">
                    💰 Pending Withdrawal Available
                  </h3>
                  <p className="text-sm text-gray-400 mb-2">
                    You have unclaimed funds from filled or cancelled orders
                  </p>
                  <p className="text-2xl font-bold text-green-400">
                    {formatUnits(pendingAmount, 18)} BNB
                  </p>
                </div>
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || isPaused}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-3 px-6 rounded-lg transition-all disabled:cursor-not-allowed"
                >
                  {isWithdrawing ? "Processing..." : "Withdraw Funds"}
                </button>
              </div>
            </div>
          )}

          {/* Tabs - Simplified for order IDs view */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-t-xl border border-b-0 border-purple-500/20">
            <div className="flex flex-wrap gap-2 p-4">
              <div className="px-4 py-2 bg-purple-600 text-white rounded-lg font-medium">
                All Orders ({orderCount})
              </div>
            </div>
          </div>

          {/* Orders List - Show Order IDs */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-b-xl border border-purple-500/20 p-6">
            {isLoadingIds ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading your orders...</p>
              </div>
            ) : orderCount === 0 ? (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📋</div>
                <h3 className="text-xl font-semibold text-white mb-2">
                  No orders found
                </h3>
                <p className="text-gray-400 mb-6">
                  You don't have any orders yet. Create one to get started!
                </p>
                <Link
                  href="/orderbook/create"
                  className="inline-block bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg transition-all"
                >
                  Create Buy Order
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div>
                      <p className="text-blue-300 font-medium mb-1">Order Details View</p>
                      <p className="text-blue-200 text-sm">
                        Your order IDs are listed below. To view full order details, please visit the main Order Book page or use the contract directly.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {orderIds.map((orderId, index) => {
                    const orderIdString = orderId.toString();
                    
                    return (
                      <div
                        key={`order-${orderIdString}`}
                        className="bg-gray-700/50 rounded-lg p-4 border border-gray-600 hover:border-purple-500/50 transition-colors"
                      >
                        <div className="text-xs text-gray-400 mb-1">Order #{index + 1}</div>
                        <div className="font-mono text-sm text-white mb-2 break-all">
                          ID: {orderIdString}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => copyToClipboard(orderIdString, "Order ID")}
                            className="flex-1 text-xs bg-purple-600 hover:bg-purple-700 text-white py-1 px-2 rounded transition-colors"
                          >
                            Copy ID
                          </button>
                          <button
                            onClick={() => handleCancelOrder(orderId)}
                            disabled={isCancelling || isPaused}
                            className="flex-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white py-1 px-2 rounded transition-colors disabled:cursor-not-allowed"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/orderbook/create"
              className="flex-1 min-w-[200px] bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-all text-center"
            >
              Create New Order
            </Link>
            <Link
              href="/orderbook/trades"
              className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-all text-center"
            >
              View Trade History
            </Link>
          </div>
        </div>
      </main>

    </div>
  );
}
