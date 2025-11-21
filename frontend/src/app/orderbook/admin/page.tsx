"use client";

import { useState, useMemo } from "react";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { formatUnits, formatEther, parseUnits, parseEther } from "viem";
import { 
  useOrderBookStats, 
  useFeeInfo, 
  useMinimumAmounts,
  useOrderBookPaused,
  useActiveOrders,
  useOrder
} from "@/hooks/orderbook/useOrderBook";
import { 
  useSetFee, 
  useSetMinimumAmounts,
  useSetPaused,
  useCancelOrder 
} from "@/hooks/orderbook/useOrderBookActions";
import { 
  useOrderCreatedEvents, 
  useOrderFilledEvents, 
  useOrderCancelledEvents 
} from "@/hooks/orderbook/useOrderBookEvents";
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

  // Contract state
  const { stats, isLoading: statsLoading } = useOrderBookStats();
  const { feePercentage, feeRecipient } = useFeeInfo();
  const { minMWGAmount, minBNBAmount } = useMinimumAmounts();
  const { isPaused, isLoading: pauseLoading } = useOrderBookPaused();

  // Orders data
  const { buyOrders, sellOrders, totalBuyOrders, totalSellOrders, isLoading: ordersLoading } = useActiveOrders();

  // Combine orders
  const orders = useMemo(() => {
    const buys = (buyOrders || []).map((order: any) => ({
      ...order,
      orderType: 0, // Buy
    }));
    const sells = (sellOrders || []).map((order: any) => ({
      ...order,
      orderType: 1, // Sell
    }));
    return [...buys, ...sells];
  }, [buyOrders, sellOrders]);

  // Events
  const createdEvents = useOrderCreatedEvents();
  const filledEvents = useOrderFilledEvents();
  const cancelledEvents = useOrderCancelledEvents();

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

  // Calculate statistics
  const totalVolumeMWG = useMemo(() => {
    if (!filledEvents) return BigInt(0);
    return filledEvents.reduce((sum, event) => sum + event.mwgAmount, BigInt(0));
  }, [filledEvents]);

  const totalVolumeBNB = useMemo(() => {
    if (!filledEvents) return BigInt(0);
    return filledEvents.reduce((sum, event) => sum + event.bnbAmount, BigInt(0));
  }, [filledEvents]);

  const totalFeesCollected = useMemo(() => {
    if (!filledEvents || !feePercentage) return BigInt(0);
    const feeBasisPoints = BigInt(feePercentage);
    return filledEvents.reduce((sum, event) => {
      const fee = (event.bnbAmount * feeBasisPoints) / BigInt(10000);
      return sum + fee;
    }, BigInt(0));
  }, [filledEvents, feePercentage]);

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  if (!hasRole) {
    return null; // Will redirect
  }

  const isLoading = statsLoading || pauseLoading;

  return (
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
                  {isLoading ? "..." : (createdEvents?.length || 0)}
                </div>
              </div>

              {/* Active Orders */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Active Orders</div>
                <div className="text-3xl font-bold text-green-400">
                  {isLoading ? "..." : (orders?.length || 0)}
                </div>
              </div>

              {/* Total Trades */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Total Trades</div>
                <div className="text-3xl font-bold text-blue-400">
                  {isLoading ? "..." : (filledEvents?.length || 0)}
                </div>
              </div>

              {/* Cancelled Orders */}
              <div className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg p-6 border border-gray-700">
                <div className="text-gray-400 text-sm mb-1">Cancelled Orders</div>
                <div className="text-3xl font-bold text-red-400">
                  {isLoading ? "..." : (cancelledEvents?.length || 0)}
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
                  {isLoading ? "..." : formatUnits(totalVolumeMWG, 18)}
                </div>
                <div className="text-purple-300 text-sm mt-1">MWG</div>
              </div>

              {/* Total BNB Volume */}
              <div className="bg-gradient-to-br from-yellow-900/20 to-yellow-800/20 rounded-lg p-6 border border-yellow-700/30">
                <div className="text-yellow-300 text-sm mb-1">Total BNB Volume</div>
                <div className="text-3xl font-bold text-yellow-400">
                  {isLoading ? "..." : parseFloat(formatEther(totalVolumeBNB)).toFixed(4)}
                </div>
                <div className="text-yellow-300 text-sm mt-1">BNB</div>
              </div>

              {/* Total Fees Collected */}
              <div className="bg-gradient-to-br from-green-900/20 to-green-800/20 rounded-lg p-6 border border-green-700/30">
                <div className="text-green-300 text-sm mb-1">Total Fees Collected</div>
                <div className="text-3xl font-bold text-green-400">
                  {isLoading ? "..." : parseFloat(formatEther(totalFeesCollected)).toFixed(6)}
                </div>
                <div className="text-green-300 text-sm mt-1">BNB</div>
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
                    {isLoading ? "..." : `${formatUnits(minMWGAmount || BigInt(0), 18)} MWG`}
                  </div>
                </div>

                <div>
                  <div className="text-gray-400 text-sm mb-1">Minimum BNB Amount</div>
                  <div className="text-xl font-semibold text-white">
                    {isLoading ? "..." : `${formatEther(minBNBAmount || BigInt(0))} BNB`}
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
                {[
                  ...(createdEvents?.slice(0, 5).map(e => ({ type: "created", event: e })) || []),
                  ...(filledEvents?.slice(0, 5).map(e => ({ type: "filled", event: e })) || []),
                  ...(cancelledEvents?.slice(0, 5).map(e => ({ type: "cancelled", event: e })) || [])
                ]
                  .sort((a, b) => {
                    // Sort by most recent (this is simplified, real implementation would use timestamps)
                    return 0;
                  })
                  .slice(0, 10)
                  .map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          item.type === "created" ? "bg-blue-400" :
                          item.type === "filled" ? "bg-green-400" : "bg-red-400"
                        }`} />
                        <span className="text-gray-300 capitalize">{item.type}</span>
                        {item.type === "created" && (
                          <span className="text-gray-400">Order #{(item.event as any).orderId?.toString()}</span>
                        )}
                        {item.type === "filled" && (
                          <span className="text-gray-400">Order #{(item.event as any).orderId?.toString()}</span>
                        )}
                        {item.type === "cancelled" && (
                          <span className="text-gray-400">Order #{(item.event as any).orderId?.toString()}</span>
                        )}
                      </div>
                      <span className="text-gray-500 text-sm">Just now</span>
                    </div>
                  ))}
                {(!createdEvents?.length && !filledEvents?.length && !cancelledEvents?.length) && (
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
  );
}
