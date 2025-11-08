"use client";

import React from "react";

export interface BoostMultiplierBadgeProps {
  multiplier: number; // Raw multiplier value (1000-2000)
  showTooltip?: boolean;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}

export function BoostMultiplierBadge({
  multiplier,
  showTooltip = true,
  size = "md",
  animated = false,
}: BoostMultiplierBadgeProps) {
  // Convert multiplier to display value (1000 = 1.0x, 2000 = 2.0x)
  const displayMultiplier = (multiplier / 1000).toFixed(2);
  const percentage = ((multiplier / 1000 - 1) * 100).toFixed(0);

  // Determine color based on multiplier level
  const getColorClasses = () => {
    if (multiplier >= 2000)
      return "from-purple-500 via-pink-500 to-red-500 border-pink-400";
    if (multiplier >= 1500)
      return "from-purple-500 to-pink-500 border-purple-400";
    if (multiplier >= 1250)
      return "from-blue-500 to-purple-500 border-blue-400";
    if (multiplier >= 1100)
      return "from-green-500 to-blue-500 border-green-400";
    if (multiplier >= 1050)
      return "from-yellow-500 to-green-500 border-yellow-400";
    return "from-gray-500 to-gray-600 border-gray-400";
  };

  // Size configurations
  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm sm:text-base px-3 py-1.5",
    lg: "text-lg sm:text-xl px-4 py-2",
  };

  // Get boost emoji
  const getBoostEmoji = () => {
    if (multiplier >= 2000) return "🚀";
    if (multiplier >= 1500) return "⚡";
    if (multiplier >= 1250) return "💎";
    if (multiplier >= 1100) return "⭐";
    if (multiplier >= 1050) return "✨";
    return "📊";
  };

  return (
    <div className="relative inline-block group">
      <div
        className={`
        bg-gradient-to-r ${getColorClasses()}
        ${sizeClasses[size]}
        rounded-full font-bold text-white shadow-lg
        flex items-center gap-1 sm:gap-2
        border-2
        ${animated ? "animate-pulse" : ""}
        transition-transform hover:scale-105
      `}
      >
        <span className="text-base sm:text-lg">{getBoostEmoji()}</span>
        <span className="whitespace-nowrap">{displayMultiplier}x Boost</span>
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 border border-purple-500/30">
          <div className="space-y-1">
            <div className="font-bold text-purple-300">
              {displayMultiplier}x Reward Multiplier
            </div>
            <div className="text-gray-300">+{percentage}% bonus rewards</div>
            <div className="text-gray-400 text-[10px]">
              Base rewards × {displayMultiplier}
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
