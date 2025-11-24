"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useOrderBookPaused } from "@/hooks/orderbook/useOrderBook";
import {
  useOrderBookStatsAPI,
  useActiveOrdersAPI,
  useBestPricesAPI,
  useRecentActivityAPI,
} from "@/hooks/orderbook/useOrderBookAPI";
import { OrderBookDisplay } from "@/components/orderbook/OrderBookDisplay";
import { FillOrderModal } from "@/components/orderbook/FillOrderModal";
import { FarmingStatsCard } from "@/components/farming/FarmingStatsCard";
import { formatUnits } from "viem";

import { useOrderBookTransactionToast } from "@/hooks/orderbook/useOrderBookToasts";
import { useFillBuyOrder, useFillSellOrder } from "@/hooks/orderbook/useOrderBookActions";
import type { Order } from "@/types/orderbook";
import { OrderType, OrderStatus } from "@/types/orderbook";

// API Order type from backend
interface APIOrder {
  orderId: string;
  pricePerMWG: string;
  remaining?: string;
  mwgAmount: string;
  user: string;
  status: number | string;
  expiresAt: string;
  bnbAmount: string;
  filled?: string;
}

export default function OrderBookPage() {
  const { isConnected, address } = useAccount();
  const queryClient = useQueryClient();
  
  // Use API hooks instead of blockchain hooks for historical data
  const { isLoading: isLoadingStats } = useOrderBookStatsAPI();
  const { data: bestPricesData } = useBestPricesAPI();
  const { data: buyOrdersData, isLoading: isLoadingBuyOrders } = useActiveOrdersAPI(0, 50);
  const { data: sellOrdersData, isLoading: isLoadingSellOrders } = useActiveOrdersAPI(1, 50);
  const { data: activityData } = useRecentActivityAPI(10);
  
  // Still use blockchain for contract state
  const { isPaused } = useOrderBookPaused();
  
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showFillModal, setShowFillModal] = useState(false);

  // Fill order hooks
  const { fillBuyOrder, isPending: isFillingBuy, isSuccess: isBuyFillSuccess, error: buyFillError } = useFillBuyOrder();
  const { fillSellOrder, isPending: isFillingSell, isSuccess: isSellFillSuccess, error: sellFillError } = useFillSellOrder();

  // Show transaction toasts for fill operations
  useOrderBookTransactionToast(
    isFillingBuy,
    isBuyFillSuccess,
    buyFillError,
    "Filling buy order",
    "✅ Buy order filled successfully!"
  );

  useOrderBookTransactionToast(
    isFillingSell,
    isSellFillSuccess,
    sellFillError,
    "Filling sell order",
    "✅ Sell order filled successfully!"
  );

  // Refetch data after successful fill
  useEffect(() => {
    if (isBuyFillSuccess || isSellFillSuccess) {
      // Invalidate all orderbook queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['orderbook'] });
    }
  }, [isBuyFillSuccess, isSellFillSuccess, queryClient]);

  // Extract data from API responses
  const bestBuy = bestPricesData?.bestBuy?.price ? BigInt(bestPricesData.bestBuy.price) : null;
  const bestSell = bestPricesData?.bestSell?.price ? BigInt(bestPricesData.bestSell.price) : null;
  const recentActivity = useMemo(() => activityData?.activities || [], [activityData?.activities]);
  const isLoadingOrders = isLoadingBuyOrders || isLoadingSellOrders;
  
  // Process orders from API data
  const { buyOrders, sellOrders, activeOrderCount } = useMemo(() => {
    const buys = (buyOrdersData?.orders || []).map((order: APIOrder) => ({
      orderId: BigInt(order.orderId),
      pricePerMWG: BigInt(order.pricePerMWG),
      remaining: BigInt(order.remaining || order.mwgAmount),
      user: order.user as `0x${string}`,
      orderType: OrderType.BUY,
      status: (typeof order.status === 'string' ? parseInt(order.status) : order.status) as OrderStatus,
      expiresAt: BigInt(new Date(order.expiresAt).getTime() / 1000),
      bnbAmount: BigInt(order.bnbAmount),
      mwgAmount: BigInt(order.mwgAmount),
      filled: BigInt(order.filled || 0),
      createdAt: BigInt(Math.floor(new Date(order.expiresAt).getTime() / 1000)),
      feeAtCreation: BigInt(0),
    }));

    const sells = (sellOrdersData?.orders || []).map((order: APIOrder) => ({
      orderId: BigInt(order.orderId),
      pricePerMWG: BigInt(order.pricePerMWG),
      remaining: BigInt(order.remaining || order.mwgAmount),
      user: order.user as `0x${string}`,
      orderType: OrderType.SELL,
      status: (typeof order.status === 'string' ? parseInt(order.status) : order.status) as OrderStatus,
      expiresAt: BigInt(new Date(order.expiresAt).getTime() / 1000),
      bnbAmount: BigInt(order.bnbAmount),
      mwgAmount: BigInt(order.mwgAmount),
      filled: BigInt(order.filled || 0),
      createdAt: BigInt(Math.floor(new Date(order.expiresAt).getTime() / 1000)),
      feeAtCreation: BigInt(0),
    }));

    return {
      buyOrders: buys,
      sellOrders: sells,
      activeOrderCount: buys.length + sells.length
    };
  }, [buyOrdersData, sellOrdersData]);

  // Handle order click - open fill modal
  const handleOrderClick = (orderId: bigint) => {
    // Find the order in our lists
    const allOrders = [...buyOrders, ...sellOrders];
    const order = allOrders.find(o => o.orderId === orderId);
    
    if (order) {
      setSelectedOrder(order);
      setShowFillModal(true);
    }
  };

  // Handle fill order submission
  const handleFillOrder = async (orderId: bigint, mwgAmount: bigint, bnbValue?: bigint) => {
    if (!selectedOrder) return;

    try {
      if (selectedOrder.orderType === OrderType.BUY) {
        // Filling buy order: send MWG, receive BNB
        await fillBuyOrder({ orderId, mwgAmount });
        // Toast handled by useOrderBookTransactionToast
      } else {
        // Filling sell order: send BNB, receive MWG
        if (bnbValue) {
          await fillSellOrder({ orderId, mwgAmount, bnbValue });
          // Toast handled by useOrderBookTransactionToast
        }
      }
      setShowFillModal(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error("Fill order error:", error);
      // Error toast handled by useOrderBookTransactionToast
    }
  };

  // Notify user when new orders are created (from recent activity)
  useEffect(() => {
    if (recentActivity && recentActivity.length > 0) {
      const latestActivity = recentActivity[0];
      if (latestActivity.type === "created" && latestActivity.data && typeof latestActivity.data === "object" && "user" in latestActivity.data) {
        const eventData = latestActivity.data as { user?: string; orderType?: number };
        if (eventData.user?.toLowerCase() !== address?.toLowerCase()) {
          const orderType = eventData.orderType === 0 ? "buy" : "sell";
          toast(`🔔 New ${orderType} order created!`, {
            icon: orderType === "buy" ? "🟢" : "🔴",
            duration: 3000,
          });
        }
      }
    }
  }, [recentActivity, address]);

  const spread =
    bestBuy && bestSell
      ? ((Number(formatUnits(bestSell, 18)) - Number(formatUnits(bestBuy, 18))) /
          Number(formatUnits(bestBuy, 18))) *
        100
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Paused Banner */}
      {isPaused && (
        <div className="bg-red-500/20 border-b border-red-500/30 p-4">
          <p className="text-center text-red-400 font-medium">
            ⚠️ Order Book is currently paused. Trading operations are temporarily disabled.
          </p>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
              MWG Order Book
            </h1>
            <p className="text-gray-400 text-sm sm:text-base">
              Zero slippage trading • Client payments • Transparent pricing
            </p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
            <FarmingStatsCard
              title="Active Orders"
              value={activeOrderCount.toString()}
              icon="⚡"
              isLoading={isLoadingOrders}
            />
            <FarmingStatsCard
              title="Buy Orders"
              value={buyOrders.length.toString()}
              icon="🟢"
              isLoading={isLoadingOrders}
              trend="up"
            />
            <FarmingStatsCard
              title="Sell Orders"
              value={sellOrders.length.toString()}
              icon="🔴"
              isLoading={isLoadingOrders}
              trend="down"
            />
            <FarmingStatsCard
              title="Spread"
              value={spread.toFixed(2)}
              suffix="%"
              icon="📊"
              isLoading={isLoadingStats}
            />
          </div>

          {/* Quick Actions */}
          {isConnected && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Link
                href="/orderbook/create"
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-bold py-4 px-6 rounded-lg transition-all text-center"
              >
                + Create Buy Order
              </Link>
              <Link
                href="/orderbook/my-orders"
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-4 px-6 rounded-lg transition-all text-center"
              >
                My Orders
              </Link>
              <Link
                href="/orderbook/trades"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold py-4 px-6 rounded-lg transition-all text-center"
              >
                Trade History
              </Link>
            </div>
          )}

          {/* Order Book Display */}
          <div className="mb-8">
            <OrderBookDisplay
              buyOrders={buyOrders}
              sellOrders={sellOrders}
              bestBuyPrice={bestBuy || undefined}
              bestSellPrice={bestSell || undefined}
              isLoading={isLoadingOrders}
              onOrderClick={(orderId) => {
                handleOrderClick(orderId);
              }}
              connectedAddress={address}
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
            <h2 className="text-xl font-bold text-white mb-4">Recent Activity</h2>
            {recentActivity.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {activity.type === "created"
                          ? "📝"
                          : activity.type === "filled"
                          ? "✅"
                          : activity.type === "cancelled"
                          ? "❌"
                          : "💰"}
                      </span>
                      <div>
                        <p className="text-white font-medium capitalize">
                          {activity.type}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    {activity.type === "created" && "orderId" in activity && (
                      <span className="text-sm text-gray-300">
                        Order #{activity.orderId}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Connect Wallet CTA */}
          {!isConnected && (
            <div className="mt-8 bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-2">
                Connect Your Wallet
              </h3>
              <p className="text-gray-300 mb-6">
                Connect your wallet to start creating orders and trading MWG tokens
              </p>
            </div>
          )}
        </div>
      </main>

      {/* Fill Order Modal */}
      {selectedOrder && (
        <FillOrderModal
          order={selectedOrder}
          isOpen={showFillModal}
          onClose={() => {
            setShowFillModal(false);
            setSelectedOrder(null);
          }}
          onFill={handleFillOrder}
          isPending={isFillingBuy || isFillingSell}
        />
      )}
    </div>
  );
}
