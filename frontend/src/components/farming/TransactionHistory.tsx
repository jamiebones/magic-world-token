"use client";

import React, { useState } from "react";
import type { ActivityFeedItem } from "@/types/farming";
import { formatUnits } from "viem";

export interface TransactionHistoryProps {
  events: ActivityFeedItem[];
  filterBy?: "all" | "stake" | "unstake" | "claim";
  maxItems?: number;
  showPagination?: boolean;
}

export function TransactionHistory({
  events,
  filterBy = "all",
  maxItems = 10,
  showPagination = true,
}: TransactionHistoryProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState(filterBy);

  // Filter events
  const filteredEvents =
    selectedFilter === "all"
      ? events
      : events.filter((event) => event.type === selectedFilter);

  // Pagination
  const totalPages = Math.ceil(filteredEvents.length / maxItems);
  const startIndex = (currentPage - 1) * maxItems;
  const paginatedEvents = filteredEvents.slice(
    startIndex,
    startIndex + maxItems
  );

  // Event type badge
  const getEventBadge = (type: string) => {
    const badges = {
      stake: {
        emoji: "🎯",
        label: "Staked",
        color: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      },
      unstake: {
        emoji: "🔓",
        label: "Unstaked",
        color: "bg-red-500/20 text-red-400 border-red-500/30",
      },
      claim: {
        emoji: "💰",
        label: "Claimed",
        color: "bg-green-500/20 text-green-400 border-green-500/30",
      },
    };
    return badges[type as keyof typeof badges] || badges.stake;
  };

  // Format timestamp
  const formatTime = (timestamp: bigint) => {
    const date = new Date(Number(timestamp) * 1000);
    return date.toLocaleString();
  };

  // Shorten address
  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (events.length === 0) {
    return (
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 border border-purple-500/20 text-center">
        <div className="text-4xl mb-3">📭</div>
        <p className="text-gray-400">No transaction history yet</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 overflow-hidden">
      {/* Header with Filters */}
      <div className="p-4 sm:p-6 border-b border-gray-700">
        <h3 className="text-lg sm:text-xl font-bold text-white mb-3">
          Transaction History
        </h3>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          {["all", "stake", "unstake", "claim"].map((filter) => (
            <button
              key={filter}
              onClick={() => {
                setSelectedFilter(filter as typeof selectedFilter);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedFilter === filter
                  ? "bg-purple-600 text-white"
                  : "bg-gray-700 text-gray-300 hover:bg-gray-600"
              }`}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                Tx
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {paginatedEvents.map((event, index) => {
              const badge = getEventBadge(event.type);
              return (
                <tr
                  key={index}
                  className="hover:bg-gray-700/30 transition-colors"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${badge.color}`}
                    >
                      <span>{badge.emoji}</span>
                      <span>{badge.label}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300 font-mono">
                    {shortenAddress(event.data.user)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {event.type === "stake" &&
                      `Position #${event.data.tokenId?.toString()}`}
                    {event.type === "unstake" &&
                      `${parseFloat(
                        formatUnits(event.data.rewards || BigInt(0), 18)
                      ).toFixed(2)} MWG`}
                    {event.type === "claim" &&
                      `${parseFloat(
                        formatUnits(event.data.amount || BigInt(0), 18)
                      ).toFixed(2)} MWG`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    {formatTime(event.data.timestamp)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <a
                      href={`https://bscscan.com/tx/${event.data.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      View ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden divide-y divide-gray-700">
        {paginatedEvents.map((event, index) => {
          const badge = getEventBadge(event.type);
          return (
            <div
              key={index}
              className="p-4 hover:bg-gray-700/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold border ${badge.color}`}
                >
                  <span>{badge.emoji}</span>
                  <span>{badge.label}</span>
                </span>
                <a
                  href={`https://bscscan.com/tx/${event.data.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-xs"
                >
                  View Tx ↗
                </a>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">User:</span>
                  <span className="text-gray-300 font-mono">
                    {shortenAddress(event.data.user)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Details:</span>
                  <span className="text-gray-300">
                    {event.type === "stake" &&
                      `Position #${event.data.tokenId?.toString()}`}
                    {event.type === "unstake" &&
                      `${parseFloat(
                        formatUnits(event.data.rewards || BigInt(0), 18)
                      ).toFixed(2)} MWG`}
                    {event.type === "claim" &&
                      `${parseFloat(
                        formatUnits(event.data.amount || BigInt(0), 18)
                      ).toFixed(2)} MWG`}
                  </span>
                </div>
                <div className="text-gray-400 text-xs">
                  {formatTime(event.data.timestamp)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors text-sm"
          >
            Previous
          </button>
          <span className="text-sm text-gray-400">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 bg-gray-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 transition-colors text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
