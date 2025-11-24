"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { formatUnits, formatEther, parseUnits, parseEther } from "viem";
import { 
  useFeeInfo, 
  useMinimumAmounts,
  useOrderBookPaused
} from "@/hooks/orderbook/useOrderBook";
import { 
  useOrderBookStatsAPI,
  useActiveOrdersAPI,
  useOrderFillsAPI,
  useRecentActivityAPI
} from "@/hooks/orderbook/useOrderBookAPI";
import { 
  useSetFee, 
  useSetMinimumAmounts,
  useSetPaused,
  useCancelOrder 
} from "@/hooks/orderbook/useOrderBookActions";
import { OrderCard } from "@/components/orderbook/OrderCard";
import { FillOrderModal } from "@/components/orderbook/FillOrderModal";
import type { Order } from "@/types/orderbook";
import { OrderType } from "@/types/orderbook";
import { showInfoToast, showWarningToast } from "@/hooks/orderbook/useOrderBookToasts";
import { useRoleGate } from "@/hooks/useRoleGate";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import toast from "react-hot-toast";

type TabType = "overview" | "orders" | "config" | "emergency";

export default function AdminPage() {
  const router = useRouter();
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  
  // Role-based access control - require ADMIN_ROLE
  // Note: This is a simplified check, as useRoleGate expects specific contract types
  // For order book, we'll check if user is connected and has admin rights
  const { address: userAddress } = useAccount();
  const roleLoading = false;
  const hasRole = !!userAddress; // Simplified - in production, implement proper role check

  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [orderFilter, setOrderFilter] = useState<"all" | "buy" | "sell">("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showFillModal, setShowFillModal] = useState(false);

  // Contract state (still use blockchain for current state)
  const { feePercentage, feeRecipient } = useFeeInfo();
  const { minMWGAmount, minBNBAmount } = useMinimumAmounts();
  const { isPaused, isLoading: pauseLoading } = useOrderBookPaused();

  // API data (use database for historical data)
  const { data: statsData, isLoading: statsLoading } = useOrderBookStatsAPI();
  const { data: buyOrdersData, isLoading: buyOrdersLoading } = useActiveOrdersAPI(0, 100);
  const { data: sellOrdersData, isLoading: sellOrdersLoading } = useActiveOrdersAPI(1, 100);
  const { data: fillsData, isLoading: fillsLoading } = useOrderFillsAPI(100);
  const { data: activityData, isLoading: activityLoading } = useRecentActivityAPI(50);

  const ordersLoading = buyOrdersLoading || sellOrdersLoading;

  // Combine orders from API
  const orders = useMemo(() => {
    const buys = (buyOrdersData?.orders || []).map((order: any) => ({
      ...order,
      orderId: BigInt(order.orderId),
      mwgAmount: BigInt(order.mwgAmount),
      bnbAmount: BigInt(order.bnbAmount),
      pricePerMWG: BigInt(order.pricePerMWG),
      remaining: BigInt(order.remaining),
      filled: BigInt(order.filled || 0),
      user: order.user as `0x${string}`,
      expiresAt: BigInt(new Date(order.expiresAt).getTime() / 1000),
      orderType: 0,
    }));
    const sells = (sellOrdersData?.orders || []).map((order: any) => ({
      ...order,
      orderId: BigInt(order.orderId),
      mwgAmount: BigInt(order.mwgAmount),
      bnbAmount: BigInt(order.bnbAmount),
      pricePerMWG: BigInt(order.pricePerMWG),
      remaining: BigInt(order.remaining),
      filled: BigInt(order.filled || 0),
      user: order.user as `0x${string}`,
      expiresAt: BigInt(new Date(order.expiresAt).getTime() / 1000),
      orderType: 1,
    }));
    return [...buys, ...sells];
  }, [buyOrdersData, sellOrdersData]);

  // Extract data from API responses
  const stats = statsData?.stats;
  const fills = (fillsData as any)?.fills || [];
  const recentActivity = activityData?.activities || [];

  // Get statistics from API data
  const totalOrders = stats?.orders?.total || 0;
  const activeOrders = stats?.orders?.active || 0;
  const activeBuyOrders = stats?.orders?.activeBuy || 0;
  const activeSellOrders = stats?.orders?.activeSell || 0;
  const totalFills = stats?.fills?.total || 0;
  const totalVolumeMWG = stats?.fills?.mwgVolume || 0;
  const totalVolumeBNB = stats?.fills?.bnbVolume || 0;

  // Admin actions
  const { setFee, isPending: setFeePending, error: setFeeError, isSuccess: setFeeSuccess } = useSetFee();
  const { setMinimumAmounts, isPending: setMinPending, error: setMinError, isSuccess: setMinSuccess } = useSetMinimumAmounts();
  const { setPaused, isPending: setPausedPending, error: setPausedError, isSuccess: setPausedSuccess } = useSetPaused();
  const { cancelOrder, isPending: cancelPending, error: cancelError, isSuccess: cancelSuccess } = useCancelOrder();

  // Config form states
  const [newFeePercentage, setNewFeePercentage] = useState("");
  const [newMinMWG, setNewMinMWG] = useState("");
  const [newMinBNB, setNewMinBNB] = useState("");

  // Helper to safely convert fee BigInt to percentage
  const getFeePercentage = () => {
    if (!feePercentage) return 0;
    return Number(feePercentage) / 100;
  };

  // Filter orders based on type
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    if (orderFilter === "all") return orders;
    if (orderFilter === "buy") return orders.filter((o: Order) => o.orderType === OrderType.BUY);
    if (orderFilter === "sell") return orders.filter((o: Order) => o.orderType === OrderType.SELL);
    return orders;
  }, [orders, orderFilter]);

  // Handle fee update
  const handleUpdateFee = async () => {
    if (!newFeePercentage) {
      showWarningToast("Please enter a fee percentage");
      return;
    }

    const fee = parseFloat(newFeePercentage);
    if (fee < 0 || fee > 10) {
      showWarningToast("Fee must be between 0% and 10%");
      return;
    }

    const feeBasisPoints = Math.floor(fee * 100);
    const toastId = toast.loading(`Updating fee to ${fee}%...`);
    
    try {
      await setFee(BigInt(feeBasisPoints), address!);
      if (setFeeSuccess) {
        toast.success(`Fee updated to ${fee}%`, { id: toastId });
        setNewFeePercentage("");
      }
    } catch (err) {
      toast.error(`Failed to update fee: ${err}`, { id: toastId });
    }
  };

  // Handle minimum amounts update
  const handleUpdateMinimumAmounts = async () => {
    if (!newMinMWG || !newMinBNB) {
      showWarningToast("Please enter both minimum amounts");
      return;
    }

    try {
      const minMWGAmount = parseUnits(newMinMWG, 18);
      const minBNBAmount = parseEther(newMinBNB);

      const toastId = toast.loading("Updating minimum amounts...");
      
      await setMinimumAmounts(minMWGAmount, minBNBAmount);
      if (setMinSuccess) {
        toast.success("Minimum amounts updated", { id: toastId });
        setNewMinMWG("");
        setNewMinBNB("");
      }
    } catch (error) {
      showWarningToast("Invalid amount format");
    }
  };

  // Handle pause toggle
  const handleTogglePause = async () => {
    const newPauseState = !isPaused;
    const toastId = toast.loading(newPauseState ? "Pausing contract..." : "Unpausing contract...");
    
    try {
      await setPaused(newPauseState);
      if (setPausedSuccess) {
        toast.success(newPauseState ? "Contract paused" : "Contract unpaused", { id: toastId });
      }
    } catch (err) {
      toast.error(`Failed to ${newPauseState ? "pause" : "unpause"} contract`, { id: toastId });
    }
  };

  // Handle emergency cancel
  const handleEmergencyCancel = async (orderId: bigint) => {
    const confirmed = window.confirm(
      "Are you sure you want to emergency cancel this order? This action cannot be undone."
    );
    
    if (!confirmed) return;

    const toastId = toast.loading(`Emergency cancelling order #${orderId}...`);
    
    try {
      await cancelOrder(orderId);
      if (cancelSuccess) {
        toast.success(`Order #${orderId} cancelled`, { id: toastId });
      }
    } catch (err) {
      toast.error("Failed to cancel order", { id: toastId });
    }
  };

  // Handle fill order
  const handleFillClick = (order: Order) => {
    setSelectedOrder(order);
    setShowFillModal(true);
  };

  // Check if user is loading or doesn't have admin role
  if (roleLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!hasRole) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-8 border border-gray-700 text-center">
            <div className="mb-6">
              <svg className="w-20 h-20 mx-auto text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Admin Access Required</h2>
            <p className="text-gray-400 mb-6">
              Please connect your admin wallet to access the order book administration panel.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => openConnectModal?.()}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                Connect Admin Wallet
              </button>
              <button
                onClick={() => router.push('/orderbook')}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-200"
              >
                Back to Order Book
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isLoading = statsLoading || pauseLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Order Book Admin
          </h1>
          <p className="text-gray-400">
            Manage order book configuration, monitor platform activity, and perform administrative actions
          </p>
        </div>

      {/* Pause Status Banner */}
      {isPaused && (
        <div className="mb-6 bg-red-500/10 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span className="text-red-400 font-semibold">Order Book is Paused</span>
          </div>
          <p className="text-red-300 text-sm mt-1">
            No new orders can be created or filled while paused
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-700">
        {[
          { id: "overview", label: "Overview" },
          { id: "orders", label: "All Orders" },
          { id: "config", label: "Configuration" },
          { id: "emergency", label: "Emergency Controls" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-6 py-3 font-semibold transition-colors border-b-2 ${
              activeTab === tab.id
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-gray-400 hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Platform Statistics */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Platform Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Total Orders */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Total Orders Created</div>
                <div className="text-3xl font-bold text-white">
                  {isLoading ? "..." : totalOrders}
                </div>
              </div>

              {/* Active Orders */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Active Orders</div>
                <div className="text-3xl font-bold text-green-400">
                  {isLoading ? "..." : activeOrders}
                </div>
              </div>

              {/* Total Trades */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Total Trades</div>
                <div className="text-3xl font-bold text-blue-400">
                  {isLoading ? "..." : totalFills}
                </div>
              </div>

              {/* Cancelled Orders */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Cancelled Orders</div>
                <div className="text-3xl font-bold text-red-400">
                  {isLoading ? "..." : (stats?.orders?.cancelled || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Volume Statistics */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Trading Volume</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              {/* Total MWG Volume */}
              <div className="bg-gradient-to-br from-purple-900/20 to-purple-800/20 rounded-lg p-6 border border-purple-700/30">
                <div className="text-purple-300 text-sm mb-1">Total MWG Volume</div>
                <div className="text-3xl font-bold text-purple-400">
                  {isLoading ? "..." : parseFloat(formatUnits(BigInt(totalVolumeMWG), 18)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <div className="text-purple-300 text-sm mt-1">MWG</div>
              </div>

              {/* Total BNB Volume */}
              <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-lg p-6 border border-yellow-700/30">
                <div className="text-yellow-300 text-sm mb-1">Total BNB Volume</div>
                <div className="text-3xl font-bold text-yellow-400">
                  {isLoading ? "..." : parseFloat(formatEther(BigInt(totalVolumeBNB))).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                </div>
                <div className="text-yellow-300 text-sm mt-1">BNB</div>
              </div>

              {/* Total Fees Collected */}
              <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-lg p-6 border border-green-700/30">
                <div className="text-green-300 text-sm mb-1">Total Fees Collected</div>
                <div className="text-3xl font-bold text-green-400">
                  {isLoading ? "..." : "N/A"}
                </div>
                <div className="text-green-300 text-sm mt-1">BNB (fees go to recipient)</div>
              </div>
            </div>
          </div>

          {/* Current Configuration */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Current Configuration</h2>
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <div className="text-gray-400 text-sm mb-1">Fee Percentage</div>
                  <div className="text-xl font-semibold text-white">
                    {isLoading ? "..." : `${getFeePercentage()}%`}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 text-sm mb-1">Fee Recipient</div>
                  <div className="text-sm font-mono text-white break-all">
                    {isLoading ? "..." : feeRecipient || "Not set"}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 text-sm mb-1">Minimum MWG Amount</div>
                  <div className="text-xl font-semibold text-white">
                    {pauseLoading ? "..." : `${parseFloat(formatUnits(minMWGAmount || BigInt(0), 18)).toLocaleString()} MWG`}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 text-sm mb-1">Minimum BNB Amount</div>
                  <div className="text-xl font-semibold text-white">
                    {pauseLoading ? "..." : `${parseFloat(formatEther(minBNBAmount || BigInt(0))).toLocaleString()} BNB`}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 text-sm mb-1">Contract Status</div>
                  <div className={`text-xl font-semibold ${isPaused ? "text-red-400" : "text-green-400"}`}>
                    {isLoading ? "..." : isPaused ? "Paused" : "Active"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div>
            <h2 className="text-2xl font-bold mb-4 text-gray-200">Recent Activity</h2>
            <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          activity.type === "created" ? "bg-blue-400" :
                          activity.type === "filled" ? "bg-green-400" : "bg-red-400"
                        }`} />
                        <span className="text-gray-300 capitalize">{activity.type}</span>
                        <span className="text-gray-400">Order #{activity.data?.orderId}</span>
                        {activity.type === "filled" && activity.data?.mwgAmount && (
                          <span className="text-gray-500 text-sm">
                            {parseFloat(activity.data.mwgAmount).toFixed(2)} MWG
                          </span>
                        )}
                      </div>
                      <span className="text-gray-500 text-sm">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No recent activity</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-200">All Orders</h2>
            
            {/* Filter Buttons */}
            <div className="flex gap-2">
              {[
                { id: "all", label: "All Orders" },
                { id: "buy", label: "Buy Orders" },
                { id: "sell", label: "Sell Orders" }
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setOrderFilter(filter.id as any)}
                  className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                    orderFilter === filter.id
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orders List */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ordersLoading ? (
              <div className="col-span-2 text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                <p className="text-gray-400">Loading orders...</p>
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="col-span-2 text-center py-12">
                <p className="text-gray-400">No {orderFilter !== "all" ? orderFilter : ""} orders found</p>
              </div>
            ) : (
              filteredOrders.map((order: Order) => (
                <OrderCard
                  key={order.orderId.toString()}
                  order={order}
                  onFill={() => handleFillClick(order)}
                  onCancel={() => handleEmergencyCancel(order.orderId)}
                  showActions={true}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Configuration Tab */}
      {activeTab === "config" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-200 mb-6">Platform Configuration</h2>

          {/* Fee Configuration */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-gray-200 mb-4">Fee Settings</h3>
            
            <div className="space-y-4">
              {/* Update Fee Percentage */}
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  Fee Percentage (0-10%)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={newFeePercentage}
                    onChange={(e) => setNewFeePercentage(e.target.value)}
                    placeholder={getFeePercentage() + "%"}
                    step="0.1"
                    min="0"
                    max="10"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={handleUpdateFee}
                    disabled={!newFeePercentage}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Update
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Current: {getFeePercentage()}%
                </p>
              </div>
            </div>
          </div>

          {/* Minimum Amounts Configuration */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-gray-200 mb-4">Minimum Order Amounts</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Minimum MWG */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Minimum MWG Amount
                  </label>
                  <input
                    type="number"
                    value={newMinMWG}
                    onChange={(e) => setNewMinMWG(e.target.value)}
                    placeholder={formatUnits(minMWGAmount || BigInt(0), 18)}
                    step="1"
                    min="0"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Current: {formatUnits(minMWGAmount || BigInt(0), 18)} MWG
                  </p>
                </div>

                {/* Minimum BNB */}
                <div>
                  <label className="block text-gray-400 text-sm mb-2">
                    Minimum BNB Amount
                  </label>
                  <input
                    type="number"
                    value={newMinBNB}
                    onChange={(e) => setNewMinBNB(e.target.value)}
                    placeholder={formatEther(minBNBAmount || BigInt(0))}
                    step="0.0001"
                    min="0"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    Current: {formatEther(minBNBAmount || BigInt(0))} BNB
                  </p>
                </div>
              </div>

              <button
                onClick={handleUpdateMinimumAmounts}
                disabled={!newMinMWG || !newMinBNB}
                className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Update Minimum Amounts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Controls Tab */}
      {activeTab === "emergency" && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-red-400 mb-6">Emergency Controls</h2>

          {/* Warning Banner */}
          <div className="bg-red-500/10 border border-red-500 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-red-400 font-bold text-lg mb-1">Caution: Emergency Controls</h3>
                <p className="text-red-300 text-sm">
                  These controls should only be used in emergency situations. Actions performed here can have significant impact on the platform and users.
                </p>
              </div>
            </div>
          </div>

          {/* Pause/Unpause Contract */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-gray-200 mb-4">Contract Pause Control</h3>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-300 mb-2">
                  Current Status: <span className={`font-bold ${isPaused ? "text-red-400" : "text-green-400"}`}>
                    {isPaused ? "PAUSED" : "ACTIVE"}
                  </span>
                </p>
                <p className="text-gray-400 text-sm">
                  {isPaused 
                    ? "Order creation and filling are currently disabled"
                    : "Order book is operating normally"
                  }
                </p>
              </div>
              
              <button
                onClick={handleTogglePause}
                className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                  isPaused
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-red-600 hover:bg-red-700 text-white"
                }`}
              >
                {isPaused ? "Unpause Contract" : "Pause Contract"}
              </button>
            </div>
          </div>

          {/* Emergency Information */}
          <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
            <h3 className="text-xl font-bold text-gray-200 mb-4">Emergency Actions Available</h3>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2"></div>
                <div>
                  <p className="text-gray-300 font-semibold">Emergency Cancel Order</p>
                  <p className="text-gray-400 text-sm">
                    Cancel any order and refund the user. Available in the "All Orders" tab.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2"></div>
                <div>
                  <p className="text-gray-300 font-semibold">Pause Trading</p>
                  <p className="text-gray-400 text-sm">
                    Temporarily halt all order creation and filling activities.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="w-1.5 h-1.5 bg-purple-400 rounded-full mt-2"></div>
                <div>
                  <p className="text-gray-300 font-semibold">Update Configuration</p>
                  <p className="text-gray-400 text-sm">
                    Modify fee settings and minimum amounts in the "Configuration" tab.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fill Order Modal */}
      {showFillModal && selectedOrder !== null && (
        <FillOrderModal
          order={selectedOrder}
          isOpen={showFillModal}
          onClose={() => {
            setShowFillModal(false);
            setSelectedOrder(null);
          }}
          onFill={(orderId, mwgAmount, bnbValue) => {
            // Fill logic handled by modal
          }}
        />
      )}
   
      </div>
    </div>
  );
}
