"use client";

import { useState, useEffect } from "react";
import { RequireRole } from "@/components/RequireRole";
import { useVaultStats } from "@/hooks/useContractStats";
import {
  useDistributeFromVault,
  useDistributeEqualFromVault,
} from "@/hooks/useGameOperations";
import { VAULT_NAMES } from "@/config/contracts";
import toast from "react-hot-toast";


export default function DistributePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <RequireRole contract="game" roleConstant="REWARD_DISTRIBUTOR_ROLE">
          <DistributeForm />
        </RequireRole>
      </main>
    </div>
  );
}

function DistributeForm() {
  const { vaults, isLoading: vaultsLoading, refetch } = useVaultStats();
  const {
    distributeFromVault,
    isPending: isPendingDifferent,
    isConfirming: isConfirmingDifferent,
    isSuccess: isSuccessDifferent,
    error: errorDifferent,
  } = useDistributeFromVault();
  const {
    distributeEqualFromVault,
    isPending: isPendingEqual,
    isConfirming: isConfirmingEqual,
    isSuccess: isSuccessEqual,
    error: errorEqual,
  } = useDistributeEqualFromVault();

  const [vaultType, setVaultType] = useState(0);
  const [distributionMode, setDistributionMode] = useState<
    "equal" | "different"
  >("equal");
  const [recipients, setRecipients] = useState("");
  const [amount, setAmount] = useState("");
  const [amounts, setAmounts] = useState("");
  const [reason, setReason] = useState("");

  const isPending = isPendingDifferent || isPendingEqual;
  const isConfirming = isConfirmingDifferent || isConfirmingEqual;

  // Handle successful distribution
  useEffect(() => {
    if (isSuccessDifferent || isSuccessEqual) {
      toast.success("Tokens distributed successfully!");
      setRecipients("");
      setAmount("");
      setAmounts("");
      setReason("");
      refetch();
    }
  }, [isSuccessDifferent, isSuccessEqual, refetch]);

  // Handle errors
  useEffect(() => {
    if (errorDifferent) {
      toast.error(`Distribution failed: ${errorDifferent.message}`);
    }
    if (errorEqual) {
      toast.error(`Distribution failed: ${errorEqual.message}`);
    }
  }, [errorDifferent, errorEqual]);

  const parseRecipients = (text: string): `0x${string}`[] => {
    return text
      .split(/[\n,;]/)
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0)
      .map((addr) => addr as `0x${string}`);
  };

  const parseAmounts = (text: string): string[] => {
    return text
      .split(/[\n,;]/)
      .map((amt) => amt.trim())
      .filter((amt) => amt.length > 0);
  };

  const handleDistribute = async () => {
    try {
      const recipientAddresses = parseRecipients(recipients);

      if (recipientAddresses.length === 0) {
        toast.error("Please enter at least one recipient address");
        return;
      }

      if (!reason.trim()) {
        toast.error("Please provide a reason for the distribution");
        return;
      }

      if (distributionMode === "equal") {
        if (!amount || parseFloat(amount) <= 0) {
          toast.error("Please enter a valid amount");
          return;
        }

        toast.loading("Distributing tokens...", { id: "distribute" });
        await distributeEqualFromVault(
          vaultType,
          recipientAddresses,
          amount,
          reason
        );
        toast.dismiss("distribute");
      } else {
        const amountValues = parseAmounts(amounts);

        if (amountValues.length !== recipientAddresses.length) {
          toast.error("Number of amounts must match number of recipients");
          return;
        }

        if (amountValues.some((amt) => parseFloat(amt) <= 0)) {
          toast.error("All amounts must be greater than zero");
          return;
        }

        toast.loading("Distributing tokens...", { id: "distribute" });
        await distributeFromVault(
          vaultType,
          recipientAddresses,
          amountValues,
          reason
        );
        toast.dismiss("distribute");
      }
    } catch (error) {
      toast.dismiss("distribute");
      console.error("Distribution error:", error);
    }
  };

  const selectedVault = vaults.find((v) => v.typeId === vaultType);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Vault Overview */}
      <div className="lg:col-span-1 space-y-4">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
          <h2 className="text-xl font-semibold text-purple-400 mb-4">
            Vault Statistics
          </h2>

          {vaultsLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            </div>
          ) : (
            <div className="space-y-4">
              {vaults.map((vault) => (
                <div
                  key={vault.typeId}
                  className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    vaultType === vault.typeId
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-gray-700 hover:border-purple-500/50"
                  }`}
                  onClick={() => setVaultType(vault.typeId)}
                >
                  <h3 className="font-semibold text-white mb-2">
                    {vault.type}
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Remaining:</span>
                      <span className="text-green-400 font-mono">
                        {Number(vault.remaining).toLocaleString()} MWT
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Spent:</span>
                      <span className="text-gray-400 font-mono">
                        {vault.spentPercentage.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all"
                      style={{ width: `${vault.spentPercentage}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Distribution Form */}
      <div className="lg:col-span-2">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
          <h2 className="text-xl font-semibold text-purple-400 mb-6">
            Distribute from {VAULT_NAMES[vaultType as keyof typeof VAULT_NAMES]}
          </h2>

          {selectedVault && (
            <div className="mb-6 p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-sm text-gray-300">
                Available:{" "}
                <span className="text-purple-400 font-mono font-semibold">
                  {Number(selectedVault.remaining).toLocaleString()} MWT
                </span>
              </p>
            </div>
          )}

          {/* Distribution Mode */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Distribution Mode
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setDistributionMode("equal")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  distributionMode === "equal"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-gray-700 hover:border-purple-500/50"
                }`}
              >
                <h3 className="font-semibold text-white mb-1">Equal Amount</h3>
                <p className="text-xs text-gray-400">
                  Same amount to all recipients
                </p>
              </button>
              <button
                onClick={() => setDistributionMode("different")}
                className={`p-4 rounded-lg border-2 transition-all ${
                  distributionMode === "different"
                    ? "border-purple-500 bg-purple-500/10"
                    : "border-gray-700 hover:border-purple-500/50"
                }`}
              >
                <h3 className="font-semibold text-white mb-1">
                  Different Amounts
                </h3>
                <p className="text-xs text-gray-400">
                  Specify individual amounts
                </p>
              </button>
            </div>
          </div>

          {/* Recipients */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Recipients <span className="text-red-400">*</span>
            </label>
            <textarea
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="0x1234...&#10;0x5678...&#10;Or paste comma/newline separated addresses"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
              rows={5}
            />
            <p className="mt-1 text-xs text-gray-400">
              {parseRecipients(recipients).length} recipient(s)
            </p>
          </div>

          {/* Amounts */}
          {distributionMode === "equal" ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amount per Recipient (MWT){" "}
                <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100"
                step="0.01"
                min="0"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              {amount && parseRecipients(recipients).length > 0 && (
                <p className="mt-1 text-sm text-gray-400">
                  Total:{" "}
                  <span className="text-purple-400 font-semibold">
                    {(
                      parseFloat(amount) * parseRecipients(recipients).length
                    ).toLocaleString()}{" "}
                    MWT
                  </span>
                </p>
              )}
            </div>
          ) : (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Amounts (MWT) <span className="text-red-400">*</span>
              </label>
              <textarea
                value={amounts}
                onChange={(e) => setAmounts(e.target.value)}
                placeholder="100&#10;200&#10;300&#10;One amount per recipient"
                className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                rows={5}
              />
              <p className="mt-1 text-xs text-gray-400">
                {parseAmounts(amounts).length} amount(s) specified
                {parseAmounts(amounts).length > 0 &&
                  ` - Total: ${parseAmounts(amounts)
                    .reduce((sum, amt) => sum + parseFloat(amt), 0)
                    .toLocaleString()} MWT`}
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Reason <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Weekly rewards for top players"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Submit Button */}
          <button
            onClick={handleDistribute}
            disabled={isPending || isConfirming}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? "Waiting for approval..."
              : isConfirming
              ? "Confirming transaction..."
              : "Distribute Tokens"}
          </button>
        </div>
      </div>
    </div>
  );
}
