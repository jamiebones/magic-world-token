"use client";

import { useState, useEffect } from "react";
import { RequireRole } from "@/components/RequireRole";
import {
  usePartnerVaultStats,
  useTokenBalance,
} from "@/hooks/useContractStats";
import { useAllocateToPartner } from "@/hooks/usePartnerVaultOperations";
import { CONTRACT_ADDRESSES } from "@/config/contracts";
import toast from "react-hot-toast";

export default function PartnerAllocatePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <RequireRole contract="vault" roleConstant="ADMIN_ROLE">
          <AllocationForm />
        </RequireRole>
      </main>
    </div>
  );
}

function AllocationForm() {
  const vaultStats = usePartnerVaultStats();
  const { balance: vaultBalance } = useTokenBalance(
    CONTRACT_ADDRESSES.PARTNER_VAULT as `0x${string}`
  );
  const { allocateToPartner, isPending, isConfirming, isSuccess, error } =
    useAllocateToPartner();

  const [partnerAddress, setPartnerAddress] = useState("");
  const [amount, setAmount] = useState("");

  useEffect(() => {
    if (isSuccess) {
      toast.success("Partner allocation successful!");
      setPartnerAddress("");
      setAmount("");
    }
  }, [isSuccess]);

  useEffect(() => {
    if (error) {
      toast.error(`Allocation failed: ${error.message}`);
    }
  }, [error]);

  const handleAllocate = async () => {
    if (!partnerAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      toast.error("Please enter a valid Ethereum address");
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (parseFloat(amount) > parseFloat(vaultStats.unallocated)) {
      toast.error("Amount exceeds unallocated balance");
      return;
    }

    toast.loading("Allocating to partner...", { id: "allocate" });

    try {
      await allocateToPartner(partnerAddress as `0x${string}`, amount);
      toast.dismiss("allocate");
    } catch (err) {
      toast.dismiss("allocate");
      console.error("Allocation error:", err);
    }
  };

  const isSubmitting = isPending || isConfirming;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Vault Statistics */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h2 className="text-xl font-semibold text-purple-400 mb-6">
          Vault Status
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Total Balance</p>
            <p className="text-2xl font-bold text-white font-mono">
              {Number(vaultBalance).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">MWT in vault</p>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-gray-700">
            <p className="text-sm text-gray-400 mb-1">Already Allocated</p>
            <p className="text-2xl font-bold text-yellow-400 font-mono">
              {Number(vaultStats.totalAllocated).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              MWT locked for partners
            </p>
          </div>

          <div className="p-4 bg-gray-900/50 rounded-lg border border-green-700">
            <p className="text-sm text-gray-400 mb-1">Available to Allocate</p>
            <p className="text-2xl font-bold text-green-400 font-mono">
              {Number(vaultStats.unallocated).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">MWT unallocated</p>
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
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
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <div>
              <p className="text-sm text-blue-200 font-semibold mb-1">
                Lockup Period
              </p>
              <p className="text-xs text-blue-300">
                Partners can withdraw their allocation after{" "}
                {vaultStats.lockupYears} years from allocation date
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Allocation Form */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white mb-2">
              New Partner Allocation
            </h2>
            <p className="text-sm text-gray-400">
              Allocate tokens to a new partner
            </p>
          </div>
          <div className="px-3 py-1 bg-purple-500/20 border border-purple-500/50 rounded-full text-xs text-purple-300">
            ADMIN_ROLE
          </div>
        </div>

        <div className="space-y-6">
          {/* Partner Address */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Partner Address <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={partnerAddress}
              onChange={(e) => setPartnerAddress(e.target.value)}
              placeholder="0x1234567890abcdef1234567890abcdef12345678"
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-gray-500">
              Enter the Ethereum address that will receive the allocation
            </p>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Allocation Amount (MWT) <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1000000"
              step="1"
              min="0"
              max={vaultStats.unallocated}
              className="w-full px-4 py-3 bg-gray-900/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-gray-500">
                Available: {Number(vaultStats.unallocated).toLocaleString()} MWT
              </span>
              {amount && parseFloat(amount) > 0 && (
                <button
                  onClick={() => setAmount(vaultStats.unallocated)}
                  className="text-purple-400 hover:text-purple-300 font-semibold"
                >
                  Use Max
                </button>
              )}
            </div>
          </div>

          {/* Warning */}
          {amount && parseFloat(amount) > 0 && (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-start">
                <svg
                  className="w-5 h-5 text-yellow-400 mt-0.5 mr-3"
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
                  <p className="text-sm text-yellow-200 font-semibold mb-1">
                    Important Information
                  </p>
                  <ul className="text-xs text-yellow-300 space-y-1">
                    <li>
                      • Partner can withdraw after 3 years from allocation date
                    </li>
                    <li>• Allocation cannot be reversed once confirmed</li>
                    <li>• Each partner can only be allocated once</li>
                    <li>
                      • Allocating {Number(amount).toLocaleString()} MWT to{" "}
                      {partnerAddress}
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handleAllocate}
            disabled={isSubmitting}
            className="w-full py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending
              ? "Waiting for approval..."
              : isConfirming
              ? "Confirming transaction..."
              : "Allocate to Partner"}
          </button>
        </div>
      </div>

      {/* Allocation Guidelines */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-purple-500/20">
        <h3 className="text-lg font-semibold text-white mb-4">
          Allocation Guidelines
        </h3>

        <div className="space-y-3 text-sm text-gray-300">
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">1.</span>
            <p>
              <span className="font-semibold">Verify Partner Address:</span>{" "}
              Double-check the address before allocating. Transactions cannot be
              reversed.
            </p>
          </div>
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">2.</span>
            <p>
              <span className="font-semibold">One Allocation Per Partner:</span>{" "}
              Each address can only receive one allocation. Plan accordingly.
            </p>
          </div>
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">3.</span>
            <p>
              <span className="font-semibold">3-Year Lockup:</span> Partners
              must wait 3 years from allocation date before withdrawal.
            </p>
          </div>
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">4.</span>
            <p>
              <span className="font-semibold">Emergency Withdrawal:</span> Admin
              can execute emergency withdrawal if vault is paused.
            </p>
          </div>
          <div className="flex items-start">
            <span className="text-purple-400 mr-2">5.</span>
            <p>
              <span className="font-semibold">Gas Costs:</span> Standard
              allocation transaction costs approximately 80,000-120,000 gas on
              BSC.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
