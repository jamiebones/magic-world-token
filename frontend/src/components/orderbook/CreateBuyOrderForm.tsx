"use client";

import React, { useState, useEffect } from "react";
import { parseUnits, formatUnits } from "viem";
import toast from "react-hot-toast";
import { ORDER_BOOK_CONFIG } from "@/config/contracts";

export interface CreateBuyOrderFormProps {
  onSubmit: (mwgAmount: bigint, pricePerMWG: bigint, expirySeconds: bigint, bnbValue: bigint) => void;
  isPending?: boolean;
  currentMarketPrice?: bigint;
  minMWGAmount?: bigint;
  minBNBAmount?: bigint;
}

export function CreateBuyOrderForm({
  onSubmit,
  isPending = false,
  currentMarketPrice,
  minMWGAmount = ORDER_BOOK_CONFIG.MIN_MWG_AMOUNT,
  minBNBAmount = ORDER_BOOK_CONFIG.MIN_BNB_AMOUNT,
}: CreateBuyOrderFormProps) {
  const [mwgAmount, setMwgAmount] = useState("");
  const [pricePerMWG, setPricePerMWG] = useState("");
  const [expiryPreset, setExpiryPreset] = useState(86400); // 24 hours default

  const calculateBNBRequired = () => {
    if (!mwgAmount || !pricePerMWG) return BigInt(0);
    try {
      const mwg = parseUnits(mwgAmount, 18);
      const price = parseUnits(pricePerMWG, 18);
      return (mwg * price) / parseUnits("1", 18);
    } catch {
      return BigInt(0);
    }
  };

  const bnbRequired = calculateBNBRequired();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mwgAmount || !pricePerMWG) {
      toast.error("Please fill in all required fields");
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

      if (bnbRequired < minBNBAmount) {
        toast.error(`Minimum BNB: ${formatUnits(minBNBAmount, 18)} BNB`);
        return;
      }

      onSubmit(mwg, price, expiry, bnbRequired);
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* MWG Amount */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          MWG Amount to Buy
        </label>
        <input
          type="number"
          step="any"
          value={mwgAmount}
          onChange={(e) => setMwgAmount(e.target.value)}
          placeholder={`Min: ${formatUnits(minMWGAmount, 18)} MWG`}
          className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
          required
          disabled={isPending}
        />
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
          disabled={isPending}
        />
        {currentMarketPrice && (
          <p className="text-xs text-gray-400 mt-1">
            Market price: {formatUnits(currentMarketPrice, 18)} BNB
          </p>
        )}
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
          disabled={isPending}
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
          <span className="text-gray-400">Price per MWG:</span>
          <span className="text-white font-medium">{pricePerMWG || "0"} BNB</span>
        </div>
        <div className="flex justify-between text-sm border-t border-gray-600 pt-2">
          <span className="text-gray-400 font-medium">BNB Required:</span>
          <span className="text-green-400 font-bold">
            {formatUnits(bnbRequired, 18)} BNB
          </span>
        </div>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isPending || !mwgAmount || !pricePerMWG}
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-4 px-6 rounded-lg transition-all disabled:cursor-not-allowed"
      >
        {isPending ? "Creating Order..." : "Create Buy Order"}
      </button>

      {/* Info Text */}
      <p className="text-xs text-gray-400 text-center">
        You will deposit {formatUnits(bnbRequired, 18)} BNB. When filled, you&apos;ll
        receive MWG tokens.
      </p>
    </form>
  );
}
