"use client";

import React, { useState } from "react";
import { parseUnits, formatUnits } from "viem";
import toast from "react-hot-toast";
import { ORDER_BOOK_CONFIG } from "@/config/contracts";

export interface CreateSellOrderFormProps {
  onSubmit: (mwgAmount: bigint, pricePerMWG: bigint, expirySeconds: bigint, email?: string) => void;
  onApprove: (amount: bigint) => void;
  isPending?: boolean;
  isApprovePending?: boolean;
  currentMarketPrice?: bigint;
  minMWGAmount?: bigint;
  minBNBAmount?: bigint;
  mwgBalance?: bigint;
  allowance?: bigint;
}

export function CreateSellOrderForm({
  onSubmit,
  onApprove,
  isPending = false,
  isApprovePending = false,
  currentMarketPrice,
  minMWGAmount = ORDER_BOOK_CONFIG.MIN_MWG_AMOUNT,
  minBNBAmount = ORDER_BOOK_CONFIG.MIN_BNB_AMOUNT,
  mwgBalance = BigInt(0),
  allowance = BigInt(0),
}: CreateSellOrderFormProps) {
  const [mwgAmount, setMwgAmount] = useState("");
  const [pricePerMWG, setPricePerMWG] = useState("");
  const [expiryPreset, setExpiryPreset] = useState(86400); // 24 hours default
  const [email, setEmail] = useState("");

  const calculateBNBReceiving = () => {
    if (!mwgAmount || !pricePerMWG) return BigInt(0);
    try {
      const mwg = parseUnits(mwgAmount, 18);
      const price = parseUnits(pricePerMWG, 18);
      return (mwg * price) / parseUnits("1", 18);
    } catch {
      return BigInt(0);
    }
  };

  const bnbReceiving = calculateBNBReceiving();

  const needsApproval = () => {
    if (!mwgAmount) return false;
    try {
      const mwg = parseUnits(mwgAmount, 18);
      return allowance < mwg;
    } catch {
      return false;
    }
  };

  const handleApprove = () => {
    if (!mwgAmount) {
      toast.error("Please enter MWG amount first");
      return;
    }

    try {
      const mwg = parseUnits(mwgAmount, 18);
      onApprove(mwg);
    } catch (error) {
      console.error("Error approving:", error);
      toast.error("Invalid MWG amount");
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mwgAmount || !pricePerMWG) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (needsApproval()) {
      toast.error("Please approve MWG tokens first");
      return;
    }

    try {
      const mwg = parseUnits(mwgAmount, 18);
      const price = parseUnits(pricePerMWG, 18);
      const expiry = BigInt(expiryPreset);

      if (mwg < minMWGAmount) {
        toast.error(`Minimum order: ${formatUnits(minMWGAmount, 18)} MWG`);
        return;
      }

      if (bnbReceiving < minBNBAmount) {
        toast.error(`Minimum BNB: ${formatUnits(minBNBAmount, 18)} BNB`);
        return;
      }

      if (mwg > mwgBalance) {
        toast.error("Insufficient MWG balance");
        return;
      }

      // Validate email if provided
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error("Invalid email format");
        return;
      }

      onSubmit(mwg, price, expiry, email || undefined);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Invalid input values");
    }
  };

  const useSuggestedPrice = () => {
    if (currentMarketPrice) {
      setPricePerMWG(formatUnits(currentMarketPrice, 18));
    }
  };

  const useMaxBalance = () => {
    if (mwgBalance) {
      setMwgAmount(formatUnits(mwgBalance, 18));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* MWG Amount */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-300">
            MWG Amount to Sell
          </label>
          <button
            type="button"
            onClick={useMaxBalance}
            className="text-xs text-purple-400 hover:text-purple-300"
          >
            Use Max ({formatUnits(mwgBalance, 18)} MWG)
          </button>
        </div>
        <input
          type="number"
          step="any"
          value={mwgAmount}
          onChange={(e) => setMwgAmount(e.target.value)}
          placeholder={`Min: ${formatUnits(minMWGAmount, 18)} MWG`}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
          disabled={isPending || isApprovePending}
        />
        <p className="text-xs text-gray-400 mt-1">
          Available: {formatUnits(mwgBalance, 18)} MWG
        </p>
      </div>

      {/* Price Per MWG */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-300">
            Price Per MWG (in BNB)
          </label>
          {currentMarketPrice && (
            <button
              type="button"
              onClick={useSuggestedPrice}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Use Market Price
            </button>
          )}
        </div>
        <input
          type="number"
          step="any"
          value={pricePerMWG}
          onChange={(e) => setPricePerMWG(e.target.value)}
          placeholder="0.00001"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
          disabled={isPending || isApprovePending}
        />
        {currentMarketPrice && (
          <p className="text-xs text-gray-400 mt-1">
            Market price: {formatUnits(currentMarketPrice, 18)} BNB
          </p>
        )}
      </div>

      {/* Email for Notifications (Optional) */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <label className="block text-sm font-medium text-gray-300">
            Email for Fill Notifications (Optional)
          </label>
          <span className="text-xs text-gray-500" title="Get notified when your order is filled">
            ℹ️
          </span>
        </div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isPending || isApprovePending}
        />
        <p className="text-xs text-gray-400 mt-1">
          📧 Receive an email when someone fills your order
        </p>
      </div>

      {/* Expiry Time */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Order Expiry
        </label>
        <select
          value={expiryPreset}
          onChange={(e) => setExpiryPreset(Number(e.target.value))}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isPending || isApprovePending}
        >
          {ORDER_BOOK_CONFIG.EXPIRY_PRESETS.map((preset) => (
            <option key={preset.seconds} value={preset.seconds}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>

      {/* Order Preview */}
      <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-white mb-2">Order Preview</h4>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">MWG Amount:</span>
          <span className="text-white font-medium">{mwgAmount || "0"} MWG</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Price Per MWG:</span>
          <span className="text-white font-medium">{pricePerMWG || "0"} BNB</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">BNB You&apos;ll Receive:</span>
          <span className="text-green-400 font-bold">
            {formatUnits(bnbReceiving, 18)} BNB
          </span>
        </div>
        {needsApproval() && (
          <div className="flex justify-between text-sm pt-2 border-t border-gray-600">
            <span className="text-yellow-400">⚠️ Approval needed</span>
            <span className="text-xs text-gray-400">Current: {formatUnits(allowance, 18)} MWG</span>
          </div>
        )}
      </div>

      {/* Approval Button */}
      {needsApproval() && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={isApprovePending || !mwgAmount}
          className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:cursor-not-allowed"
        >
          {isApprovePending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Approving...
            </span>
          ) : (
            "1. Approve MWG Tokens"
          )}
        </button>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || needsApproval() || !mwgAmount || !pricePerMWG}
        className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:cursor-not-allowed"
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Creating Sell Order...
          </span>
        ) : needsApproval() ? (
          "2. Create Sell Order"
        ) : (
          "Create Sell Order"
        )}
      </button>

      <p className="text-xs text-gray-400 text-center">
        You will deposit {mwgAmount || "0"} MWG and receive {formatUnits(bnbReceiving, 18)} BNB when your order is filled
      </p>
    </form>
  );
}
