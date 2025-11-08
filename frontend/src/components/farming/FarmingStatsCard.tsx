"use client";

import React from "react";

export interface FarmingStatsCardProps {
  title: string;
  value: string | number;
  change?: number; // Percentage change (positive or negative)
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  isLoading?: boolean;
  prefix?: string; // e.g., "$", "APR: "
  suffix?: string; // e.g., "%", " MWG"
  decimals?: number;
}

export function FarmingStatsCard({
  title,
  value,
  change,
  icon,
  trend = "neutral",
  isLoading = false,
  prefix = "",
  suffix = "",
  decimals = 2,
}: FarmingStatsCardProps) {
  // Format value with decimals if it's a number
  const formattedValue =
    typeof value === "number" ? value.toFixed(decimals) : value;

  // Determine trend color
  const trendColor =
    trend === "up"
      ? "text-green-400"
      : trend === "down"
      ? "text-red-400"
      : "text-gray-400";

  // Determine change color
  const changeColor =
    change !== undefined
      ? change > 0
        ? "text-green-400"
        : change < 0
        ? "text-red-400"
        : "text-gray-400"
      : "";

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 sm:p-6 border border-purple-500/20 hover:border-purple-500/40 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Title */}
          <p className="text-sm sm:text-base text-gray-400 mb-1 sm:mb-2">
            {title}
          </p>

          {/* Value */}
          {isLoading ? (
            <div className="animate-pulse">
              <div className="h-8 sm:h-10 bg-gray-700 rounded w-3/4"></div>
            </div>
          ) : (
            <div className="flex items-baseline gap-1 flex-wrap">
              <h3 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                {prefix}
                {formattedValue}
                {suffix}
              </h3>
            </div>
          )}

          {/* Change Indicator */}
          {change !== undefined && !isLoading && (
            <div className={`flex items-center gap-1 mt-2 ${changeColor}`}>
              <span className="text-xs sm:text-sm font-medium">
                {change > 0 ? "↑" : change < 0 ? "↓" : "•"}{" "}
                {Math.abs(change).toFixed(2)}%
              </span>
              <span className="text-xs text-gray-500">vs last period</span>
            </div>
          )}
        </div>

        {/* Icon */}
        {icon && (
          <div
            className={`text-3xl sm:text-4xl ${trendColor} ml-2 sm:ml-4 flex-shrink-0`}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
