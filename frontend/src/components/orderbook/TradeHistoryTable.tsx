"use client";

import React from "react";
import { formatUnits } from "viem";
import { ORDER_TYPE_LABELS, OrderType } from "@/types/orderbook";
import { copyToClipboard } from "@/hooks/orderbook/useOrderBookToasts";

export interface Trade {
  orderId: bigint;
  buyer?: `0x${string}`;
  seller?: `0x${string}`;
  filler: `0x${string}`;
  mwgAmount: bigint;
  bnbAmount: bigint;
  timestamp: number;
  txHash?: string;
  orderType: number;
}

export interface TradeHistoryTableProps {
  trades: Trade[];
  isLoading?: boolean;
  userAddress?: `0x${string}`;
}

export function TradeHistoryTable({
  trades,
  isLoading = false,
  userAddress,
}: TradeHistoryTableProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (isLoading) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6">
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No trades found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-700/50 border-b border-gray-700">
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Order ID
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                MWG Amount
              </th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-gray-300 uppercase tracking-wider">
                BNB Amount
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Trader
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Tx
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {trades.map((trade, index) => {
              const isUserTrade = userAddress && 
                trade.filler.toLowerCase() === userAddress.toLowerCase();
              
              return (
                <tr
                  key={`${trade.orderId}-${index}`}
                  className={`hover:bg-gray-700/30 transition-colors ${
                    isUserTrade ? "bg-purple-500/10" : ""
                  }`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    {new Date(trade.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        trade.orderType === 0
                          ? "bg-green-500/20 text-green-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {ORDER_TYPE_LABELS[trade.orderType as OrderType]}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                    #{trade.orderId.toString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-white">
                    {parseFloat(formatUnits(trade.mwgAmount, 18)).toFixed(2)} MWG
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-white">
                    {parseFloat(formatUnits(trade.bnbAmount, 18)).toFixed(6)} BNB
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => copyToClipboard(trade.filler, "Trader address")}
                      className="text-purple-400 hover:text-purple-300 font-mono text-sm"
                      title="Click to copy address"
                    >
                      {truncateAddress(trade.filler)}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {trade.txHash ? (
                      <div className="flex items-center justify-center gap-2">
                        <a
                          href={`https://bscscan.com/tx/${trade.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs"
                        >
                          View
                        </a>
                        <button
                          onClick={() => copyToClipboard(trade.txHash!, "Transaction hash")}
                          className="text-gray-400 hover:text-gray-300"
                          title="Copy tx hash"
                        >
                          📋
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-500 text-xs">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-700">
        {trades.map((trade, index) => {
          const isUserTrade = userAddress && 
            trade.filler.toLowerCase() === userAddress.toLowerCase();
          
          return (
            <div
              key={`${trade.orderId}-${index}`}
              className={`p-4 ${isUserTrade ? "bg-purple-500/10" : ""}`}
            >
              <div className="flex justify-between items-start mb-2">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded ${
                    trade.orderType === 0
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {ORDER_TYPE_LABELS[trade.orderType as OrderType]}
                </span>
                <span className="text-xs text-gray-400">
                  {new Date(trade.timestamp).toLocaleTimeString()}
                </span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Order:</span>
                  <span className="text-white">#{trade.orderId.toString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">MWG:</span>
                  <span className="text-white font-medium">
                    {parseFloat(formatUnits(trade.mwgAmount, 18)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">BNB:</span>
                  <span className="text-white font-medium">
                    {parseFloat(formatUnits(trade.bnbAmount, 18)).toFixed(6)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Trader:</span>
                  <code className="text-purple-400 text-xs">
                    {truncateAddress(trade.filler)}
                  </code>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
