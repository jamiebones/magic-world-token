"use client";

import React, { useState, useEffect } from "react";
import { parseUnits, formatUnits } from "viem";
import toast from "react-hot-toast";
import { ORDER_BOOK_CONFIG } from "@/config/contracts";
import { fetchBnbPrice } from "@/utils/fetchBnbPrice";

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
  const [priceUsd, setPriceUsd] = useState("");

  // Allow only valid decimal number input
  const handleDecimalInput = (value: string, setter: (v: string) => void) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      setter(value);
    }
  };
  const [expiryPreset, setExpiryPreset] = useState(86400);
  const [email, setEmail] = useState("");
  const [bnbUsdPrice, setBnbUsdPrice] = useState<number | null>(null);

  // Fetch BNB price in USD
  useEffect(() => {
    const getBnbPrice = async () => {
      try {
        const price = await fetchBnbPrice();
        setBnbUsdPrice(price);
      } catch (error) {
        console.error('Failed to fetch BNB price:', error);
      }
    };
    getBnbPrice();
    const interval = setInterval(getBnbPrice, 60000);
    return () => clearInterval(interval);
  }, []);

  // Derive BNB price per MWG from user's USD price input
  const pricePerMWGinBNB = (priceUsd && bnbUsdPrice && bnbUsdPrice > 0)
    ? parseFloat(priceUsd) / bnbUsdPrice
    : 0;

  const pricePerMWGBigInt = (() => {
    if (pricePerMWGinBNB <= 0) return BigInt(0);
    try {
      return parseUnits(pricePerMWGinBNB.toFixed(18), 18);
    } catch {
      return BigInt(0);
    }
  })();

  const bnbReceiving = (() => {
    if (!mwgAmount || pricePerMWGBigInt === BigInt(0)) return BigInt(0);
    try {
      const mwg = parseUnits(mwgAmount, 18);
      return (mwg * pricePerMWGBigInt) / parseUnits("1", 18);
    } catch {
      return BigInt(0);
    }
  })();

  const totalValueUsd = mwgAmount && priceUsd
    ? parseFloat(mwgAmount) * parseFloat(priceUsd)
    : 0;

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

  const useSuggestedPrice = () => {
    if (currentMarketPrice && bnbUsdPrice) {
      const bnbPrice = parseFloat(formatUnits(currentMarketPrice, 18));
      const usd = bnbPrice * bnbUsdPrice;
      setPriceUsd(usd.toFixed(6));
    }
  };

  const useMaxBalance = () => {
    if (mwgBalance) {
      setMwgAmount(formatUnits(mwgBalance, 18));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mwgAmount || !priceUsd) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (!bnbUsdPrice || bnbUsdPrice <= 0) {
      toast.error("BNB price not available. Please try again.");
      return;
    }

    if (needsApproval()) {
      toast.error("Please approve MWG tokens first");
      return;
    }

    try {
      const mwg = parseUnits(mwgAmount, 18);
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

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error("Invalid email format");
        return;
      }

      onSubmit(mwg, pricePerMWGBigInt, expiry, email || undefined);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Invalid input values");
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
          type="text"
          inputMode="decimal"
          value={mwgAmount}
          onChange={(e) => handleDecimalInput(e.target.value, setMwgAmount)}
          placeholder={`Min: ${formatUnits(minMWGAmount, 18)} MWG`}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
          disabled={isPending || isApprovePending}
        />
      </div>

      {/* Price Per MWG in USD */}
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium text-gray-300">
            Price Per MWG (in USD)
          </label>
          {currentMarketPrice && bnbUsdPrice && (
            <button
              type="button"
              onClick={useSuggestedPrice}
              className="text-xs text-purple-400 hover:text-purple-300"
            >
              Use Market Price
            </button>
          )}
        </div>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={priceUsd}
            onChange={(e) => handleDecimalInput(e.target.value, setPriceUsd)}
            placeholder="0.01"
            className="w-full pl-8 pr-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            required
            disabled={isPending || isApprovePending}
          />
        </div>
        {priceUsd && bnbUsdPrice && (
          <p className="text-xs text-gray-400 mt-1">
            ≈ {pricePerMWGinBNB.toFixed(10)} BNB per MWG
            <span className="text-gray-500 ml-2">(1 BNB = ${bnbUsdPrice.toFixed(2)})</span>
          </p>
        )}
      </div>

      {/* Email for Notifications */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Email for Notifications <span className="text-gray-500">(optional)</span>
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          disabled={isPending || isApprovePending}
        />
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

      {/* Order Summary */}
      <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
        <h4 className="font-medium text-white mb-2">Order Summary</h4>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">MWG Amount:</span>
          <span className="text-white font-medium">{mwgAmount || "0"} MWG</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Price per MWG:</span>
          <span className="text-white font-medium">${priceUsd || "0"}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Total Value (USD):</span>
          <span className="text-white font-medium">${totalValueUsd.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-600 pt-2">
          <span className="text-gray-400 font-medium">BNB You&apos;ll Receive:</span>
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
          {isApprovePending ? "Approving..." : "1. Approve MWG Tokens"}
        </button>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || needsApproval() || !mwgAmount || !priceUsd || !bnbUsdPrice}
        className="w-full bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:cursor-not-allowed"
      >
        {isPending
          ? "Creating Sell Order..."
          : needsApproval()
          ? "2. Create Sell Order"
          : `Create Sell Order — ${formatUnits(bnbReceiving, 18)} BNB`}
      </button>
    </form>
  );
}
