"use client";

import React, { useState, useEffect } from "react";
import { formatUnits, parseUnits } from "viem";
import { useAccount } from "wagmi";
import toast from "react-hot-toast";
import type { Order } from "@/types/orderbook";
import { OrderType, ORDER_TYPE_LABELS } from "@/types/orderbook";
import { useMWGBalance, useMWGAllowance, useApproveMWG } from "@/hooks/orderbook/useOrderBookActions";
import { useOrderBookTransactionToast } from "@/hooks/orderbook/useOrderBookToasts";
import { CONTRACT_ADDRESSES } from "@/config/contracts";

export interface FillOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onFill: (orderId: bigint, mwgAmount: bigint, bnbValue?: bigint) => void;
  isPending?: boolean;
}

export function FillOrderModal({
  order,
  isOpen,
  onClose,
  onFill,
  isPending = false,
}: FillOrderModalProps) {
  const { address } = useAccount();
  const [fillAmount, setFillAmount] = useState("");
  
  // For buy orders: check MWG balance and allowance
  const { balance: mwgBalance, isLoading: isLoadingBalance } = useMWGBalance(address);
  const { allowance: mwgAllowance, refetch: refetchAllowance } = useMWGAllowance(address, CONTRACT_ADDRESSES.ORDER_BOOK);
  const { approve, isPending: isApproving, isSuccess: isApproved, error: approveError } = useApproveMWG();

  // Show toast notifications for approval transaction
  useOrderBookTransactionToast(
    isApproving,
    isApproved,
    approveError,
    "Approving MWG tokens",
    "✅ MWG tokens approved successfully!"
  );

  if (!isOpen || !order) return null;

  const isBuyOrder = order.orderType === 0;
  const maxFill = order.remaining;

  // Refetch allowance when approval succeeds
  useEffect(() => {
    if (isApproved) {
      // Wait a bit for blockchain to update, then refetch
      const timer = setTimeout(() => {
        refetchAllowance();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isApproved, refetchAllowance]);

  const calculateRequiredAmount = () => {
    if (!fillAmount) return BigInt(0);
    try {
      const amount = parseUnits(fillAmount, 18);
      if (amount > maxFill) return BigInt(0);
      return (amount * order.pricePerMWG) / parseUnits("1", 18);
    } catch {
      return BigInt(0);
    }
  };

  const requiredAmount = calculateRequiredAmount();

  // Check if user needs to approve MWG for buy orders
  const fillAmountBigInt = fillAmount ? parseUnits(fillAmount, 18) : BigInt(0);
  const needsApproval = isBuyOrder && mwgAllowance !== undefined && fillAmountBigInt > mwgAllowance;
  // Only check balance if we have the balance data (undefined means still loading)
  const hasInsufficientBalance = isBuyOrder && mwgBalance !== undefined && fillAmountBigInt > BigInt(0) && fillAmountBigInt > mwgBalance;

  // Debug logging
  if (isBuyOrder && fillAmount) {
    console.log('=== Fill Buy Order Debug ===');
    console.log('Address:', address);
    console.log('Fill Amount:', fillAmount, '/', formatUnits(fillAmountBigInt, 18));
    console.log('MWG Balance (raw):', mwgBalance);
    console.log('MWG Balance:', mwgBalance !== undefined ? formatUnits(mwgBalance, 18) : 'undefined');
    console.log('Is Loading Balance:', isLoadingBalance);
    console.log('MWG Allowance:', mwgAllowance ? formatUnits(mwgAllowance, 18) : 'undefined');
    console.log('Needs Approval:', needsApproval);
    console.log('Has Insufficient Balance:', hasInsufficientBalance);
    console.log('Is Approving:', isApproving);
    console.log('Is Pending:', isPending);
    console.log('Is Approved (success):', isApproved);
    console.log('---');
    console.log('Show Approve Button?', needsApproval && !isApproving);
    console.log('Fill Order Button Disabled?', isPending || !fillAmount || hasInsufficientBalance || (isBuyOrder && needsApproval));
  }

  const handleApprove = async () => {
    try {
      // Approve max amount for convenience
      const maxAmount = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
      approve({ 
        spender: CONTRACT_ADDRESSES.ORDER_BOOK, 
        amount: maxAmount 
      });
      // Toast handled by transaction lifecycle
    } catch (error) {
      console.error("Approval error:", error);
      // Error handled by transaction lifecycle
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fillAmount) {
      toast.error("Please enter a fill amount");
      return;
    }

    try {
      const amount = parseUnits(fillAmount, 18);
      if (amount > maxFill) {
        toast.error("Amount exceeds remaining order size");
        return;
      }

      if (hasInsufficientBalance) {
        toast.error("Insufficient MWG balance");
        return;
      }

      if (needsApproval) {
        toast.error("Please approve MWG tokens first");
        return;
      }
      
      if (isBuyOrder) {
        // Filling buy order: send MWG, receive BNB
        onFill(order.orderId, amount);
      } else {
        // Filling sell order: send BNB, receive MWG
        onFill(order.orderId, amount, requiredAmount);
      }
      
      setFillAmount("");
      onClose();
    } catch (error) {
      console.error("Error filling order:", error);
      toast.error("Invalid fill amount or transaction failed");
    }
  };

  const fillAll = () => {
    setFillAmount(formatUnits(maxFill, 18));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl max-w-md w-full border border-purple-500/30 shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-gray-700">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-white mb-1">
                Fill {ORDER_TYPE_LABELS[order.orderType]} Order
              </h3>
              <p className="text-sm text-gray-400">
                Order #{order.orderId.toString()}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Order Info */}
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Price per MWG:</span>
              <span className="text-white font-medium">{formatUnits(order.pricePerMWG, 18)} BNB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Available:</span>
              <span className="text-white font-medium">{formatUnits(maxFill, 18)} MWG</span>
            </div>
            {isBuyOrder && mwgBalance !== undefined && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-400">Your MWG Balance:</span>
                  <span className={`font-medium ${hasInsufficientBalance ? 'text-red-400' : 'text-white'}`}>
                    {formatUnits(mwgBalance, 18)} MWG
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Approved:</span>
                  <span className="text-white font-medium">
                    {mwgAllowance !== undefined 
                      ? (mwgAllowance >= BigInt("1000000000000000000000000") // Check if it's max approval
                          ? "Unlimited" 
                          : formatUnits(mwgAllowance, 18)) + " MWG"
                      : '...'
                    }
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Fill Amount */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-300">
                Amount to Fill (MWG)
              </label>
              <button
                type="button"
                onClick={fillAll}
                className="text-xs text-purple-400 hover:text-purple-300"
              >
                Fill All
              </button>
            </div>
            <input
              type="number"
              step="any"
              value={fillAmount}
              onChange={(e) => setFillAmount(e.target.value)}
              placeholder={`Max: ${formatUnits(maxFill, 18)}`}
              className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
              disabled={isPending}
            />
          </div>

          {/* Transaction Preview */}
          <div className="bg-gray-700/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-white text-sm mb-2">Transaction Preview</h4>
            {isBuyOrder ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">You Send:</span>
                  <span className="text-red-400 font-medium">{fillAmount || "0"} MWG</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">You Receive:</span>
                  <span className="text-green-400 font-medium">
                    {formatUnits(requiredAmount, 18)} BNB
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">You Send:</span>
                  <span className="text-red-400 font-medium">
                    {formatUnits(requiredAmount, 18)} BNB
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">You Receive:</span>
                  <span className="text-green-400 font-medium">{fillAmount || "0"} MWG</span>
                </div>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending || isApproving}
              className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white font-medium py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            {isBuyOrder && needsApproval && !isApproving ? (
              <button
                type="button"
                onClick={handleApprove}
                disabled={isApproving}
                className="flex-1 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
              >
                {isApproving ? "Approving..." : "1. Approve MWG"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isPending || !fillAmount || hasInsufficientBalance || (isBuyOrder && needsApproval)}
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
                title={hasInsufficientBalance ? `Insufficient MWG balance. You have ${mwgBalance !== undefined ? formatUnits(mwgBalance, 18) : '0'} MWG but need ${fillAmount || '0'} MWG` : ''}
              >
                {isPending ? "Processing..." : 
                 hasInsufficientBalance ? "Insufficient MWG Balance" :
                 isBuyOrder && needsApproval ? "2. Fill Order" : 
                 "Fill Order"}
              </button>
            )}
          </div>
          
          {/* Warning message for insufficient balance */}
          {isBuyOrder && hasInsufficientBalance && fillAmount && (
            <div className="mt-2 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400 text-center">
                ⚠️ You need {fillAmount} MWG tokens but only have {mwgBalance !== undefined ? formatUnits(mwgBalance, 18) : '0'} MWG
              </p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
