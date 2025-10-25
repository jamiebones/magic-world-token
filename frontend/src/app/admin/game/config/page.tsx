"use client";

import { useState, useEffect } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useGameStats } from "@/hooks/useContractStats";
import { useUpdateGameConfig } from "@/hooks/useGameOperations";
import toast from "react-hot-toast";

export default function GameConfigPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <RequireRole contract="game" roleConstant="GAME_ADMIN_ROLE">
          <ConfigForm />
        </RequireRole>
      </main>
    </div>
  );
}

function ConfigForm() {
  const gameStats = useGameStats();
  const {
    setDailyRewardLimit,
    setMaxBatchSize,
    setCooldownPeriod,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useUpdateGameConfig();

  const [dailyLimit, setDailyLimit] = useState("");
  const [batchSize, setBatchSize] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [settingType, setSettingType] = useState<
    "dailyLimit" | "batchSize" | "cooldown" | null
  >(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!gameStats.isLoading && !initialized && gameStats.dailyLimit) {
      setDailyLimit(gameStats.dailyLimit);
      setBatchSize(gameStats.maxBatchSize);
      setCooldown((parseInt(gameStats.cooldownPeriod) / 3600).toString());
      setInitialized(true);
    }
  }, [gameStats, initialized]);

  useEffect(() => {
    if (isSuccess) {
      toast.success("Configuration updated successfully!");
      setSettingType(null);
    }
  }, [isSuccess]);

  useEffect(() => {
    if (error) {
      toast.error(`Update failed: ${error.message}`);
    }
  }, [error]);

  const handleUpdateDailyLimit = async () => {
    const limit = parseFloat(dailyLimit);
    if (isNaN(limit) || limit <= 0) {
      toast.error("Please enter a valid daily limit");
      return;
    }

    setSettingType("dailyLimit");
    toast.loading("Updating daily limit...", { id: "update" });

    try {
      await setDailyRewardLimit(dailyLimit);
      toast.dismiss("update");
    } catch (err) {
      toast.dismiss("update");
      console.error("Update error:", err);
    }
  };

  const handleUpdateBatchSize = async () => {
    const size = parseInt(batchSize, 10);
    if (isNaN(size) || size <= 0 || size > 500) {
      toast.error("Batch size must be between 1 and 500");
      return;
    }

    setSettingType("batchSize");
    toast.loading("Updating batch size...", { id: "update" });

    try {
      await setMaxBatchSize(size);
      toast.dismiss("update");
    } catch (err) {
      toast.dismiss("update");
      console.error("Update error:", err);
    }
  };

  const handleUpdateCooldown = async () => {
    const hours = parseFloat(cooldown);
    if (isNaN(hours) || hours < 0.0167 || hours > 168) {
      // 1 min to 7 days
      toast.error("Cooldown must be between 1 minute and 7 days");
      return;
    }

    const seconds = Math.floor(hours * 3600);
    setSettingType("cooldown");
    toast.loading("Updating cooldown period...", { id: "update" });

    try {
      await setCooldownPeriod(seconds);
      toast.dismiss("update");
    } catch (err) {
      toast.dismiss("update");
      console.error("Update error:", err);
    }
  };

  const isUpdating = isPending || isConfirming;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Current Settings Overview */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-xl font-semibold text-purple-400 mb-6">
          Current Settings
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Daily Reward Limit</p>
            <p className="text-2xl font-bold text-white font-mono">
              {Number(gameStats.dailyLimit).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">MWT per player/day</p>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Max Batch Size</p>
            <p className="text-2xl font-bold text-white font-mono">
              {gameStats.maxBatchSize}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              recipients per transaction
            </p>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Cooldown Period</p>
            <p className="text-2xl font-bold text-white font-mono">
              {gameStats.cooldownHours}h
            </p>
            <p className="text-xs text-gray-500 mt-1">between major rewards</p>
          </div>
        </div>
      </div>

      {/* Daily Reward Limit */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Daily Reward Limit
            </h3>
            <p className="text-sm text-gray-400">
              Maximum tokens a player can receive per day
            </p>
          </div>
          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
            GAME_ADMIN_ROLE
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Daily Limit (MWT)
            </label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="1000"
              step="1"
              min="1"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="mt-2 text-xs text-gray-500">
              Minimum: 1 MWT | Recommended: 1,000 - 100,000,000 MWT
            </p>
          </div>

          <button
            onClick={handleUpdateDailyLimit}
            disabled={isUpdating}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating && settingType === "dailyLimit"
              ? "Updating..."
              : "Update Daily Limit"}
          </button>
        </div>
      </div>

      {/* Max Batch Size */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Maximum Batch Size
            </h3>
            <p className="text-sm text-gray-400">
              Maximum recipients in a single distribution
            </p>
          </div>
          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
            GAME_ADMIN_ROLE
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Batch Size
            </label>
            <input
              type="number"
              value={batchSize}
              onChange={(e) => setBatchSize(e.target.value)}
              placeholder="200"
              step="1"
              min="1"
              max="500"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="mt-2 text-xs text-gray-500">
              Range: 1 - 500 recipients | Current token contract max: 200
            </p>
          </div>

          <button
            onClick={handleUpdateBatchSize}
            disabled={isUpdating}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating && settingType === "batchSize"
              ? "Updating..."
              : "Update Batch Size"}
          </button>
        </div>
      </div>

      {/* Cooldown Period */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-2">
              Cooldown Period
            </h3>
            <p className="text-sm text-gray-400">
              Minimum time between major rewards (≥100 tokens)
            </p>
          </div>
          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
            GAME_ADMIN_ROLE
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              New Cooldown Period (hours)
            </label>
            <input
              type="number"
              value={cooldown}
              onChange={(e) => setCooldown(e.target.value)}
              placeholder="1"
              step="0.1"
              min="0.0167"
              max="168"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="mt-2 text-xs text-gray-500">
              Range: 1 minute (0.0167h) to 7 days (168h) | Recommended: 1-24
              hours
            </p>
          </div>

          <button
            onClick={handleUpdateCooldown}
            disabled={isUpdating}
            className="w-full py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdating && settingType === "cooldown"
              ? "Updating..."
              : "Update Cooldown"}
          </button>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 text-blue-400 mt-0.5 mr-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <p className="text-sm text-blue-200 font-semibold mb-1">
              Configuration Guidelines
            </p>
            <ul className="text-xs text-blue-300 space-y-1">
              <li>• Daily limits prevent abuse while allowing flexibility</li>
              <li>• Batch size affects gas costs - higher = more expensive</li>
              <li>• Cooldown applies only to rewards ≥100 tokens</li>
              <li>
                • Changes take effect immediately after transaction confirms
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
