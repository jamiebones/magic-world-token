"use client";

import React from "react";
import { FARMING_CONFIG } from "@/config/contracts";

export interface LockPeriodSelectorProps {
  selectedDays: number;
  onChange: (days: number) => void;
  disabled?: boolean;
}

export function LockPeriodSelector({
  selectedDays,
  onChange,
  disabled = false,
}: LockPeriodSelectorProps) {
  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-300 mb-2">
        Lock Period (Higher lock = Higher rewards)
      </label>

      {/* Desktop: Grid layout */}
      <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {FARMING_CONFIG.LOCK_TIERS.map((tier) => {
          const isSelected = selectedDays === tier.days;
          return (
            <button
              key={tier.days}
              onClick={() => !disabled && onChange(tier.days)}
              disabled={disabled}
              className={`p-4 rounded-xl border-2 transition-all text-left ${
                isSelected
                  ? "border-purple-500 bg-purple-500/20 shadow-lg shadow-purple-500/20"
                  : "border-gray-700 bg-gray-800/50 hover:border-purple-500/50"
              } ${
                disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">
                  {tier.label}
                </span>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-bold ${
                    isSelected
                      ? "bg-purple-600 text-white"
                      : "bg-gray-700 text-gray-300"
                  }`}
                >
                  {tier.boost}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {tier.days === 0 ? "No lock period" : `${tier.days} days`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Mobile: Dropdown */}
      <div className="sm:hidden">
        <select
          value={selectedDays}
          onChange={(e) => onChange(Number(e.target.value))}
          disabled={disabled}
          className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {FARMING_CONFIG.LOCK_TIERS.map((tier) => (
            <option key={tier.days} value={tier.days}>
              {tier.label} - {tier.boost} boost
              {tier.days > 0 && ` (${tier.days} days)`}
            </option>
          ))}
        </select>

        {/* Selected Tier Info */}
        <div className="mt-3 p-3 bg-gray-800/50 rounded-lg border border-purple-500/20">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">Boost Multiplier:</span>
            <span className="text-lg font-bold text-purple-400">
              {
                FARMING_CONFIG.LOCK_TIERS.find((t) => t.days === selectedDays)
                  ?.boost
              }
            </span>
          </div>
          {selectedDays > 0 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm text-gray-400">Lock Duration:</span>
              <span className="text-sm font-medium text-white">
                {selectedDays} days
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info Message */}
      <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <p className="text-xs sm:text-sm text-blue-300">
          💡 <strong>Tip:</strong> Longer lock periods give you higher reward
          multipliers. Choose based on your investment timeline.
        </p>
      </div>
    </div>
  );
}
