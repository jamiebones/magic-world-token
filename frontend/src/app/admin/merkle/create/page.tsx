"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CustomConnectButton } from "@/components/ConnectButton";
import { useCreateDistribution } from "@/hooks/useMerkleDistribution";
import { VaultType, type Allocation } from "@/types/merkle";

export default function CreateDistributionPage() {
  const router = useRouter();
  const { validateAllocations, createDistribution, loading, error } =
    useCreateDistribution();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    vaultType: VaultType.PLAYER_TASKS,
    durationInDays: 30,
    category: "",
    tags: "",
  });

  const [allocationsText, setAllocationsText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const parseAllocations = (): Allocation[] | null => {
    try {
      const lines = allocationsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const allocations: Allocation[] = [];

      for (const line of lines) {
        const parts = line.split(/[,\s]+/);
        if (parts.length !== 2) {
          throw new Error(
            `Invalid format: "${line}". Expected format: "address, amount"`
          );
        }

        const address = parts[0].trim();
        const amount = parseFloat(parts[1].trim());

        if (!address.startsWith("0x") || address.length !== 42) {
          throw new Error(`Invalid address: ${address}`);
        }

        if (isNaN(amount) || amount <= 0) {
          throw new Error(`Invalid amount: ${parts[1]}`);
        }

        allocations.push({ address, amount });
      }

      return allocations;
    } catch (err) {
      const error = err as Error;
      setValidationError(error.message);
      return null;
    }
  };

  const handleValidate = async () => {
    setValidationError(null);
    const allocations = parseAllocations();

    if (!allocations) return;

    try {
      const result = await validateAllocations(allocations);
      if (result.valid) {
        setSuccessMessage(
          `✓ Valid! ${result.totalRecipients} recipients, total: ${result.totalAmount} tokens`
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setValidationError(
          result.errors?.map((e) => e.message).join(", ") || "Validation failed"
        );
      }
    } catch (err) {
      const error = err as Error;
      setValidationError(error.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessMessage(null);

    const allocations = parseAllocations();
    if (!allocations) return;

    try {
      const result = await createDistribution({
        allocations,
        vaultType: formData.vaultType,
        durationInDays: formData.durationInDays,
        title: formData.title || undefined,
        description: formData.description || undefined,
        category: formData.category || undefined,
        tags: formData.tags
          ? formData.tags.split(",").map((t) => t.trim())
          : undefined,
      });

      setSuccessMessage(
        `Distribution created successfully! ID: ${result.distribution.distributionId}`
      );

      // Redirect to distribution details after 2 seconds
      setTimeout(() => {
        router.push(`/admin/merkle/${result.distribution.distributionId}`);
      }, 2000);
    } catch (err) {
      // Error is already set by the hook
      console.error("Failed to create distribution:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Header */}
      <header className="border-b border-purple-500/20 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
              Create Merkle Distribution
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Set up a new gas-efficient token distribution
            </p>
          </div>
          <CustomConnectButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <h2 className="text-xl font-bold text-white mb-4">
                Basic Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="e.g., Weekly Rewards Distribution"
                    className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    placeholder="Describe this distribution..."
                    rows={3}
                    className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Vault Type *
                    </label>
                    <select
                      value={formData.vaultType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          vaultType: e.target.value as VaultType,
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    >
                      <option value={VaultType.PLAYER_TASKS}>
                        Player Tasks (50%)
                      </option>
                      <option value={VaultType.SOCIAL_FOLLOWERS}>
                        Social Followers (5%)
                      </option>
                      <option value={VaultType.SOCIAL_POSTERS}>
                        Social Posters (15%)
                      </option>
                      <option value={VaultType.ECOSYSTEM_FUND}>
                        Ecosystem Fund (30%)
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Duration (days) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={formData.durationInDays}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          durationInDays: parseInt(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white focus:outline-none focus:border-purple-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Category
                    </label>
                    <input
                      type="text"
                      value={formData.category}
                      onChange={(e) =>
                        setFormData({ ...formData, category: e.target.value })
                      }
                      placeholder="e.g., rewards, airdrop"
                      className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Tags (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(e) =>
                        setFormData({ ...formData, tags: e.target.value })
                      }
                      placeholder="e.g., weekly, pvp, tournament"
                      className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Allocations */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-white">Allocations *</h2>
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={loading || !allocationsText}
                  className="px-4 py-2 bg-blue-500/20 border border-blue-500/50 rounded-lg text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
                >
                  Validate
                </button>
              </div>

              <p className="text-sm text-gray-400 mb-4">
                Enter one allocation per line in the format:{" "}
                <code className="text-purple-400">address, amount</code>
              </p>

              <textarea
                value={allocationsText}
                onChange={(e) => setAllocationsText(e.target.value)}
                placeholder="0x1234...5678, 100&#10;0xabcd...ef01, 250&#10;0x9876...5432, 75"
                rows={10}
                className="w-full px-4 py-2 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
                required
              />

              {validationError && (
                <div className="mt-4 p-4 bg-red-500/10 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm">{validationError}</p>
                </div>
              )}

              {successMessage && (
                <div className="mt-4 p-4 bg-green-500/10 border border-green-500/50 rounded-lg">
                  <p className="text-green-400 text-sm">{successMessage}</p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-2xl p-6">
                <div className="flex items-start gap-3">
                  <svg
                    className="w-6 h-6 text-red-400 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h3 className="text-red-400 font-semibold mb-1">
                      Failed to create distribution
                    </h3>
                    <p className="text-red-400/80 text-sm">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => router.back()}
                className="flex-1 px-6 py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !allocationsText}
                className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Creating..." : "Create Distribution"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
