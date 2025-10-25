"use client";

import { useState } from "react";
import { RequireRole } from "@/components/RequireRole";
import {
  useBlacklistOperations,
  useBlacklistInfo,
  useUnblacklistTimelock,
  useMaxBlacklistBatchSize,
} from "@/hooks/useBlacklistOperations";
import toast from "react-hot-toast";
import { isAddress } from "viem";

export default function BlacklistPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RequireRole contract="token" roleConstant="BLACKLIST_MANAGER_ROLE">
          <BlacklistManager />
        </RequireRole>
      </main>
    </div>
  );
}

function BlacklistManager() {
  const [activeTab, setActiveTab] = useState<
    "single" | "batch" | "unblacklist" | "check" | "settings"
  >("single");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
          Blacklist Management
        </h1>
        <p className="text-gray-400">
          Manage token blacklist for fraud prevention and security
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-purple-500/20 overflow-hidden">
        <div className="flex border-b border-purple-500/20 overflow-x-auto">
          <button
            onClick={() => setActiveTab("single")}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "single"
                ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            Blacklist
          </button>
          <button
            onClick={() => setActiveTab("batch")}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "batch"
                ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            Batch Blacklist
          </button>
          <button
            onClick={() => setActiveTab("unblacklist")}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "unblacklist"
                ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            Unblacklist
          </button>
          <button
            onClick={() => setActiveTab("check")}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "check"
                ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            Check Status
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 px-4 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === "settings"
                ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-400"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            }`}
          >
            Settings
          </button>
        </div>

        <div className="p-6">
          {activeTab === "single" && <SingleBlacklistForm />}
          {activeTab === "batch" && <BatchBlacklistForm />}
          {activeTab === "unblacklist" && <UnblacklistForm />}
          {activeTab === "check" && <CheckBlacklistStatus />}
          {activeTab === "settings" && <BlacklistSettings />}
        </div>
      </div>
    </div>
  );
}

// Single Address Blacklist Form
function SingleBlacklistForm() {
  const [address, setAddress] = useState("");
  const [reason, setReason] = useState("");
  const { blacklistAddress, isPending, isConfirming, isSuccess, hash } =
    useBlacklistOperations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isAddress(address)) {
      toast.error("Invalid Ethereum address");
      return;
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    try {
      await blacklistAddress(address, reason);
      toast.success("Transaction submitted! Waiting for confirmation...");
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to blacklist address");
    }
  };

  // Reset form on success
  if (isSuccess) {
    setTimeout(() => {
      setAddress("");
      setReason("");
      toast.success("Address blacklisted successfully!");
    }, 1000);
  }

  return (
    <div className="space-y-6">
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-red-400 mt-0.5"
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
            <h3 className="text-red-400 font-semibold mb-1">Warning</h3>
            <p className="text-sm text-red-300">
              Blacklisted addresses cannot send tokens but can receive them.
              Unblacklisting requires a timelock period (default 3 days).
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Address to Blacklist
          </label>
          <input
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            disabled={isPending || isConfirming}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reason for Blacklisting
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Suspicious activity, fraud detection, etc."
            rows={3}
            className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            disabled={isPending || isConfirming}
          />
          <p className="text-xs text-gray-500 mt-1">
            This reason will be stored in the blockchain event log
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || isConfirming}
          className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isPending || isConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div>
              {isConfirming ? "Confirming..." : "Submitting..."}
            </span>
          ) : (
            "Blacklist Address"
          )}
        </button>
      </form>

      {hash && (
        <div className="text-sm text-gray-400">
          Transaction Hash:{" "}
          <a
            href={`https://testnet.bscscan.com/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-mono"
          >
            {hash.slice(0, 10)}...{hash.slice(-8)}
          </a>
        </div>
      )}
    </div>
  );
}

// Batch Blacklist Form
function BatchBlacklistForm() {
  const [addresses, setAddresses] = useState("");
  const [reason, setReason] = useState("");
  const { maxBatchSize } = useMaxBlacklistBatchSize();
  const { blacklistAddresses, isPending, isConfirming, isSuccess, hash } =
    useBlacklistOperations();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const addressList = addresses
      .split("\n")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);

    if (addressList.length === 0) {
      toast.error("Please provide at least one address");
      return;
    }

    if (addressList.length > maxBatchSize) {
      toast.error(`Maximum batch size is ${maxBatchSize} addresses`);
      return;
    }

    // Validate all addresses
    for (const addr of addressList) {
      if (!isAddress(addr)) {
        toast.error(`Invalid address: ${addr}`);
        return;
      }
    }

    if (!reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    try {
      await blacklistAddresses(addressList, reason);
      toast.success("Transaction submitted! Waiting for confirmation...");
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to batch blacklist addresses");
    }
  };

  if (isSuccess) {
    setTimeout(() => {
      setAddresses("");
      setReason("");
      toast.success("Addresses blacklisted successfully!");
    }, 1000);
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-blue-400 mt-0.5"
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
            <h3 className="text-blue-400 font-semibold mb-1">
              Batch Operations
            </h3>
            <p className="text-sm text-blue-300">
              Enter one address per line. Maximum {maxBatchSize} addresses per
              batch. Invalid or duplicate addresses will be skipped.
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Addresses to Blacklist (one per line)
          </label>
          <textarea
            value={addresses}
            onChange={(e) => setAddresses(e.target.value)}
            placeholder="0x1234...&#10;0x5678...&#10;0xabcd..."
            rows={10}
            className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono text-sm"
            disabled={isPending || isConfirming}
          />
          <p className="text-xs text-gray-500 mt-1">
            {addresses.split("\n").filter((a) => a.trim()).length} /{" "}
            {maxBatchSize} addresses
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Reason for Blacklisting
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g., Bulk fraud detection, automated flagging, etc."
            rows={2}
            className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            disabled={isPending || isConfirming}
          />
        </div>

        <button
          type="submit"
          disabled={isPending || isConfirming}
          className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isPending || isConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div>
              {isConfirming ? "Confirming..." : "Submitting..."}
            </span>
          ) : (
            "Batch Blacklist Addresses"
          )}
        </button>
      </form>

      {hash && (
        <div className="text-sm text-gray-400">
          Transaction Hash:{" "}
          <a
            href={`https://testnet.bscscan.com/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-mono"
          >
            {hash.slice(0, 10)}...{hash.slice(-8)}
          </a>
        </div>
      )}
    </div>
  );
}

// Unblacklist Form
function UnblacklistForm() {
  const [address, setAddress] = useState("");
  const [queriedAddress, setQueriedAddress] = useState<string>("");
  const { blacklistInfo, isLoading, refetch } =
    useBlacklistInfo(queriedAddress);
  const { timelock } = useUnblacklistTimelock();
  const {
    requestUnblacklist,
    executeUnblacklist,
    cancelUnblacklistRequest,
    isPending,
    isConfirming,
    hash,
  } = useBlacklistOperations();

  const handleLookup = () => {
    if (!isAddress(address)) {
      toast.error("Invalid Ethereum address");
      return;
    }
    setQueriedAddress(address);
  };

  const handleRequestUnblacklist = async () => {
    if (!queriedAddress) return;

    try {
      await requestUnblacklist(queriedAddress);
      toast.success(
        "Unblacklist request submitted! Waiting for confirmation..."
      );
      setTimeout(() => refetch(), 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to request unblacklist");
    }
  };

  const handleExecuteUnblacklist = async () => {
    if (!queriedAddress) return;

    try {
      await executeUnblacklist(queriedAddress);
      toast.success("Address unblacklisted successfully!");
      setTimeout(() => {
        refetch();
        setAddress("");
        setQueriedAddress("");
      }, 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to execute unblacklist");
    }
  };

  const handleCancelRequest = async () => {
    if (!queriedAddress) return;

    try {
      await cancelUnblacklistRequest(queriedAddress);
      toast.success("Unblacklist request cancelled!");
      setTimeout(() => refetch(), 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to cancel request");
    }
  };

  const canExecuteUnblacklist =
    blacklistInfo &&
    blacklistInfo.unblacklistRequestTime > 0 &&
    Date.now() / 1000 >= blacklistInfo.unblacklistRequestTime;

  return (
    <div className="space-y-6">
      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-green-400 mt-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div>
            <h3 className="text-green-400 font-semibold mb-1">
              Unblacklist Process
            </h3>
            <p className="text-sm text-green-300">
              Unblacklisting requires a{" "}
              {timelock ? Math.floor(timelock / 86400) : 3}-day timelock period
              for security. First request unblacklist, then execute after the
              timelock period.
            </p>
          </div>
        </div>
      </div>

      {/* Lookup Section */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Address to Unblacklist
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="0x..."
              className="flex-1 px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
              disabled={isPending || isConfirming || isLoading}
            />
            <button
              onClick={handleLookup}
              disabled={isLoading || isPending || isConfirming}
              className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              {isLoading ? "Loading..." : "Lookup"}
            </button>
          </div>
        </div>
      </div>

      {/* Status Display */}
      {queriedAddress && blacklistInfo && (
        <div className="space-y-4">
          {!blacklistInfo.blacklisted ? (
            <div className="bg-gray-800/50 border border-gray-500/20 rounded-lg p-6 text-center">
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">
                Not Blacklisted
              </h3>
              <p className="text-gray-400">
                This address is not currently blacklisted
              </p>
            </div>
          ) : (
            <>
              {/* Blacklisted Status */}
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <svg
                    className="w-8 h-8 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                  <div>
                    <h3 className="text-xl font-bold text-red-400">
                      BLACKLISTED
                    </h3>
                    <p className="text-sm text-gray-400 font-mono">
                      {queriedAddress}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 pt-4 border-t border-red-500/20">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Blacklisted At:</span>
                    <span className="text-white font-mono">
                      {new Date(
                        blacklistInfo.blacklistedAt * 1000
                      ).toLocaleString()}
                    </span>
                  </div>

                  {blacklistInfo.unblacklistRequestTime > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          Unblacklist Requested:
                        </span>
                        <span className="text-yellow-400 font-semibold">
                          Yes
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          Can Execute After:
                        </span>
                        <span className="text-white font-mono">
                          {new Date(
                            blacklistInfo.unblacklistRequestTime * 1000
                          ).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Status:</span>
                        <span
                          className={`font-semibold ${
                            canExecuteUnblacklist
                              ? "text-green-400"
                              : "text-yellow-400"
                          }`}
                        >
                          {canExecuteUnblacklist
                            ? "✓ Ready to Execute"
                            : "⏳ Timelock Active"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 gap-3">
                {blacklistInfo.unblacklistRequestTime === 0 ? (
                  <button
                    onClick={handleRequestUnblacklist}
                    disabled={isPending || isConfirming}
                    className="px-6 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    {isPending || isConfirming ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div>
                        {isConfirming ? "Confirming..." : "Submitting..."}
                      </span>
                    ) : (
                      `Request Unblacklist (${
                        timelock ? Math.floor(timelock / 86400) : 3
                      } day timelock)`
                    )}
                  </button>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                      onClick={handleExecuteUnblacklist}
                      disabled={
                        !canExecuteUnblacklist || isPending || isConfirming
                      }
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                    >
                      {isPending || isConfirming ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div>
                          {isConfirming ? "Confirming..." : "Executing..."}
                        </span>
                      ) : canExecuteUnblacklist ? (
                        "✓ Execute Unblacklist"
                      ) : (
                        "⏳ Timelock Active"
                      )}
                    </button>
                    <button
                      onClick={handleCancelRequest}
                      disabled={isPending || isConfirming}
                      className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                    >
                      {isPending || isConfirming ? (
                        <span className="flex items-center justify-center gap-2">
                          <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div>
                          Cancelling...
                        </span>
                      ) : (
                        "Cancel Request"
                      )}
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {hash && (
        <div className="text-sm text-gray-400">
          Transaction Hash:{" "}
          <a
            href={`https://testnet.bscscan.com/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 font-mono"
          >
            {hash.slice(0, 10)}...{hash.slice(-8)}
          </a>
        </div>
      )}
    </div>
  );
}

// Check Blacklist Status
function CheckBlacklistStatus() {
  const [checkAddress, setCheckAddress] = useState("");
  const [queriedAddress, setQueriedAddress] = useState<string>("");
  const { blacklistInfo, isLoading, refetch } =
    useBlacklistInfo(queriedAddress);
  const { timelock } = useUnblacklistTimelock();
  const {
    requestUnblacklist,
    executeUnblacklist,
    cancelUnblacklistRequest,
    isPending,
    isConfirming,
  } = useBlacklistOperations();

  const handleCheck = () => {
    if (!isAddress(checkAddress)) {
      toast.error("Invalid Ethereum address");
      return;
    }
    setQueriedAddress(checkAddress);
  };

  const handleRequestUnblacklist = async () => {
    if (!queriedAddress) return;

    try {
      await requestUnblacklist(queriedAddress);
      toast.success("Unblacklist request submitted!");
      setTimeout(() => refetch(), 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to request unblacklist");
    }
  };

  const handleExecuteUnblacklist = async () => {
    if (!queriedAddress) return;

    try {
      await executeUnblacklist(queriedAddress);
      toast.success("Unblacklist executed successfully!");
      setTimeout(() => refetch(), 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to execute unblacklist");
    }
  };

  const handleCancelRequest = async () => {
    if (!queriedAddress) return;

    try {
      await cancelUnblacklistRequest(queriedAddress);
      toast.success("Unblacklist request cancelled!");
      setTimeout(() => refetch(), 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to cancel request");
    }
  };

  const canExecuteUnblacklist =
    blacklistInfo &&
    blacklistInfo.unblacklistRequestTime > 0 &&
    Date.now() / 1000 >= blacklistInfo.unblacklistRequestTime;

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          type="text"
          value={checkAddress}
          onChange={(e) => setCheckAddress(e.target.value)}
          placeholder="Enter address to check..."
          className="flex-1 px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={handleCheck}
          disabled={isLoading}
          className="px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
        >
          Check Status
        </button>
      </div>

      {isLoading && (
        <div className="text-center py-12">
          <div className="animate-spin h-12 w-12 border-b-2 border-purple-400 rounded-full mx-auto"></div>
          <p className="text-gray-400 mt-4">Loading blacklist status...</p>
        </div>
      )}

      {blacklistInfo && queriedAddress && !isLoading && (
        <div className="space-y-4">
          {/* Status Card */}
          <div
            className={`p-6 rounded-lg border-2 ${
              blacklistInfo.blacklisted
                ? "bg-red-500/10 border-red-500/50"
                : "bg-green-500/10 border-green-500/50"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {blacklistInfo.blacklisted ? (
                  <svg
                    className="w-8 h-8 text-red-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                )}
                <div>
                  <h3
                    className={`text-xl font-bold ${
                      blacklistInfo.blacklisted
                        ? "text-red-400"
                        : "text-green-400"
                    }`}
                  >
                    {blacklistInfo.blacklisted
                      ? "BLACKLISTED"
                      : "NOT BLACKLISTED"}
                  </h3>
                  <p className="text-sm text-gray-400 font-mono">
                    {queriedAddress}
                  </p>
                </div>
              </div>
            </div>

            {blacklistInfo.blacklisted && (
              <div className="space-y-3 pt-4 border-t border-red-500/20">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Blacklisted At:</span>
                  <span className="text-white font-mono">
                    {new Date(
                      blacklistInfo.blacklistedAt * 1000
                    ).toLocaleString()}
                  </span>
                </div>

                {blacklistInfo.unblacklistRequestTime > 0 && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">
                        Unblacklist Requested:
                      </span>
                      <span className="text-yellow-400 font-mono">Yes</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Effective Time:</span>
                      <span className="text-white font-mono">
                        {new Date(
                          blacklistInfo.unblacklistRequestTime * 1000
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Status:</span>
                      <span
                        className={`font-semibold ${
                          canExecuteUnblacklist
                            ? "text-green-400"
                            : "text-yellow-400"
                        }`}
                      >
                        {canExecuteUnblacklist
                          ? "Ready to Execute"
                          : "Timelock Active"}
                      </span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {blacklistInfo.blacklisted && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {blacklistInfo.unblacklistRequestTime === 0 ? (
                <button
                  onClick={handleRequestUnblacklist}
                  disabled={isPending || isConfirming}
                  className="col-span-full px-6 py-3 bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Request Unblacklist (
                  {timelock ? Math.floor(timelock / 86400) : 3} day timelock)
                </button>
              ) : (
                <>
                  <button
                    onClick={handleExecuteUnblacklist}
                    disabled={
                      !canExecuteUnblacklist || isPending || isConfirming
                    }
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                  >
                    {canExecuteUnblacklist
                      ? "Execute Unblacklist"
                      : "Timelock Active"}
                  </button>
                  <button
                    onClick={handleCancelRequest}
                    disabled={isPending || isConfirming}
                    className="px-6 py-3 bg-red-500 hover:bg-red-600 disabled:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
                  >
                    Cancel Request
                  </button>
                  <button
                    onClick={() => refetch()}
                    className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Refresh Status
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Settings
function BlacklistSettings() {
  const [newTimelock, setNewTimelock] = useState("");
  const { timelock, isLoading, refetch } = useUnblacklistTimelock();
  const { setUnblacklistTimelock, isPending, isConfirming } =
    useBlacklistOperations();

  const MIN_TIMELOCK = 86400; // 1 day
  const MAX_TIMELOCK = 2592000; // 30 days

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const timelockValue = parseInt(newTimelock);

    if (isNaN(timelockValue)) {
      toast.error("Please enter a valid number");
      return;
    }

    if (timelockValue < MIN_TIMELOCK || timelockValue > MAX_TIMELOCK) {
      toast.error(`Timelock must be between 1 and 30 days`);
      return;
    }

    try {
      await setUnblacklistTimelock(timelockValue);
      toast.success("Timelock updated successfully!");
      setTimeout(() => {
        refetch();
        setNewTimelock("");
      }, 2000);
    } catch (error: unknown) {
      const err = error as { message?: string };
      toast.error(err.message || "Failed to update timelock");
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-900/50 border border-purple-500/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Current Settings
        </h3>

        {isLoading ? (
          <p className="text-gray-400">Loading...</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Unblacklist Timelock:</span>
              <span className="text-white font-mono">
                {timelock ? Math.floor(timelock / 86400) : "-"} days (
                {timelock || 0} seconds)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Min Timelock:</span>
              <span className="text-gray-500">1 day</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Max Timelock:</span>
              <span className="text-gray-500">30 days</span>
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            New Timelock Period (in seconds)
          </label>
          <input
            type="number"
            value={newTimelock}
            onChange={(e) => setNewTimelock(e.target.value)}
            placeholder="e.g., 259200 (3 days)"
            min={MIN_TIMELOCK}
            max={MAX_TIMELOCK}
            className="w-full px-4 py-3 bg-gray-900/50 border border-purple-500/30 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            disabled={isPending || isConfirming}
          />
          <p className="text-xs text-gray-500 mt-1">
            1 day = 86400 seconds | 3 days = 259200 seconds | 7 days = 604800
            seconds
          </p>
        </div>

        <button
          type="submit"
          disabled={isPending || isConfirming}
          className="w-full px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
        >
          {isPending || isConfirming ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin h-5 w-5 border-b-2 border-white rounded-full"></div>
              {isConfirming ? "Confirming..." : "Submitting..."}
            </span>
          ) : (
            "Update Timelock"
          )}
        </button>
      </form>

      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg
            className="w-5 h-5 text-yellow-400 mt-0.5"
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
            <h3 className="text-yellow-400 font-semibold mb-1">Note</h3>
            <p className="text-sm text-yellow-300">
              Changing the timelock period does not affect pending unblacklist
              requests. Only new requests will use the updated timelock.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
