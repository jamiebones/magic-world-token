"use client";

import React from "react";

export interface APRBadgeProps {
  apr: number; // APR in basis points (10000 = 100%)
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  boosted?: boolean;
}

export function APRBadge({
  apr,
  showTooltip = true,
  size = "md",
  boosted = false,
}: APRBadgeProps) {
  // Convert basis points to percentage
  const aprPercentage = apr / 100;

  // Determine color based on APR value
  const getColorClasses = () => {
    if (aprPercentage >= 100) return "from-green-500 to-emerald-500 text-white";
    if (aprPercentage >= 50) return "from-green-500 to-green-600 text-white";
    if (aprPercentage >= 20) return "from-yellow-500 to-yellow-600 text-white";
    return "from-gray-500 to-gray-600 text-white";
  };

  // Size classes
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base sm:text-lg px-4 py-2",
  };

  return (
    <div className="relative inline-block group">
      <div
        className={`
        bg-gradient-to-r ${getColorClasses()}
        ${sizeClasses[size]}
        rounded-full font-bold shadow-lg
        flex items-center gap-1 sm:gap-2
        ${boosted ? "animate-pulse" : ""}
      `}
      >
        {boosted && <span className="text-xs sm:text-sm">🚀</span>}
        <span className="whitespace-nowrap">
          APR: {aprPercentage.toFixed(2)}%
        </span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-purple-500/30">
          <div className="space-y-1">
            <div>Base APR: {aprPercentage.toFixed(2)}%</div>
            {boosted && (
              <div className="text-green-400">
                🚀 Boosted by lock multiplier
              </div>
            )}
            <div className="text-gray-400">
              Daily: {(aprPercentage / 365).toFixed(4)}%
            </div>
          </div>
          {/* Arrow */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900"></div>
          </div>
        </div>
      )}
    </div>
  );
}
