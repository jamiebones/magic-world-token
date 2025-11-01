"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { type Address } from "viem";
import toast from "react-hot-toast";
import {
  CONTRACT_ADDRESSES,
  FEE_TIERS,
  getWBNBAddress,
  PANCAKESWAP_V3,
} from "@/config/contracts";
import { usePancakeSwapV3 } from "@/hooks/usePancakeSwapV3";
import {
  calculateRequiredAmounts,
  getTokenOrder,
  formatNumber,
  calculateMintMinFromPoolState,
  estimateUsageFromPoolState,
} from "@/utils/liquidityCalculations";
import { fetchBnbPriceWithRetry } from "@/utils/fetchBnbPrice";
import type { CalculatedAmounts, FeeTier } from "@/types/liquidity";

export default function AddLiquidityPage() {
  const { isConnected, chain } = useAccount();
  const {
    addLiquidity,
    checkPoolExists,
    getPoolState,
    getPoolBalances,
    createPool,
    isLoading,
    error,
  } = usePancakeSwapV3();

  // Form state - Production defaults
  const [targetPriceUSD, setTargetPriceUSD] = useState("0.0003");
  const [totalLiquidityUSD, setTotalLiquidityUSD] = useState("1000");
  const [bnbPriceUSD, setBnbPriceUSD] = useState("600");
  const [isFetchingBnbPrice, setIsFetchingBnbPrice] = useState(false);
  const [selectedFeeTier, setSelectedFeeTier] = useState<FeeTier>(
    FEE_TIERS.MEDIUM
  );
  const [priceRangePercent, setPriceRangePercent] = useState(50);
  const [slippageTolerance, setSlippageTolerance] = useState(0.5);

  // Fetch BNB price on component mount
  useEffect(() => {
    const fetchPrice = async () => {
      setIsFetchingBnbPrice(true);
      try {
        const price = await fetchBnbPriceWithRetry();
        setBnbPriceUSD(price.toString());
        toast.success(`BNB price updated: $${price.toFixed(2)}`);
      } catch (error) {
        console.error("Failed to fetch BNB price:", error);
        toast.error("Failed to fetch BNB price, using default $600");
      } finally {
        setIsFetchingBnbPrice(false);
      }
    };

    fetchPrice();
  }, []);

  // Calculated values
  const [calculated, setCalculated] = useState<CalculatedAmounts | null>(null);
  const [poolExists, setPoolExists] = useState<boolean | null>(null);
  const [poolBalancesState, setPoolBalancesState] = useState<{
    bnb: number;
    mwg: number;
  } | null>(null);
  const [poolSqrtPriceX96, setPoolSqrtPriceX96] = useState<bigint | null>(null);
  const [poolPrice, setPoolPrice] = useState<{
    bnbPerMWG: number;
    mwgPerBNB: number;
    mwgUsd: number;
  } | null>(null);
  const [poolTick, setPoolTick] = useState<number | null>(null);
  const [rangeCompatible, setRangeCompatible] = useState<boolean>(true);
  const [usagePreview, setUsagePreview] = useState<{
    usedBNB: number;
    usedMWG: number;
    oneSided: "BNB" | "MWG" | null;
    amount0Min?: string;
    amount1Min?: string;
  } | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isCheckingPool, setIsCheckingPool] = useState(false);

  // Transaction state
  const [txStatus, setTxStatus] = useState<
    "idle" | "approving" | "adding" | "success" | "error"
  >("idle");
  const [positionId, setPositionId] = useState<bigint | null>(null);

  /**
   * Calculate required amounts
   */
  const handleCalculate = () => {
    setIsCalculating(true);
    try {
      const result = calculateRequiredAmounts(
        parseFloat(targetPriceUSD),
        parseFloat(totalLiquidityUSD),
        parseFloat(bnbPriceUSD),
        selectedFeeTier,
        priceRangePercent,
        CONTRACT_ADDRESSES.TOKEN,
        getWBNBAddress(chain?.id)
      );
      setCalculated(result);
      toast.success("✅ Calculation completed successfully!");
      checkIfPoolExists(result);
    } catch (err) {
      console.error("Calculation error:", err);
      toast.error(
        `Calculation failed: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setIsCalculating(false);
    }
  };

  /**
   * Check if pool exists
   */
  const checkIfPoolExists = async (amounts: CalculatedAmounts) => {
    setIsCheckingPool(true);
    try {
      const { token0, token1 } = getTokenOrder(
        CONTRACT_ADDRESSES.TOKEN,
        getWBNBAddress(chain?.id)
      );

      const exists = await checkPoolExists(
        token0 as Address,
        token1 as Address,
        amounts.feeTier
      );
      setPoolExists(exists !== null);

      // If pool exists, fetch slot0 and prepare usage preview
      if (exists) {
        const state = await getPoolState(exists as Address);
        if (state?.sqrtPriceX96) {
          setPoolSqrtPriceX96(state.sqrtPriceX96);
          const isEmpty =
            !state.liquidity || state.liquidity.toString() === "0";

          // Compute and store current pool price
          // Must use BigInt for Q96 to avoid precision loss
          const Q96 = BigInt(2) ** BigInt(96);
          const sqrt = Number(state.sqrtPriceX96) / Number(Q96);
          const priceT1perT0 = sqrt * sqrt; // token1/token0 (this is WBNB/MWG ratio)

          const { token0 } = getTokenOrder(
            CONTRACT_ADDRESSES.TOKEN,
            getWBNBAddress(chain?.id)
          );
          const token0IsMWG =
            token0.toLowerCase() === CONTRACT_ADDRESSES.TOKEN.toLowerCase();

          // Calculate BNB per MWG correctly based on token order
          // sqrtPriceX96 represents sqrt(token1/token0)
          // priceT1perT0 = token1/token0
          // If token0 is MWG and token1 is WBNB: priceT1perT0 = WBNB/MWG
          // So if token0IsMWG is true: BNB per MWG = priceT1perT0
          // If token0IsMWG is false: MWG per BNB = priceT1perT0, so BNB per MWG = 1/priceT1perT0
          const bnbPerMWG = token0IsMWG
            ? priceT1perT0
            : priceT1perT0 === 0
            ? 0
            : 1 / priceT1perT0;

          const mwgPerBNB = bnbPerMWG === 0 ? 0 : 1 / bnbPerMWG;
          const mwgUsd = bnbPerMWG * parseFloat(bnbPriceUSD);

          console.log("🔍 Price Calculation Debug:");
          console.log("  sqrtPriceX96:", state.sqrtPriceX96.toString());
          console.log("  Q96:", Q96.toString());
          console.log("  sqrt:", sqrt);
          console.log("  priceT1perT0:", priceT1perT0);
          console.log("  token0IsMWG:", token0IsMWG);
          console.log("  bnbPerMWG:", bnbPerMWG);
          console.log("  bnbPriceUSD:", bnbPriceUSD);
          console.log("  mwgUsd:", mwgUsd);
          console.log("  poolTick:", state.tick);

          // CRITICAL WARNING: Check if pool was initialized with inverted price
          const expectedTickSign = bnbPerMWG < 1 ? "negative" : "positive";
          const actualTickSign = state.tick < 0 ? "negative" : "positive";
          if (expectedTickSign !== actualTickSign) {
            console.warn(
              "⚠️ POOL PRICE WARNING: Pool appears to be initialized with inverted price!"
            );
            console.warn(
              `  Expected tick to be ${expectedTickSign}, but it's ${actualTickSign}`
            );
            console.warn(
              `  Pool tick: ${state.tick}, implies MWG price: $${mwgUsd.toFixed(
                2
              )}`
            );
            console.warn(
              `  This pool is likely unusable - consider deploying a new pool with correct price`
            );
          }

          setPoolPrice({ bnbPerMWG, mwgPerBNB, mwgUsd });

          // CRITICAL: Check if calculated range is compatible with pool price
          const poolTickValue = state.tick;
          setPoolTick(poolTickValue);
          const rangeIsCompatible =
            poolTickValue >= amounts.tickLower &&
            poolTickValue <= amounts.tickUpper;
          setRangeCompatible(rangeIsCompatible);

          console.log("🔍 Pool compatibility check:", {
            poolTick: poolTickValue,
            calculatedTickLower: amounts.tickLower,
            calculatedTickUpper: amounts.tickUpper,
            compatible: rangeIsCompatible,
          });

          if (!rangeIsCompatible) {
            console.warn(
              "⚠️ WARNING: Your target price range is far from the current pool price!"
            );
            console.warn(
              "⚠️ This will result in a one-sided deposit or may fail."
            );
            console.warn(
              "⚠️ Consider using the current pool price instead of your target price."
            );
          }

          try {
            updateUsagePreview(amounts, state.sqrtPriceX96, isEmpty);
          } catch (e) {
            console.warn("Failed to prepare usage preview:", e);
          }
          // Fetch and map pool balances for UI
          try {
            const balances = await getPoolBalances(
              CONTRACT_ADDRESSES.TOKEN as Address,
              getWBNBAddress(chain?.id) as Address,
              amounts.feeTier
            );
            if (balances) {
              const token0IsMWG =
                balances.token0.toLowerCase() ===
                CONTRACT_ADDRESSES.TOKEN.toLowerCase();
              const mwgBal = token0IsMWG
                ? Number(balances.token0Balance) /
                  Math.pow(10, balances.token0Decimals)
                : Number(balances.token1Balance) /
                  Math.pow(10, balances.token1Decimals);
              const bnbBal = token0IsMWG
                ? Number(balances.token1Balance) /
                  Math.pow(10, balances.token1Decimals)
                : Number(balances.token0Balance) /
                  Math.pow(10, balances.token0Decimals);
              setPoolBalancesState({ bnb: bnbBal, mwg: mwgBal });
            } else {
              setPoolBalancesState(null);
            }
          } catch (e) {
            console.warn("Failed to fetch pool balances:", e);
            setPoolBalancesState(null);
          }
        } else {
          setPoolSqrtPriceX96(null);
          setUsagePreview(null);
          setPoolPrice(null);
          setPoolBalancesState(null);
        }
      } else {
        setPoolSqrtPriceX96(null);
        setUsagePreview(null);
        setPoolPrice(null);
        setPoolBalancesState(null);
      }
    } catch (err) {
      console.error("Error checking pool:", err);
      toast.error(
        `Failed to check pool: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setPoolExists(null);
      // setPoolAddress(null);
      setPoolSqrtPriceX96(null);
      setUsagePreview(null);
      setPoolPrice(null);
      setPoolBalancesState(null);
    } finally {
      setIsCheckingPool(false);
    }
  };

  const updateUsagePreview = (
    amounts: CalculatedAmounts,
    sqrtPriceX96: bigint,
    emptyPool: boolean
  ) => {
    // Map to token0/token1 perspective
    const { token0 } = getTokenOrder(
      CONTRACT_ADDRESSES.TOKEN,
      getWBNBAddress(chain?.id)
    );
    const token0IsMWG =
      token0.toLowerCase() === CONTRACT_ADDRESSES.TOKEN.toLowerCase();
    const amount0Desired = token0IsMWG
      ? amounts.mwgAmountWei
      : amounts.bnbAmountWei;
    const amount1Desired = token0IsMWG
      ? amounts.bnbAmountWei
      : amounts.mwgAmountWei;

    try {
      if (emptyPool) {
        // For an empty pool (no liquidity), show both tokens used as provided
        const usedBNBWei = token0IsMWG ? amount1Desired : amount0Desired;
        const usedMWGWei = token0IsMWG ? amount0Desired : amount1Desired;

        // Simple mins based on slippage relative to desired amounts
        const slippageFactor = 1 - slippageTolerance / 100;
        const amount0Min = BigInt(
          Math.floor(Number(amount0Desired) * slippageFactor)
        );
        const amount1Min = BigInt(
          Math.floor(Number(amount1Desired) * slippageFactor)
        );

        setUsagePreview({
          usedBNB: Number(usedBNBWei) / 1e18,
          usedMWG: Number(usedMWGWei) / 1e18,
          oneSided: null,
          amount0Min: amount0Min.toString(),
          amount1Min: amount1Min.toString(),
        });
        return;
      }

      const usage = estimateUsageFromPoolState({
        amount0Desired,
        amount1Desired,
        tickLower: amounts.tickLower,
        tickUpper: amounts.tickUpper,
        sqrtPriceX96,
      });

      // Convert back to BNB/MWG for display
      const usedBNBWei = token0IsMWG
        ? usage.usedAmount1Wei
        : usage.usedAmount0Wei;
      const usedMWGWei = token0IsMWG
        ? usage.usedAmount0Wei
        : usage.usedAmount1Wei;
      const usedBNB = Number(usedBNBWei) / 1e18;
      const usedMWG = Number(usedMWGWei) / 1e18;

      // Compute min amounts (for info only)
      const mins = calculateMintMinFromPoolState({
        amount0Desired,
        amount1Desired,
        tickLower: amounts.tickLower,
        tickUpper: amounts.tickUpper,
        sqrtPriceX96,
        slippageTolerance,
      });

      setUsagePreview({
        usedBNB,
        usedMWG,
        oneSided:
          usage.oneSided === "token0"
            ? token0IsMWG
              ? "MWG"
              : "BNB"
            : usage.oneSided === "token1"
            ? token0IsMWG
              ? "BNB"
              : "MWG"
            : null,
        amount0Min: mins.amount0Min.toString(),
        amount1Min: mins.amount1Min.toString(),
      });
    } catch (e) {
      console.warn("Failed to prepare usage preview:", e);
      setUsagePreview(null);
    }
  };

  /**
   * Handle add liquidity
   */
  const handleAddLiquidity = async () => {
    if (!calculated || !isConnected) return;

    try {
      setTxStatus("adding");

      const { token0, token1 } = getTokenOrder(
        CONTRACT_ADDRESSES.TOKEN,
        getWBNBAddress(chain?.id)
      );

      const token0IsMWG =
        token0.toLowerCase() === CONTRACT_ADDRESSES.TOKEN.toLowerCase();
      const amount0Desired = token0IsMWG
        ? calculated.mwgAmountWei
        : calculated.bnbAmountWei;
      const amount1Desired = token0IsMWG
        ? calculated.bnbAmountWei
        : calculated.mwgAmountWei;

      const tokenId = await addLiquidity({
        token0: token0 as Address,
        token1: token1 as Address,
        feeTier: calculated.feeTier,
        tickLower: calculated.tickLower,
        tickUpper: calculated.tickUpper,
        amount0Desired,
        amount1Desired,
        slippageTolerance,
        createPoolIfNeeded: !poolExists,
        sqrtPriceX96: calculated.sqrtPriceX96,
      });

      if (tokenId) {
        setPositionId(tokenId);
        setTxStatus("success");
        toast.success(
          `🎉 Liquidity added successfully! Position NFT ID: ${tokenId.toString()}`
        );
      } else {
        setTxStatus("error");
        toast.error("Failed to add liquidity - no position ID returned");
      }
    } catch (err) {
      console.error("Error adding liquidity:", err);
      toast.error(
        `Failed to add liquidity: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setTxStatus("error");
    }
  };

  /**
   * Reset form
   */
  const handleReset = () => {
    setTxStatus("idle");
    setPositionId(null);
    setCalculated(null);
    setPoolExists(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-white mb-2">Add Liquidity</h1>
          <p className="text-gray-300">
            PancakeSwap V3 • MWG/BNB • BSC Mainnet
          </p>
          {chain && (
            <div className="mt-2 inline-block px-3 py-1 bg-gray-800/50 rounded-full text-sm backdrop-blur-sm border border-purple-500/20">
              <span className="font-medium text-gray-300">Network:</span>{" "}
              <span
                className={
                  chain.id === 56 ? "text-green-400" : "text-yellow-400"
                }
              >
                {chain.name}
              </span>
            </div>
          )}
        </div>

        {/* Connection Warning */}
        {!isConnected && (
          <div className="mb-6 p-4 bg-yellow-900/20 border-l-4 border-yellow-400 rounded-r-lg backdrop-blur-sm">
            <p className="text-yellow-200 font-medium">
              🔌 Connect your wallet to continue
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border-l-4 border-red-400 rounded-r-lg backdrop-blur-sm">
            <p className="text-red-200 font-medium">❌ {error}</p>
          </div>
        )}

        {/* Success Display */}
        {txStatus === "success" && (
          <div className="mb-6 p-6 bg-green-900/20 border-l-4 border-green-400 rounded-r-lg backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-green-200 mb-2">
              ✅ Liquidity Added Successfully!
            </h3>
            {positionId && (
              <p className="text-green-800 mb-4">
                Position NFT ID:{" "}
                <span className="font-mono">{positionId.toString()}</span>
              </p>
            )}
            <button
              onClick={handleReset}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Add More Liquidity
            </button>
          </div>
        )}

        {/* Main Configuration Card */}
        {txStatus !== "success" && (
          <>
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6 border border-purple-500/20">
              <h2 className="text-2xl font-bold mb-6 text-white">
                Configuration
              </h2>

              <div className="space-y-6">
                {/* Quick Presets */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Quick Presets
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Small", value: "500" },
                      { label: "Medium", value: "1000" },
                      { label: "Large", value: "5000" },
                    ].map((preset) => (
                      <button
                        key={preset.value}
                        onClick={() => setTotalLiquidityUSD(preset.value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          totalLiquidityUSD === preset.value
                            ? "border-purple-500 bg-purple-500/20 text-white shadow-md"
                            : "border-gray-600 hover:border-purple-400 hover:shadow text-gray-300"
                        }`}
                      >
                        <div className="font-semibold">{preset.label}</div>
                        <div className="text-sm text-gray-400">
                          ${preset.value}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Total Liquidity */}
                {/* Total Liquidity */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Total Liquidity (USD)
                  </label>
                  <input
                    type="number"
                    step="1"
                    value={totalLiquidityUSD}
                    onChange={(e) => setTotalLiquidityUSD(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-900/50 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all text-lg"
                    placeholder="1000"
                  />
                  <p className="text-sm text-gray-400 mt-1">
                    Total USD value to provide (split between BNB and MWG)
                  </p>
                </div>

                {/* Two Column Layout for Advanced Settings */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Target Token Price */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Target MWG Price (USD)
                    </label>
                    <input
                      type="number"
                      step="0.00001"
                      value={targetPriceUSD}
                      onChange={(e) => setTargetPriceUSD(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900/50 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      placeholder="0.0003"
                    />
                  </div>

                  {/* BNB Price */}
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium text-gray-300 mb-2">
                      <span>Current BNB Price (USD)</span>
                      <button
                        onClick={async () => {
                          setIsFetchingBnbPrice(true);
                          try {
                            const price = await fetchBnbPriceWithRetry();
                            setBnbPriceUSD(price.toString());
                            toast.success(
                              `BNB price updated: $${price.toFixed(2)}`
                            );
                          } catch (error) {
                            console.error(
                              "Failed to refresh BNB price:",
                              error
                            );
                            toast.error("Failed to refresh BNB price");
                          } finally {
                            setIsFetchingBnbPrice(false);
                          }
                        }}
                        disabled={isFetchingBnbPrice}
                        className="text-xs text-purple-400 hover:text-purple-300 disabled:text-gray-500 flex items-center gap-1"
                        title="Refresh BNB price"
                      >
                        <svg
                          className={`w-3 h-3 ${
                            isFetchingBnbPrice ? "animate-spin" : ""
                          }`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                          />
                        </svg>
                        {isFetchingBnbPrice ? "Fetching..." : "Refresh"}
                      </button>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        value={bnbPriceUSD}
                        onChange={(e) => setBnbPriceUSD(e.target.value)}
                        disabled={isFetchingBnbPrice}
                        className="w-full px-4 py-3 bg-gray-900/50 border-2 border-gray-600 text-white rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="600"
                      />
                      {isFetchingBnbPrice && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <svg
                            className="animate-spin h-5 w-5 text-purple-400"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Auto-fetched from CoinGecko • Updated every minute
                    </p>
                  </div>
                </div>

                {/* Fee Tier */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Fee Tier
                  </label>
                  <div className="grid grid-cols-4 gap-3">
                    {Object.entries(FEE_TIERS).map(([name, value]) => (
                      <button
                        key={name}
                        onClick={() => setSelectedFeeTier(value)}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          selectedFeeTier === value
                            ? "border-purple-500 bg-purple-500/20 text-white shadow-md"
                            : "border-gray-600 hover:border-purple-400 text-gray-300"
                        }`}
                      >
                        <div className="font-semibold text-sm">
                          {(value / 10000).toFixed(2)}%
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{name}</div>
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    <span className="font-medium">Recommended:</span> 0.25% for
                    most token pairs
                  </p>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Price Range: ±{priceRangePercent}%
                  </label>
                  <input
                    type="range"
                    min="10"
                    max="150"
                    step="5"
                    value={priceRangePercent}
                    onChange={(e) =>
                      setPriceRangePercent(Number(e.target.value))
                    }
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>±10% Narrow</span>
                    <span className="font-medium text-purple-400">
                      ±{priceRangePercent}%
                    </span>
                    <span>±150% Wide</span>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Narrower ranges earn more fees but need rebalancing more
                    often
                  </p>
                </div>

                {/* Slippage */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    Slippage Tolerance
                  </label>
                  <div className="flex gap-3">
                    {[0.5, 1, 2, 5].map((value) => (
                      <button
                        key={value}
                        onClick={() => setSlippageTolerance(value)}
                        className={`flex-1 px-4 py-2 rounded-lg border-2 transition-all ${
                          slippageTolerance === value
                            ? "border-purple-500 bg-purple-500/20 text-white font-medium"
                            : "border-gray-600 hover:border-purple-400 text-gray-300"
                        }`}
                      >
                        {value}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculate Button */}
              <button
                onClick={handleCalculate}
                disabled={
                  isCalculating ||
                  !targetPriceUSD ||
                  !totalLiquidityUSD ||
                  !bnbPriceUSD
                }
                className="w-full mt-6 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed font-semibold transition-all text-lg shadow-lg hover:shadow-xl"
              >
                {isCalculating ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Calculating...
                  </span>
                ) : (
                  "🧮 Calculate Required Amounts"
                )}
              </button>
            </div>

            {/* Contracts in Use */}
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6 border border-purple-500/20">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-purple-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Contracts in Use
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* MWG Token */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-400">
                      MWG Token
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(CONTRACT_ADDRESSES.TOKEN);
                        toast.success("📋 MWG Token address copied!");
                      }}
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                      title="Copy address"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                  <a
                    href={`https://bscscan.com/address/${CONTRACT_ADDRESSES.TOKEN}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-gray-300 hover:text-purple-400 break-all transition-colors"
                  >
                    {CONTRACT_ADDRESSES.TOKEN}
                  </a>
                </div>

                {/* WBNB */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-400">
                      WBNB
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          getWBNBAddress(chain?.id)
                        );
                        toast.success("📋 WBNB address copied!");
                      }}
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                      title="Copy address"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                  <a
                    href={`https://bscscan.com/address/${getWBNBAddress(
                      chain?.id
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-gray-300 hover:text-purple-400 break-all transition-colors"
                  >
                    {getWBNBAddress(chain?.id)}
                  </a>
                </div>

                {/* Position Manager */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-400">
                      Position Manager
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(
                          PANCAKESWAP_V3.POSITION_MANAGER
                        );
                        toast.success("📋 Position Manager address copied!");
                      }}
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                      title="Copy address"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                  <a
                    href={`https://bscscan.com/address/${PANCAKESWAP_V3.POSITION_MANAGER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-gray-300 hover:text-purple-400 break-all transition-colors"
                  >
                    {PANCAKESWAP_V3.POSITION_MANAGER}
                  </a>
                </div>

                {/* Router */}
                <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-purple-400">
                      Router
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(PANCAKESWAP_V3.ROUTER);
                        toast.success("📋 Router address copied!");
                      }}
                      className="text-gray-400 hover:text-purple-400 transition-colors"
                      title="Copy address"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                  <a
                    href={`https://bscscan.com/address/${PANCAKESWAP_V3.ROUTER}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-gray-300 hover:text-purple-400 break-all transition-colors"
                  >
                    {PANCAKESWAP_V3.ROUTER}
                  </a>
                </div>
              </div>
            </div>

            {/* Calculation Results */}
            {calculated && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-6 border border-purple-500/20">
                <h2 className="text-xl font-semibold mb-4 text-white">
                  📊 Calculation Results
                </h2>

                <div className="space-y-4">
                  {/* Required Amounts */}
                  <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/20">
                    <h3 className="font-semibold text-purple-300 mb-2">
                      Required Token Amounts
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-400">BNB Needed</p>
                        <p className="text-xl font-bold text-white">
                          {formatNumber(calculated.bnbAmount, 6)} BNB
                        </p>
                        <p className="text-sm text-gray-500">
                          ≈ $
                          {formatNumber(
                            calculated.bnbAmount * parseFloat(bnbPriceUSD),
                            2
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-400">MWG Needed</p>
                        <p className="text-xl font-bold text-white">
                          {formatNumber(calculated.mwgAmount, 0)} MWG
                        </p>
                        <p className="text-sm text-gray-500">
                          ≈ $
                          {formatNumber(
                            calculated.mwgAmount * parseFloat(targetPriceUSD),
                            2
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Exchange Rate */}
                  <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700">
                    <h3 className="font-semibold text-gray-300 mb-2">
                      Exchange Rate at Target Price
                    </h3>
                    <div className="text-center">
                      <p className="text-sm text-gray-400">1 BNB ≈</p>
                      <p className="text-2xl font-bold text-purple-400">
                        {formatNumber(
                          parseFloat(bnbPriceUSD) / parseFloat(targetPriceUSD),
                          0
                        )}{" "}
                        MWG
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Based on target price of ${targetPriceUSD} per MWG
                      </p>
                    </div>
                  </div>

                  {/* At current pool price */}
                  {poolExists && poolSqrtPriceX96 && (
                    <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                      <h3 className="font-semibold text-amber-900 mb-2">
                        At Current Pool Price
                      </h3>

                      {/* Show if pool is empty but has a price */}
                      {poolBalancesState &&
                        poolBalancesState.bnb === 0 &&
                        poolBalancesState.mwg === 0 && (
                          <div className="mb-3 p-3 bg-yellow-100 border border-yellow-300 rounded">
                            <p className="text-sm text-yellow-900 font-medium">
                              ⚠️ Pool is empty but has an initialized price
                            </p>
                            <p className="text-xs text-yellow-800 mt-1">
                              Someone created this pool previously. The price
                              below is the last known price. You can provide
                              liquidity around this price, or choose a different
                              price range.
                            </p>
                          </div>
                        )}

                      {/* Critical warning if pool price seems inverted */}
                      {poolPrice && poolPrice.mwgUsd > 1000000 && (
                        <div className="mb-3 p-3 bg-red-100 border-2 border-red-500 rounded">
                          <p className="text-sm text-red-900 font-bold">
                            🚨 CRITICAL: Pool Initialized with Inverted Price!
                          </p>
                          <p className="text-xs text-red-800 mt-1">
                            The current pool price is{" "}
                            <strong>
                              ${formatNumber(poolPrice.mwgUsd, 0)}
                            </strong>{" "}
                            per MWG token. This is likely backwards. The pool
                            was probably initialized with the inverse of the
                            intended price.
                          </p>
                          <p className="text-xs text-red-800 mt-2 font-medium">
                            ⚠️ This pool is effectively unusable at this price.
                            You should either:
                          </p>
                          <ul className="text-xs text-red-800 mt-1 ml-4 list-disc">
                            <li>
                              Deploy a new pool with the correct initial price
                              (click button below)
                            </li>
                            <li>
                              Or if this price is correct, your target price of
                              ${targetPriceUSD} is incompatible
                            </li>
                          </ul>
                          <button
                            onClick={async () => {
                              if (
                                !confirm(
                                  `Create a NEW pool with 0.05% fee tier at $${targetPriceUSD} per MWG?\n\nThis will NOT fix the existing 0.25% fee pool. You'll need to update the fee tier in your UI to 500 (0.05%) after creation.`
                                )
                              ) {
                                return;
                              }

                              try {
                                const { token0 } = getTokenOrder(
                                  CONTRACT_ADDRESSES.TOKEN,
                                  getWBNBAddress(chain?.id)
                                );
                                const token0IsMWG =
                                  token0.toLowerCase() ===
                                  CONTRACT_ADDRESSES.TOKEN.toLowerCase();

                                // Calculate sqrtPriceX96 for target price
                                const bnbPerMWG =
                                  parseFloat(targetPriceUSD) /
                                  parseFloat(bnbPriceUSD);
                                const priceT1perT0 = token0IsMWG
                                  ? bnbPerMWG
                                  : 1 / bnbPerMWG;
                                const sqrtPrice = Math.sqrt(priceT1perT0);
                                const Q96 = BigInt(2) ** BigInt(96);
                                const sqrtPriceX96 = BigInt(
                                  Math.floor(sqrtPrice * Number(Q96))
                                );

                                console.log(
                                  "🏊 Creating new pool with correct price:",
                                  {
                                    feeTier: 500,
                                    targetPriceUSD: targetPriceUSD,
                                    bnbPerMWG,
                                    sqrtPriceX96: sqrtPriceX96.toString(),
                                  }
                                );

                                const poolAddress = await createPool(
                                  token0 as Address,
                                  token0IsMWG
                                    ? getWBNBAddress(chain?.id)
                                    : (CONTRACT_ADDRESSES.TOKEN as Address),
                                  500, // 0.05% fee tier
                                  sqrtPriceX96
                                );

                                alert(
                                  `✅ Pool created successfully at ${poolAddress}!\n\nNOTE: This is a 0.05% fee pool. Update the fee tier to 500 in your UI to use it.`
                                );
                                window.location.reload();
                              } catch (err) {
                                console.error("Failed to create pool:", err);
                                alert(
                                  `Failed to create pool: ${
                                    err instanceof Error
                                      ? err.message
                                      : "Unknown error"
                                  }`
                                );
                              }
                            }}
                            className="mt-3 w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded hover:bg-green-700 transition-colors"
                          >
                            🏊 Create New Pool with Correct Price (0.05% fee)
                          </button>
                        </div>
                      )}

                      {/* Warning when price range is incompatible with pool */}
                      {!rangeCompatible && poolPrice && (
                        <div className="mb-3 p-3 bg-orange-100 border-2 border-orange-500 rounded">
                          <p className="text-sm text-orange-900 font-bold">
                            ⚠️ Price Range Incompatible with Current Pool!
                          </p>
                          <p className="text-xs text-orange-800 mt-1">
                            Your target price (${targetPriceUSD}) creates a tick
                            range that doesn&apos;t include the current pool
                            tick ({poolTick}). This means liquidity addition
                            will likely fail or only use one token type.
                          </p>
                          <p className="text-xs text-orange-800 mt-2 font-medium">
                            ✅ Solution: Click the blue &quot;Use Current Pool
                            Price as Target&quot; button below, then click
                            &quot;Calculate&quot; again.
                          </p>
                          <p className="text-xs text-orange-700 mt-1">
                            Current pool price:{" "}
                            <strong>${poolPrice.mwgUsd.toFixed(6)}</strong> per
                            MWG
                          </p>
                        </div>
                      )}

                      {poolBalancesState && (
                        <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-gray-600">Pool BNB</p>
                            <p className="font-semibold">
                              {formatNumber(poolBalancesState.bnb, 6)} BNB
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">Pool MWG</p>
                            <p className="font-semibold">
                              {formatNumber(poolBalancesState.mwg, 0)} MWG
                            </p>
                          </div>
                        </div>
                      )}
                      {poolPrice && (
                        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                          <div>
                            <p className="text-gray-600">1 MWG =</p>
                            <p className="font-semibold">
                              {formatNumber(poolPrice.bnbPerMWG, 10)} BNB
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">1 BNB =</p>
                            <p className="font-semibold">
                              {formatNumber(poolPrice.mwgPerBNB, 2)} MWG
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-600">1 MWG ≈</p>
                            <p className="font-semibold">
                              ${formatNumber(poolPrice.mwgUsd, 6)} USD
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Button to use current pool price */}
                      {poolPrice &&
                        poolTick !== null &&
                        poolPrice.mwgUsd !== parseFloat(targetPriceUSD) && (
                          <button
                            onClick={() => {
                              const newPrice = poolPrice.mwgUsd.toFixed(6);
                              setTargetPriceUSD(newPrice);

                              // Instead of using percentage range, directly calculate ticks from pool tick
                              // Create a range of ±10000 ticks around current pool tick
                              const tickSpacing =
                                selectedFeeTier === 500 ? 10 : 50; // 0.05% = 10, 0.25% = 50
                              const tickRange = 10000;

                              // Round to valid tick spacing
                              const currentTickRounded =
                                Math.floor(poolTick / tickSpacing) *
                                tickSpacing;
                              const newTickLower =
                                currentTickRounded - tickRange;
                              const newTickUpper =
                                currentTickRounded + tickRange;

                              console.log(
                                "🎯 Creating range directly from pool tick:",
                                {
                                  poolTick,
                                  currentTickRounded,
                                  tickLower: newTickLower,
                                  tickUpper: newTickUpper,
                                  tickSpacing,
                                }
                              );

                              // Manually set the calculated amounts with correct ticks
                              setCalculated({
                                ...calculated!,
                                tickLower: newTickLower,
                                tickUpper: newTickUpper,
                              });

                              // Also update range to reflect this
                              // Approximate percentage based on ticks (not exact but close enough for display)
                              setPriceRangePercent(50);

                              alert(
                                `✅ Range updated to center around pool tick ${poolTick}!\nTick range: ${newTickLower} to ${newTickUpper}\n\nClick "Add Liquidity" to proceed.`
                              );
                            }}
                            className="mb-3 px-4 py-2 bg-blue-500 text-white text-sm font-medium rounded hover:bg-blue-600 transition-colors"
                          >
                            🎯 Fix Range to Center on Pool Tick
                          </button>
                        )}
                      {usagePreview?.oneSided ? (
                        <p className="text-amber-800 mb-2">
                          ⚠️ One-sided deposit expected: primarily{" "}
                          {usagePreview.oneSided} will be used in this range.
                        </p>
                      ) : (
                        <p className="text-amber-800 mb-2">
                          Balanced usage expected within your tick range.
                        </p>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">
                            Expected to spend now (BNB)
                          </p>
                          <p className="font-semibold">
                            {formatNumber(usagePreview?.usedBNB || 0, 6)} BNB
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">
                            Expected to spend now (MWG)
                          </p>
                          <p className="font-semibold">
                            {formatNumber(usagePreview?.usedMWG || 0, 0)} MWG
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-2">
                        Any unspent tokens remain in your wallet. Minimums will
                        adapt to pool price to avoid reverts.
                      </p>
                    </div>
                  )}

                  {/* Price Info */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Price Information
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Target Price:</span>
                        <span className="font-medium">
                          1 MWG = ${parseFloat(targetPriceUSD).toFixed(6)} USD
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Lower Range:</span>
                        <span className="font-medium">
                          $
                          {(
                            calculated.lowerPrice * parseFloat(bnbPriceUSD)
                          ).toFixed(6)}{" "}
                          USD
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Upper Range:</span>
                        <span className="font-medium">
                          $
                          {(
                            calculated.upperPrice * parseFloat(bnbPriceUSD)
                          ).toFixed(6)}{" "}
                          USD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Technical Details */}
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Technical Details
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex justify-between">
                        <span>Fee Tier:</span>
                        <span className="font-mono">
                          {(calculated.feeTier / 10000).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Tick Range:</span>
                        <span className="font-mono">
                          [{calculated.tickLower}, {calculated.tickUpper}]
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Current Tick:</span>
                        <span className="font-mono">
                          {calculated.currentTick}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Pool Status */}
                  {isCheckingPool ? (
                    <div className="text-center py-4">
                      <p className="text-gray-600">Checking pool status...</p>
                    </div>
                  ) : poolExists === true ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-800">
                        ✅ Pool exists! You can add liquidity directly.
                      </p>
                    </div>
                  ) : poolExists === false ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-800">
                        ⚠️ Pool doesn&apos;t exist yet. It will be created when
                        you add liquidity.
                      </p>
                    </div>
                  ) : null}

                  {/* Add Liquidity Button */}
                  <button
                    onClick={handleAddLiquidity}
                    disabled={
                      !isConnected || isLoading || txStatus === "adding"
                    }
                    className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold transition-colors text-lg"
                  >
                    {txStatus === "adding"
                      ? "⏳ Adding Liquidity..."
                      : !isConnected
                      ? "🔌 Connect Wallet First"
                      : "💧 Add Liquidity"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
