"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useRouter } from "next/navigation";
import { TradeHistoryTable } from "@/components/orderbook/TradeHistoryTable";
import { 
  useOrderFilledEvents,
  type OrderFilledEvent
} from "@/hooks/orderbook/useOrderBookEvents";
import { OrderType } from "@/types/orderbook";
import { copyToClipboard } from "@/hooks/orderbook/useOrderBookToasts";

type FilterType = "all" | "my-trades" | "buy" | "sell";
type DateRangeType = "24h" | "7d" | "30d" | "all";

export default function TradesPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  
  const [filter, setFilter] = useState<FilterType>("all");
  const [dateRange, setDateRange] = useState<DateRangeType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch trade events - only watch OrderFilled events for this page
  const orderFilledEvents = useOrderFilledEvents();

  // Convert events to trades format
  const allTrades = useMemo(() => {
    if (!orderFilledEvents) return [];

    return orderFilledEvents
      .filter((event): event is Required<OrderFilledEvent> => 
        event.timestamp !== undefined && 
        event.transactionHash !== undefined && 
        event.orderType !== undefined
      )
      .map(event => ({
        orderId: event.orderId,
        filler: event.filler,
        mwgAmount: event.mwgAmount,
        bnbAmount: event.bnbAmount,
        timestamp: event.timestamp,
        txHash: event.transactionHash,
        orderType: event.orderType,
      }));
  }, [orderFilledEvents]);

  // Filter trades
  const filteredTrades = useMemo(() => {
    let trades = allTrades;

    // Filter by user
    if (filter === "my-trades" && address) {
      trades = trades.filter(trade => 
        trade.filler.toLowerCase() === address.toLowerCase()
      );
    }

    // Filter by type
    if (filter === "buy") {
      trades = trades.filter(trade => trade.orderType === OrderType.BUY);
    } else if (filter === "sell") {
      trades = trades.filter(trade => trade.orderType === OrderType.SELL);
    }

    // Filter by date range
    const now = Math.floor(Date.now() / 1000);
    if (dateRange === "24h") {
      trades = trades.filter(trade => trade.timestamp > now - 86400);
    } else if (dateRange === "7d") {
      trades = trades.filter(trade => trade.timestamp > now - 604800);
    } else if (dateRange === "30d") {
      trades = trades.filter(trade => trade.timestamp > now - 2592000);
    }

    // Filter by search query (order ID or address)
    if (searchQuery) {
      trades = trades.filter(trade => 
        trade.orderId.toString().includes(searchQuery) ||
        trade.filler.toLowerCase().includes(searchQuery.toLowerCase()) ||
        trade.txHash?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort by most recent first
    return trades.sort((a, b) => b.timestamp - a.timestamp);
  }, [allTrades, filter, dateRange, searchQuery, address]);

  // Calculate statistics
  const stats = useMemo(() => {
    const buyTrades = filteredTrades.filter(t => t.orderType === OrderType.BUY);
    const sellTrades = filteredTrades.filter(t => t.orderType === OrderType.SELL);
    
    const totalMWG = filteredTrades.reduce((sum, t) => sum + Number(t.mwgAmount), 0) / 1e18;
    const totalBNB = filteredTrades.reduce((sum, t) => sum + Number(t.bnbAmount), 0) / 1e18;
    const avgPrice = totalBNB / totalMWG || 0;

    const myTrades = address 
      ? filteredTrades.filter(t => t.filler.toLowerCase() === address.toLowerCase())
      : [];

    return {
      total: filteredTrades.length,
      buyCount: buyTrades.length,
      sellCount: sellTrades.length,
      totalMWG,
      totalBNB,
      avgPrice,
      myTradesCount: myTrades.length,
    };
  }, [filteredTrades, address]);

  // Export to CSV
  const handleExport = () => {
    if (filteredTrades.length === 0) {
      return;
    }

    const headers = ["Time", "Type", "Order ID", "MWG Amount", "BNB Amount", "Price", "Trader", "Tx Hash"];
    const rows = filteredTrades.map(trade => [
      new Date(trade.timestamp * 1000).toISOString(),
      trade.orderType === OrderType.BUY ? "BUY" : "SELL",
      trade.orderId.toString(),
      (Number(trade.mwgAmount) / 1e18).toFixed(2),
      (Number(trade.bnbAmount) / 1e18).toFixed(6),
      ((Number(trade.bnbAmount) / Number(trade.mwgAmount)) * 1e18).toFixed(8),
      trade.filler,
      trade.txHash || "",
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orderbook-trades-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
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
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-600 mb-2">
              Trade History
            </h1>
            <p className="text-gray-400">
              View all executed trades on the order book
            </p>
          </div>

          {/* Statistics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-purple-500/20">
              <div className="text-xs text-gray-400 mb-1">Total Trades</div>
              <div className="text-xl font-bold text-white">{stats.total}</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-green-500/20">
              <div className="text-xs text-gray-400 mb-1">Buy Orders</div>
              <div className="text-xl font-bold text-green-400">{stats.buyCount}</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-red-500/20">
              <div className="text-xs text-gray-400 mb-1">Sell Orders</div>
              <div className="text-xl font-bold text-red-400">{stats.sellCount}</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-blue-500/20">
              <div className="text-xs text-gray-400 mb-1">Total MWG</div>
              <div className="text-xl font-bold text-blue-400">{stats.totalMWG.toFixed(0)}</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-yellow-500/20">
              <div className="text-xs text-gray-400 mb-1">Total BNB</div>
              <div className="text-xl font-bold text-yellow-400">{stats.totalBNB.toFixed(2)}</div>
            </div>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-cyan-500/20">
              <div className="text-xs text-gray-400 mb-1">Avg Price</div>
              <div className="text-xl font-bold text-cyan-400">{stats.avgPrice.toFixed(8)}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4 sm:p-6 mb-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Type Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Filter by Type
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filter === "all"
                        ? "bg-purple-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    All
                  </button>
                  {isConnected && (
                    <button
                      onClick={() => setFilter("my-trades")}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        filter === "my-trades"
                          ? "bg-purple-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      My Trades ({stats.myTradesCount})
                    </button>
                  )}
                  <button
                    onClick={() => setFilter("buy")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filter === "buy"
                        ? "bg-green-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setFilter("sell")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      filter === "sell"
                        ? "bg-red-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              {/* Date Range Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Time Range
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setDateRange("24h")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "24h"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    24h
                  </button>
                  <button
                    onClick={() => setDateRange("7d")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "7d"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => setDateRange("30d")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "30d"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => setDateRange("all")}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      dateRange === "all"
                        ? "bg-blue-600 text-white"
                        : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                    }`}
                  >
                    All
                  </button>
                </div>
              </div>

              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Search
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Order ID, address, tx hash..."
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Export Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={handleExport}
                disabled={filteredTrades.length === 0}
                className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Export to CSV
              </button>
            </div>
          </div>

          {/* Trades Table */}
          <TradeHistoryTable 
            trades={filteredTrades}
            isLoading={false}
            userAddress={address}
          />

          {/* Quick Actions */}
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/orderbook"
              className="flex-1 min-w-[200px] bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-all text-center"
            >
              View Order Book
            </Link>
            <Link
              href="/orderbook/my-orders"
              className="flex-1 min-w-[200px] bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-all text-center"
            >
              My Orders
            </Link>
            <Link
              href="/orderbook/create"
              className="flex-1 min-w-[200px] bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-6 rounded-lg transition-all text-center"
            >
              Create Order
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
