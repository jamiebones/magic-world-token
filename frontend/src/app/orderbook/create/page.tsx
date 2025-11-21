"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAccount, useBalance } from "wagmi";
import { useRouter } from "next/navigation";
import { parseUnits } from "viem";
import toast from "react-hot-toast";
import { CreateBuyOrderForm } from "@/components/orderbook/CreateBuyOrderForm";
import { CreateSellOrderForm } from "@/components/orderbook/CreateSellOrderForm";
import { useCreateBuyOrder, useCreateSellOrder } from "@/hooks/orderbook/useOrderBookActions";
import { useBestSellPrice, useBestBuyPrice, useMinimumAmounts, useOrderBookPaused } from "@/hooks/orderbook/useOrderBook";
import { useOrderBookTransactionToast, copyToClipboard } from "@/hooks/orderbook/useOrderBookToasts";
import { useMWGBalance, useMWGAllowance, useApproveMWG } from "@/hooks/orderbook/useOrderBookActions";
import { CONTRACT_ADDRESSES } from "@/config/contracts";

export default function CreateOrderPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const { data: bnbBalanceData } = useBalance({ address });
  const bnbBalance = bnbBalanceData?.value;
  const { bestSell } = useBestSellPrice();
  const { bestBuy } = useBestBuyPrice();
  const { minMWGAmount, minBNBAmount } = useMinimumAmounts();
  const { isPaused } = useOrderBookPaused();
  
  // Tab state
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  
  // Buy order hooks
  const { createBuyOrder, isPending: isBuyPending, isSuccess: isBuySuccess, hash: buyHash, error: buyError } = useCreateBuyOrder();
  
  // Sell order hooks
  const { balance: mwgBalance } = useMWGBalance(address);
  const { allowance } = useMWGAllowance(address, CONTRACT_ADDRESSES.ORDER_BOOK);
  const { approve, isPending: isApprovePending } = useApproveMWG();
  const { createSellOrder, isPending: isSellPending, isSuccess: isSellSuccess, hash: sellHash, error: sellError } = useCreateSellOrder();

  const [showSuccess, setShowSuccess] = useState(false);

  const isPending = orderType === "buy" ? isBuyPending : isSellPending;
  const isSuccess = orderType === "buy" ? isBuySuccess : isSellSuccess;
  const error = orderType === "buy" ? buyError : sellError;

  // Show transaction toast notifications
  useOrderBookTransactionToast(
    isPending,
    isSuccess,
    error,
    orderType === "buy" ? "Creating buy order" : "Creating sell order",
    orderType === "buy" ? "✅ Buy order created successfully! Redirecting..." : "✅ Sell order created successfully! Redirecting..."
  );

  // Redirect to my-orders after successful creation
  useEffect(() => {
    if (isSuccess) {
      setShowSuccess(true);
      const timer = setTimeout(() => {
        router.push("/orderbook/my-orders");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isSuccess, router]);

  const handleCreateBuyOrder = (
    mwgAmount: bigint,
    pricePerMWG: bigint,
    expirySeconds: bigint,
    bnbValue: bigint
  ) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (isPaused) {
      toast.error("⚠️ Order book is currently paused");
      return;
    }

    // Check if user has enough BNB
    if (bnbBalance && bnbBalance < bnbValue) {
      toast.error(`Insufficient BNB balance. Required: ${(Number(bnbValue) / 1e18).toFixed(6)} BNB`);
      return;
    }
    
    createBuyOrder({
      mwgAmount,
      pricePerMWG,
      expirySeconds,
      bnbValue,
    });
  };

  const handleCreateSellOrder = (
    mwgAmount: bigint,
    pricePerMWG: bigint,
    expirySeconds: bigint
  ) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }

    if (isPaused) {
      toast.error("⚠️ Order book is currently paused");
      return;
    }

    // Check if user has enough MWG
    if (mwgBalance && mwgBalance < mwgAmount) {
      toast.error(`Insufficient MWG balance. Required: ${(Number(mwgAmount) / 1e18).toFixed(2)} MWG`);
      return;
    }

    // Check allowance
    if (allowance && allowance < mwgAmount) {
      toast.error("Please approve MWG tokens first");
      return;
    }
    
    createSellOrder({
      mwgAmount,
      pricePerMWG,
      expirySeconds,
    });
  };

  const handleApprove = async (amount: bigint) => {
    if (!isConnected) {
      toast.error("Please connect your wallet");
      return;
    }
    
    try {
      await approve({ spender: CONTRACT_ADDRESSES.ORDER_BOOK, amount });
      toast.success("MWG tokens approved successfully!");
    } catch (error) {
      console.error("Approval error:", error);
      toast.error("Failed to approve MWG tokens");
    }
  };

  // Redirect if not connected
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
        <main className="container mx-auto px-4 py-8 sm:py-12">
          <div className="max-w-2xl mx-auto">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-8 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">
                Wallet Not Connected
              </h2>
              <p className="text-gray-300 mb-6">
                Please connect your wallet to create buy orders
              </p>
              <Link
                href="/orderbook"
                className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-all"
              >
                Back to Order Book
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      {/* Paused Banner */}
      {isPaused && (
        <div className="bg-red-500/20 border-b border-red-500/30 p-4">
          <p className="text-center text-red-400 font-medium">
            ⚠️ Order Book is currently paused. You cannot create orders at this time.
          </p>
        </div>
      )}

      <main className="container mx-auto px-4 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          {/* Back Button */}
          <Link
            href="/orderbook"
            className="inline-flex items-center text-purple-400 hover:text-purple-300 mb-6 transition-colors"
          >
            <svg
              className="w-5 h-5 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Order Book
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 mb-2">
              Create Order
            </h1>
            <p className="text-gray-400">
              {orderType === "buy" 
                ? "Deposit BNB and specify how much MWG you want to buy" 
                : "Deposit MWG and specify how much BNB you want to receive"}
            </p>
          </div>

          {/* Order Type Tabs */}
          <div className="mb-6 flex gap-2 bg-gray-800/50 p-1 rounded-lg">
            <button
              onClick={() => setOrderType("buy")}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all ${
                orderType === "buy"
                  ? "bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🟢 Buy MWG
            </button>
            <button
              onClick={() => setOrderType("sell")}
              className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all ${
                orderType === "sell"
                  ? "bg-gradient-to-r from-red-600 to-pink-600 text-white shadow-lg"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              🔴 Sell MWG
            </button>
          </div>

          {/* Success Message */}
          {showSuccess && hash && (
            <div className="mb-6 bg-green-500/20 border border-green-500/30 rounded-xl p-6">
              <div className="flex items-start gap-3">
                <span className="text-3xl">✅</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-green-400 mb-2">
                    Order Created Successfully!
                  </h3>
                  <p className="text-sm text-gray-300 mb-3">
                    Your buy order has been created. Redirecting to your orders...
                  </p>
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://bscscan.com/tx/${hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      View transaction on BSCScan →
                    </a>
                    <button
                      onClick={() => copyToClipboard(hash, "Transaction hash")}
                      className="text-gray-400 hover:text-gray-300 text-xs"
                      title="Copy transaction hash"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Info Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            {orderType === "buy" ? (
              <>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
                  <p className="text-sm text-gray-400 mb-1">Your BNB Balance</p>
                  <p className="text-xl font-bold text-white">
                    {bnbBalance ? (Number(bnbBalance) / 1e18).toFixed(6) : "0.000000"} BNB
                  </p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
                  <p className="text-sm text-gray-400 mb-1">Best Sell Price</p>
                  <p className="text-xl font-bold text-white">
                    {bestSell?.price
                      ? (Number(bestSell.price) / 1e18).toFixed(8)
                      : "N/A"}{" "}
                    BNB
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
                  <p className="text-sm text-gray-400 mb-1">Your MWG Balance</p>
                  <p className="text-xl font-bold text-white">
                    {mwgBalance ? (Number(mwgBalance) / 1e18).toFixed(2) : "0.00"} MWG
                  </p>
                </div>
                <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-4">
                  <p className="text-sm text-gray-400 mb-1">Best Buy Price</p>
                  <p className="text-xl font-bold text-white">
                    {bestBuy?.price
                      ? (Number(bestBuy.price) / 1e18).toFixed(8)
                      : "N/A"}{" "}
                    BNB
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Form Card */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-purple-500/20 p-6 sm:p-8">
            {orderType === "buy" ? (
              <CreateBuyOrderForm
                onSubmit={handleCreateBuyOrder}
                isPending={isPending}
                currentMarketPrice={bestSell?.price}
                minMWGAmount={minMWGAmount}
                minBNBAmount={minBNBAmount}
              />
            ) : (
              <CreateSellOrderForm
                onSubmit={handleCreateSellOrder}
                onApprove={handleApprove}
                isPending={isPending}
                isApprovePending={isApprovePending}
                currentMarketPrice={bestBuy?.price}
                minMWGAmount={minMWGAmount}
                minBNBAmount={minBNBAmount}
                mwgBalance={mwgBalance}
                allowance={allowance}
              />
            )}
          </div>

          {/* Info Section */}
          <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
            <h3 className="text-lg font-bold text-blue-400 mb-3">
              ℹ️ How Buy Orders Work
            </h3>
            <ul className="space-y-2 text-sm text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>
                  You deposit BNB and specify the amount of MWG you want to buy and
                  the price per MWG
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>
                  When someone fills your order, they send you MWG and receive your
                  BNB
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>
                  Orders can be partially filled - you&apos;ll receive MWG proportionally
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>
                  You can cancel active orders anytime to get your BNB back
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400 mt-1">•</span>
                <span>
                  Set expiry time to automatically cancel if not filled in time
                </span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
