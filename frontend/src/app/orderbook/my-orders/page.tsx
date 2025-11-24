"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { formatUnits } from "viem";
import toast from "react-hot-toast";
import { 
  useUserOrdersAPI,
} from "@/hooks/orderbook/useOrderBookAPI";
import { 
  usePendingWithdrawal,
  useOrderBookPaused 
} from "@/hooks/orderbook/useOrderBook";
import { 
  useCancelOrder, 
  useWithdraw 
} from "@/hooks/orderbook/useOrderBookActions";
import { useOrderBookTransactionToast } from "@/hooks/orderbook/useOrderBookToasts";

// Helper function to copy to clipboard
const copyToClipboard = (text: string, label: string) => {
  navigator.clipboard.writeText(text);
  toast.success(`${label} copied to clipboard!`);
};

export default function MyOrdersPage() {
  const { address, isConnected } = useAccount();
  const queryClient = useQueryClient();
  // Fetch ALL user orders (no status filter) - API will return all statuses
  const { data: ordersData, isLoading: isLoadingIds } = useUserOrdersAPI(address);
  const { amount: pendingAmount, isLoading: isLoadingWithdrawal } = usePendingWithdrawal(address);
  const { isPaused } = useOrderBookPaused();

  // Extract orders from API response
  // API returns Order[] with all fields: orderId, user, orderType, mwgAmount, bnbAmount, pricePerMWG, filled, remaining, status, createdAt, expiresAt
  const allOrders = ordersData?.orders || [];
  
  // Filter orders by status
  // Status: 0=Active, 1=Filled, 2=Partially Filled, 3=Cancelled, 4=Expired
  const activeOrders = allOrders.filter(order => order.status === '0' || order.status === '2');
  const orderIds = activeOrders.map(order => BigInt(order.orderId));
  
  // Cancel order hook
  const { cancelOrder, isPending: isCancelling, isSuccess: isCancelSuccess, error: cancelError } = useCancelOrder();
  
  // Withdraw hook
  const { withdraw, isPending: isWithdrawing, isSuccess: isWithdrawSuccess, error: withdrawError } = useWithdraw();

  // Show transaction toasts
  useOrderBookTransactionToast(
    isCancelling,
    isCancelSuccess,
    cancelError,
    "Cancelling order",
    "✅ Order cancelled successfully!"
  );

  useOrderBookTransactionToast(
    isWithdrawing,
    isWithdrawSuccess,
    withdrawError,
    "Processing withdrawal",
    "✅ Withdrawal successful!"
  );

  const orderCount = orderIds?.length || 0;

  // Refetch data after successful withdrawal
  useEffect(() => {
    if (isWithdrawSuccess) {
      // Invalidate all orderbook-related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['orderbook'] });
    }
  }, [isWithdrawSuccess, queryClient]);

  // Refetch data after successful cancellation
  useEffect(() => {
    if (isCancelSuccess) {
      // Invalidate all orderbook-related queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ['orderbook'] });
    }
  }, [isCancelSuccess, queryClient]);

  // Handle order cancellation
  const handleCancelOrder = async (orderId: bigint) => {
    if (!confirm("Are you sure you want to cancel this order? This action cannot be undone.")) {
      return;
    }

    try {
      await cancelOrder(orderId);
      // Toast handled by useOrderBookTransactionToast
    } catch {
      // Error handled by useOrderBookTransactionToast
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
      // Toast handled by useOrderBookTransactionToast
    } catch {
      // Error handled by useOrderBookTransactionToast
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
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      {/* Paused Banner */}
      {isPaused && (
        <div className="relative bg-gradient-to-r from-red-500/20 via-red-600/20 to-red-500/20 border-b border-red-500/30 p-4 backdrop-blur-sm">
          <p className="text-center text-red-400 font-medium flex items-center justify-center gap-2">
            <span className="animate-pulse">⚠️</span>
            Order Book is currently paused. Some operations may be disabled.
          </p>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 sm:py-12 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Back Button with enhanced styling */}
          <Link
            href="/orderbook"
            className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 mb-6 transition-all hover:gap-3 group"
          >
            <svg
              className="w-5 h-5 transition-transform group-hover:-translate-x-1"
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
            <span className="font-medium">Back to Order Book</span>
          </Link>

          {/* Enhanced Header with Icon */}
          <div className="mb-8 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="text-3xl">📋</span>
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-purple-600">
                  My Active Orders
                </h1>
                <p className="text-gray-400 mt-1 text-sm sm:text-base">
                  Manage and track your active buy and sell orders
                </p>
              </div>
            </div>
          </div>

          {/* Enhanced Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
            {/* Active Orders Card */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-purple-900/50 to-purple-800/30 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/30 hover:border-purple-400/50 transition-all hover:shadow-xl hover:shadow-purple-500/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full filter blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-purple-300">Active Orders</div>
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <span className="text-xl">📊</span>
                  </div>
                </div>
                <div className="text-3xl font-bold text-white mb-1">{orderCount}</div>
                <div className="text-xs text-purple-300">Currently open</div>
              </div>
            </div>

            {/* Pending Withdrawal Card */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-yellow-900/50 to-yellow-800/30 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/30 hover:border-yellow-400/50 transition-all hover:shadow-xl hover:shadow-yellow-500/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full filter blur-2xl group-hover:bg-yellow-500/20 transition-all"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-yellow-300">Pending Withdrawal</div>
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                    <span className="text-xl">💰</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {isLoadingWithdrawal ? (
                    <div className="animate-pulse h-8 w-32 bg-gray-700 rounded"></div>
                  ) : (
                    `${formatUnits(pendingAmount || BigInt(0), 18)} BNB`
                  )}
                </div>
                <div className="text-xs text-yellow-300">Ready to claim</div>
              </div>
            </div>

            {/* Status Card */}
            <div className="group relative overflow-hidden bg-gradient-to-br from-blue-900/50 to-blue-800/30 backdrop-blur-sm rounded-2xl p-6 border border-blue-500/30 hover:border-blue-400/50 transition-all hover:shadow-xl hover:shadow-blue-500/20">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full filter blur-2xl group-hover:bg-blue-500/20 transition-all"></div>
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-blue-300">Contract Status</div>
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <span className="text-xl">{isPaused ? "⏸️" : "✅"}</span>
                  </div>
                </div>
                <div className="text-2xl font-bold text-white mb-1">
                  {isPaused ? "Paused" : "Active"}
                </div>
                <div className="text-xs text-blue-300">
                  {isPaused ? "Trading disabled" : "All systems operational"}
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Pending Withdrawals Section */}
          {pendingAmount && pendingAmount > BigInt(0) && (
            <div className="relative overflow-hidden bg-gradient-to-r from-green-900/40 via-emerald-900/40 to-green-900/40 border-2 border-green-500/40 rounded-2xl p-6 sm:p-8 mb-8 shadow-xl shadow-green-500/10">
              <div className="absolute inset-0 bg-gradient-to-r from-green-500/5 via-emerald-500/10 to-green-500/5 animate-pulse"></div>
              <div className="relative flex items-center justify-between flex-wrap gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-3xl animate-bounce">💰</span>
                  </div>
                  <div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 flex items-center gap-2">
                      Pending Withdrawal Available
                      <span className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded-full border border-green-500/30">Ready</span>
                    </h3>
                    <p className="text-sm text-gray-300 mb-3">
                      You have unclaimed funds from filled or cancelled orders
                    </p>
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                        {formatUnits(pendingAmount, 18)}
                      </p>
                      <span className="text-xl text-gray-400 font-medium">BNB</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || isPaused}
                  className="group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-8 rounded-xl transition-all disabled:cursor-not-allowed shadow-lg hover:shadow-green-500/50 disabled:shadow-none"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isWithdrawing ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </>
                    ) : (
                      <>
                        <span>Withdraw Funds</span>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                </button>
              </div>
            </div>
          )}

          {/* Enhanced Orders Section with Modern Design */}
          <div className="relative overflow-hidden bg-gradient-to-br from-gray-900/80 to-gray-800/80 backdrop-blur-xl rounded-2xl border border-purple-500/30 shadow-2xl">
            {/* Tab Header */}
            <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-b border-purple-500/30 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                    <span className="text-xl">⚡</span>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Active Orders</h2>
                    <p className="text-sm text-purple-300">{orderCount} orders currently open</p>
                  </div>
                </div>
                {orderCount > 0 && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-800/50 px-3 py-2 rounded-lg border border-gray-700">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span>Real-time updates</span>
                  </div>
                )}
              </div>
            </div>

            {/* Orders Content */}
            <div className="p-6">
              {isLoadingIds ? (
                <div className="text-center py-16">
                  <div className="relative">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/20 border-t-purple-500 mx-auto mb-6"></div>
                    <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-pink-500/20 border-t-pink-500 mx-auto animate-ping"></div>
                  </div>
                  <p className="text-gray-400 text-lg font-medium">Loading your orders...</p>
                  <p className="text-gray-500 text-sm mt-2">Please wait</p>
                </div>
              ) : orderCount === 0 ? (
                <div className="text-center py-16">
                  <div className="relative inline-block mb-6">
                    <div className="text-8xl opacity-20">📋</div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-4xl">✨</div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    No Active Orders
                  </h3>
                  <p className="text-gray-400 mb-8 max-w-md mx-auto">
                    You don&apos;t have any active orders yet. Create your first order to start trading!
                  </p>
                  <Link
                    href="/orderbook/create"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-bold py-4 px-8 rounded-xl transition-all shadow-lg hover:shadow-purple-500/50"
                  >
                    <span className="text-xl">+</span>
                    <span>Create Your First Order</span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Info Banner */}
                  <div className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-blue-300 font-semibold mb-1">Quick Actions Available</p>
                        <p className="text-blue-200/80 text-sm">
                          Copy order IDs to clipboard or cancel orders directly from this page. For detailed order information, visit the main Order Book.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Orders Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {activeOrders.map((order, index: number) => {
                      const orderId = BigInt(order.orderId);
                      const orderIdString = orderId.toString();
                      
                      // Status: 0=Active, 1=Filled, 2=Partially Filled, 3=Cancelled, 4=Expired
                      const getStatusBadge = (status: string) => {
                        if (status === '0') {
                          return (
                            <div className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded-md text-xs text-green-400 font-medium">
                              Active
                            </div>
                          );
                        } else if (status === '2') {
                          return (
                            <div className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-xs text-yellow-400 font-medium flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              Partially Filled
                            </div>
                          );
                        }
                        return null;
                      };
                      
                      return (
                        <div
                          key={`order-${orderIdString}`}
                          className="group relative overflow-hidden bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-5 border border-gray-700 hover:border-purple-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/20"
                        >
                          {/* Animated Background Effect */}
                          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-purple-500/5 to-purple-500/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
                          
                          <div className="relative">
                            {/* Order Number Badge */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
                                  <span className="text-xs font-bold text-purple-400">#{index + 1}</span>
                                </div>
                                <span className="text-xs font-semibold text-gray-400">Order ID</span>
                              </div>
                              {getStatusBadge(order.status)}
                            </div>
                            
                            {/* Order ID */}
                            <div className="mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700">
                              <div className="font-mono text-xs text-purple-300 break-all">
                                {orderIdString}
                              </div>
                            </div>
                            
                            {/* Fill Progress for Partially Filled Orders */}
                            {order.status === '2' && (
                              <div className="mb-4 p-3 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                                <div className="flex items-center justify-between mb-2 text-xs">
                                  <span className="text-yellow-400 font-medium">Fill Progress</span>
                                  <span className="text-yellow-300">
                                    {((parseFloat(order.filled) / parseFloat(order.mwgAmount)) * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-500"
                                    style={{ width: `${(parseFloat(order.filled) / parseFloat(order.mwgAmount)) * 100}%` }}
                                  ></div>
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs">
                                  <span className="text-gray-400">Filled: {parseFloat(order.filled).toFixed(2)} MWG</span>
                                  <span className="text-gray-400">Remaining: {parseFloat(order.remaining).toFixed(2)} MWG</span>
                                </div>
                              </div>
                            )}
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => copyToClipboard(orderIdString, "Order ID")}
                                className="flex-1 group/btn flex items-center justify-center gap-2 bg-purple-600/80 hover:bg-purple-600 text-white text-sm font-medium py-2.5 px-3 rounded-lg transition-all hover:shadow-lg hover:shadow-purple-500/30"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span className="hidden sm:inline">Copy</span>
                              </button>
                              <button
                                onClick={() => handleCancelOrder(orderId)}
                                disabled={isCancelling || isPaused}
                                className="flex-1 group/btn flex items-center justify-center gap-2 bg-red-600/80 hover:bg-red-600 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium py-2.5 px-3 rounded-lg transition-all hover:shadow-lg hover:shadow-red-500/30 disabled:cursor-not-allowed disabled:shadow-none"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                <span className="hidden sm:inline">Cancel</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Quick Actions */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Link
              href="/orderbook/create"
              className="group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-green-500/50 flex items-center justify-center gap-3"
            >
              <span className="text-2xl">+</span>
              <span>Create New Order</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </Link>
            <Link
              href="/orderbook/trades"
              className="group relative overflow-hidden bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg hover:shadow-blue-500/50 flex items-center justify-center gap-3"
            >
              <span className="text-2xl">📊</span>
              <span>View Trade History</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            </Link>
          </div>
        </div>
      </main>

      {/* Custom CSS for animations */}
      <style jsx global>{`
        @keyframes blob {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
