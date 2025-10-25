"use client";

import { useState, useEffect } from "react";
import { RequireAnyRole } from "@/components/RequireRole";
import {
  useTokenStats,
  useGameStats,
  usePartnerVaultStats,
  useTokenBalance,
} from "@/hooks/useContractStats";
import { useTokenEmergency } from "@/hooks/useTokenOperations";
import { useGameEmergency } from "@/hooks/useGameOperations";
import { usePartnerVaultEmergency } from "@/hooks/usePartnerVaultOperations";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import toast from "react-hot-toast";

export default function EmergencyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <RequireAnyRole
          roles={[
            { contract: "token", roleConstant: "PAUSE_ROLE" },
            { contract: "game", roleConstant: "GAME_ADMIN_ROLE" },
            { contract: "vault", roleConstant: "ADMIN_ROLE" },
          ]}
        >
          <EmergencyControls />
        </RequireAnyRole>
      </main>
    </div>
  );
}

function EmergencyControls() {
  const tokenStats = useTokenStats();
  const gameStats = useGameStats();
  const vaultStats = usePartnerVaultStats();
  const { balance: gameBalance } = useTokenBalance(
    CONTRACT_ADDRESSES.GAME as `0x${string}`
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Warning Banner */}
      <div className="bg-red-500/10 border-2 border-red-500/50 rounded-2xl p-6">
        <div className="flex items-start">
          <svg
            className="w-8 h-8 text-red-400 mt-1 mr-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div>
            <h2 className="text-xl font-bold text-red-300 mb-2">
              ⚠️ Emergency Controls
            </h2>
            <p className="text-red-200 text-sm mb-3">
              These controls should only be used in emergency situations. All
              actions are logged on-chain.
            </p>
            <ul className="text-xs text-red-300 space-y-1">
              <li>
                • <strong>Pause:</strong> Stops all token transfers and
                distributions
              </li>
              <li>
                • <strong>Unpause:</strong> Re-enables normal operations
              </li>
              <li>
                • <strong>Emergency Withdraw:</strong> Retrieves tokens from
                game contract (admin only)
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Contract Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <ContractStatusCard
          title="Token Contract"
          isPaused={tokenStats.paused}
          address={CONTRACT_ADDRESSES.TOKEN}
          roleRequired="PAUSE_ROLE"
        />
        <ContractStatusCard
          title="Game Contract"
          isPaused={gameStats.paused}
          address={CONTRACT_ADDRESSES.GAME}
          roleRequired="GAME_ADMIN_ROLE"
          balance={gameBalance}
        />
        <ContractStatusCard
          title="Partner Vault"
          isPaused={vaultStats.paused}
          address={CONTRACT_ADDRESSES.PARTNER_VAULT}
          roleRequired="ADMIN_ROLE"
        />
      </div>

      {/* Token Contract Controls */}
      <TokenContractControls isPaused={tokenStats.paused} />

      {/* Game Contract Controls */}
      <GameContractControls
        isPaused={gameStats.paused}
        gameBalance={gameBalance}
      />

      {/* Partner Vault Controls */}
      <PartnerVaultControls isPaused={vaultStats.paused} />
    </div>
  );
}

function ContractStatusCard({
  title,
  isPaused,
  address,
  roleRequired,
  balance,
}: {
  title: string;
  isPaused: boolean;
  address: string;
  roleRequired: string;
  balance?: string;
}) {
  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold ${
            isPaused
              ? "bg-red-500/20 text-red-300 border border-red-500/50"
              : "bg-green-500/20 text-green-300 border border-green-500/50"
          }`}
        >
          {isPaused ? "PAUSED" : "ACTIVE"}
        </span>
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <p className="text-gray-400 text-xs mb-1">Address</p>
          <p className="text-white font-mono text-xs break-all">{address}</p>
        </div>

        {balance !== undefined && (
          <div>
            <p className="text-gray-400 text-xs mb-1">Balance</p>
            <p className="text-purple-400 font-mono">
              {Number(balance).toLocaleString()} MWT
            </p>
          </div>
        )}

        <div>
          <p className="text-gray-400 text-xs mb-1">Required Role</p>
          <code className="text-xs text-purple-300 bg-purple-500/10 px-2 py-1 rounded">
            {roleRequired}
          </code>
        </div>
      </div>
    </div>
  );
}

function TokenContractControls({ isPaused }: { isPaused: boolean }) {
  const { pause, unpause, isPending, isConfirming, isSuccess, error } =
    useTokenEmergency();
  const [action, setAction] = useState<"pause" | "unpause" | null>(null);

  useEffect(() => {
    if (isSuccess) {
      toast.success(`Token contract ${action}d successfully!`);
      setAction(null);
    }
  }, [isSuccess, action]);

  useEffect(() => {
    if (error) {
      toast.error(`Operation failed: ${error.message}`);
    }
  }, [error]);

  const handlePause = async () => {
    if (
      !confirm(
        "Are you sure you want to PAUSE the token contract? This will stop all token transfers."
      )
    ) {
      return;
    }

    setAction("pause");
    toast.loading("Pausing token contract...", { id: "token-pause" });
    try {
      await pause();
      toast.dismiss("token-pause");
    } catch {
      toast.dismiss("token-pause");
    }
  };

  const handleUnpause = async () => {
    if (
      !confirm(
        "Are you sure you want to UNPAUSE the token contract? This will resume all token transfers."
      )
    ) {
      return;
    }

    setAction("unpause");
    toast.loading("Unpausing token contract...", { id: "token-unpause" });
    try {
      await unpause();
      toast.dismiss("token-unpause");
    } catch {
      toast.dismiss("token-unpause");
    }
  };

  const isProcessing = isPending || isConfirming;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Token Contract Emergency Controls
          </h2>
          <p className="text-sm text-gray-400">
            Pause or unpause all token transfers
          </p>
        </div>
        <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
          PAUSE_ROLE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handlePause}
          disabled={isPaused || isProcessing}
          className="py-3 px-6 bg-red-500/20 border-2 border-red-500/50 text-red-300 font-semibold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && action === "pause"
            ? "Processing..."
            : "🛑 Pause Contract"}
        </button>

        <button
          onClick={handleUnpause}
          disabled={!isPaused || isProcessing}
          className="py-3 px-6 bg-green-500/20 border-2 border-green-500/50 text-green-300 font-semibold rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && action === "unpause"
            ? "Processing..."
            : "✅ Unpause Contract"}
        </button>
      </div>
    </div>
  );
}

function GameContractControls({
  isPaused,
  gameBalance,
}: {
  isPaused: boolean;
  gameBalance: string;
}) {
  const {
    pause,
    unpause,
    emergencyWithdraw,
    isPending,
    isConfirming,
    isSuccess,
    error,
  } = useGameEmergency();
  const [action, setAction] = useState<"pause" | "unpause" | "withdraw" | null>(
    null
  );
  const [withdrawAmount, setWithdrawAmount] = useState("");

  useEffect(() => {
    if (isSuccess) {
      toast.success(`Game contract ${action} operation successful!`);
      setAction(null);
      setWithdrawAmount("");
    }
  }, [isSuccess, action]);

  useEffect(() => {
    if (error) {
      toast.error(`Operation failed: ${error.message}`);
    }
  }, [error]);

  const handlePause = async () => {
    if (
      !confirm(
        "Are you sure you want to PAUSE the game contract? This will stop all reward distributions."
      )
    ) {
      return;
    }

    setAction("pause");
    toast.loading("Pausing game contract...", { id: "game-pause" });
    try {
      await pause();
      toast.dismiss("game-pause");
    } catch {
      toast.dismiss("game-pause");
    }
  };

  const handleUnpause = async () => {
    if (
      !confirm(
        "Are you sure you want to UNPAUSE the game contract? This will resume reward distributions."
      )
    ) {
      return;
    }

    setAction("unpause");
    toast.loading("Unpausing game contract...", { id: "game-unpause" });
    try {
      await unpause();
      toast.dismiss("game-unpause");
    } catch {
      toast.dismiss("game-unpause");
    }
  };

  const handleEmergencyWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (parseFloat(withdrawAmount) > parseFloat(gameBalance)) {
      toast.error("Amount exceeds game contract balance");
      return;
    }

    if (
      !confirm(
        `Are you sure you want to withdraw ${withdrawAmount} MWT from the game contract? This is an EMERGENCY operation.`
      )
    ) {
      return;
    }

    setAction("withdraw");
    toast.loading("Executing emergency withdrawal...", { id: "game-withdraw" });
    try {
      await emergencyWithdraw(withdrawAmount);
      toast.dismiss("game-withdraw");
    } catch {
      toast.dismiss("game-withdraw");
    }
  };

  const isProcessing = isPending || isConfirming;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Game Contract Emergency Controls
          </h2>
          <p className="text-sm text-gray-400">
            Pause, unpause, or emergency withdraw from game contract
          </p>
        </div>
        <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
          GAME_ADMIN_ROLE
        </div>
      </div>

      {/* Pause/Unpause */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={handlePause}
          disabled={isPaused || isProcessing}
          className="py-3 px-6 bg-red-500/20 border-2 border-red-500/50 text-red-300 font-semibold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && action === "pause"
            ? "Processing..."
            : "🛑 Pause Contract"}
        </button>

        <button
          onClick={handleUnpause}
          disabled={!isPaused || isProcessing}
          className="py-3 px-6 bg-green-500/20 border-2 border-green-500/50 text-green-300 font-semibold rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && action === "unpause"
            ? "Processing..."
            : "✅ Unpause Contract"}
        </button>
      </div>

      {/* Emergency Withdraw */}
      <div className="pt-6 border-t border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4">
          Emergency Withdrawal
        </h3>
        <p className="text-sm text-gray-400 mb-4">
          Available balance:{" "}
          <span className="text-purple-400 font-mono font-semibold">
            {Number(gameBalance).toLocaleString()} MWT
          </span>
        </p>

        <div className="flex gap-4">
          <input
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Amount to withdraw"
            step="1"
            min="0"
            max={gameBalance}
            className="flex-1 px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleEmergencyWithdraw}
            disabled={isProcessing}
            className="px-6 py-3 bg-orange-500/20 border-2 border-orange-500/50 text-orange-300 font-semibold rounded-lg hover:bg-orange-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {isProcessing && action === "withdraw"
              ? "Processing..."
              : "🚨 Emergency Withdraw"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PartnerVaultControls({ isPaused }: { isPaused: boolean }) {
  const { pause, unpause, isPending, isConfirming, isSuccess, error } =
    usePartnerVaultEmergency();
  const [action, setAction] = useState<"pause" | "unpause" | null>(null);

  useEffect(() => {
    if (isSuccess) {
      toast.success(`Partner vault ${action}d successfully!`);
      setAction(null);
    }
  }, [isSuccess, action]);

  useEffect(() => {
    if (error) {
      toast.error(`Operation failed: ${error.message}`);
    }
  }, [error]);

  const handlePause = async () => {
    if (
      !confirm(
        "Are you sure you want to PAUSE the partner vault? This will stop all partner withdrawals."
      )
    ) {
      return;
    }

    setAction("pause");
    toast.loading("Pausing partner vault...", { id: "vault-pause" });
    try {
      await pause();
      toast.dismiss("vault-pause");
    } catch {
      toast.dismiss("vault-pause");
    }
  };

  const handleUnpause = async () => {
    if (
      !confirm(
        "Are you sure you want to UNPAUSE the partner vault? This will resume partner withdrawals."
      )
    ) {
      return;
    }

    setAction("unpause");
    toast.loading("Unpausing partner vault...", { id: "vault-unpause" });
    try {
      await unpause();
      toast.dismiss("vault-unpause");
    } catch {
      toast.dismiss("vault-unpause");
    }
  };

  const isProcessing = isPending || isConfirming;

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Partner Vault Emergency Controls
          </h2>
          <p className="text-sm text-gray-400">
            Pause or unpause partner withdrawals
          </p>
        </div>
        <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
          ADMIN_ROLE
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handlePause}
          disabled={isPaused || isProcessing}
          className="py-3 px-6 bg-red-500/20 border-2 border-red-500/50 text-red-300 font-semibold rounded-lg hover:bg-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && action === "pause"
            ? "Processing..."
            : "🛑 Pause Contract"}
        </button>

        <button
          onClick={handleUnpause}
          disabled={!isPaused || isProcessing}
          className="py-3 px-6 bg-green-500/20 border-2 border-green-500/50 text-green-300 font-semibold rounded-lg hover:bg-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing && action === "unpause"
            ? "Processing..."
            : "✅ Unpause Contract"}
        </button>
      </div>
    </div>
  );
}
