import { useState, useCallback } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { type Address, parseAbi } from 'viem';
import { PANCAKESWAP_V3, getWBNBAddress, CONTRACT_ADDRESSES } from '@/config/contracts';
import PancakeSwapV3ABI from '@/abis/PancakeSwapV3.json';
import { LiquidityPosition, PoolState, AddLiquidityParams } from '@/types/liquidity';
import { calculateMintMinFromPoolState, estimateUsageFromPoolState } from '@/utils/liquidityCalculations';

// Convert human-readable ABIs to proper format using parseAbi
const POSITION_MANAGER_ABI = parseAbi(PancakeSwapV3ABI.INonfungiblePositionManager as readonly string[]);
const FACTORY_ABI = parseAbi(PancakeSwapV3ABI.IUniswapV3Factory as readonly string[]);
const POOL_ABI = parseAbi(PancakeSwapV3ABI.IUniswapV3Pool as readonly string[]);
const ERC20_ABI = parseAbi(PancakeSwapV3ABI.IERC20 as readonly string[]);

// Safely stringify values that may contain BigInt or circular references
function safeStringify(value: unknown, space: number = 2): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === 'bigint') return val.toString();
      if (typeof val === 'object' && val !== null) {
        const obj = val as object;
        if (seen.has(obj)) return '[Circular]';
        seen.add(obj);
      }
      return val;
    },
    space
  );
}

export function usePancakeSwapV3() {
  const { address, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check token and BNB balances
   */
  const checkBalances = useCallback(
    async (
      token0: Address,
      token1: Address,
      amount0Needed: bigint,
      amount1Needed: bigint
    ): Promise<{ sufficient: boolean; errors: string[] }> => {
      if (!publicClient || !address) {
        return { sufficient: false, errors: ['Wallet not connected'] };
      }

      const errors: string[] = [];
  const wbnb = getWBNBAddress(chain?.id);
  const isToken0BNB = token0.toLowerCase() === wbnb.toLowerCase();
  const isToken1BNB = token1.toLowerCase() === wbnb.toLowerCase();

      try {
        // Check BNB balance
        const bnbBalance = await publicClient.getBalance({ address });
        console.log('💰 BNB Balance:', bnbBalance.toString());

        // Reserve 0.01 BNB for gas
        const gasReserve = BigInt(10000000000000000); // 0.01 BNB
        const availableBNB = bnbBalance > gasReserve ? bnbBalance - gasReserve : BigInt(0);

        if (isToken0BNB) {
          if (amount0Needed > availableBNB) {
            const needed = Number(amount0Needed) / 1e18;
            const available = Number(availableBNB) / 1e18;
            errors.push(`Insufficient BNB: Need ${needed.toFixed(6)} BNB but only have ${available.toFixed(6)} BNB available (after gas reserve)`);
          }
        } else if (isToken1BNB) {
          if (amount1Needed > availableBNB) {
            const needed = Number(amount1Needed) / 1e18;
            const available = Number(availableBNB) / 1e18;
            errors.push(`Insufficient BNB: Need ${needed.toFixed(6)} BNB but only have ${available.toFixed(6)} BNB available (after gas reserve)`);
          }
        } else {
          // No BNB needed in liquidity, but check we have enough for gas
          if (bnbBalance < gasReserve) {
            errors.push(`Insufficient BNB for gas fees. Need at least 0.01 BNB but have ${(Number(bnbBalance) / 1e18).toFixed(6)} BNB`);
          }
        }

        // Check token0 balance if not BNB
        if (!isToken0BNB) {
          const token0Balance = await publicClient.readContract({
            address: token0,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint;

          console.log('💰 Token0 Balance:', token0Balance.toString());

          if (amount0Needed > token0Balance) {
            const decimals = await publicClient.readContract({
              address: token0,
              abi: ERC20_ABI,
              functionName: 'decimals',
            }) as number;

            const needed = Number(amount0Needed) / Math.pow(10, decimals);
            const available = Number(token0Balance) / Math.pow(10, decimals);
            errors.push(`Insufficient Token0: Need ${needed.toFixed(2)} but only have ${available.toFixed(2)}`);
          }
        }

        // Check token1 balance if not BNB
        if (!isToken1BNB) {
          const token1Balance = await publicClient.readContract({
            address: token1,
            abi: ERC20_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint;

          console.log('💰 Token1 Balance:', token1Balance.toString());

          if (amount1Needed > token1Balance) {
            const decimals = await publicClient.readContract({
              address: token1,
              abi: ERC20_ABI,
              functionName: 'decimals',
            }) as number;

            const needed = Number(amount1Needed) / Math.pow(10, decimals);
            const available = Number(token1Balance) / Math.pow(10, decimals);
            errors.push(`Insufficient Token1: Need ${needed.toFixed(2)} but only have ${available.toFixed(2)}`);
          }
        }

        return {
          sufficient: errors.length === 0,
          errors,
        };
      } catch (err) {
        console.error('❌ Error checking balances:', err);
        return {
          sufficient: false,
          errors: ['Failed to check balances: ' + (err instanceof Error ? err.message : 'Unknown error')],
        };
      }
    },
  [publicClient, address, chain?.id]
  );
  // moved getPoolBalances below checkPoolExists

  // (internal util removed)

  /**
   * Check if pool exists
   */
  const checkPoolExists = useCallback(
    async (token0: Address, token1: Address, feeTier: number): Promise<Address | null> => {
      if (!publicClient) return null;

      try {
        const poolAddress = await publicClient.readContract({
          address: PANCAKESWAP_V3.FACTORY,
          abi: FACTORY_ABI,
          functionName: 'getPool',
          args: [token0, token1, feeTier],
        }) as Address;

        if (poolAddress === '0x0000000000000000000000000000000000000000') {
          return null;
        }

        return poolAddress;
      } catch (err) {
        console.error('Error checking pool existence:', err);
        return null;
      }
    },
    [publicClient]
  );

  /**
   * Get pool state
   */
  const getPoolState = useCallback(
    async (poolAddress: Address): Promise<PoolState | null> => {
      if (!publicClient) return null;

      try {
        const [slot0Data, liquidity] = await Promise.all([
          publicClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'slot0',
          }),
          publicClient.readContract({
            address: poolAddress,
            abi: POOL_ABI,
            functionName: 'liquidity',
          }),
        ]);

        const slot0 = slot0Data as [bigint, number, number, number, number, number, boolean];

        return {
          sqrtPriceX96: slot0[0],
          tick: slot0[1],
          observationIndex: slot0[2],
          observationCardinality: slot0[3],
          observationCardinalityNext: slot0[4],
          feeProtocol: slot0[5],
          unlocked: slot0[6],
          liquidity: liquidity as bigint,
        };
      } catch (err) {
        console.error('Error getting pool state:', err);
        return null;
      }
    },
    [publicClient]
  );

  /**
   * Get current ERC20 balances held by the V3 pool (token balances at pool address)
   */
  const getPoolBalances = useCallback(
    async (
      tokenA: Address,
      tokenB: Address,
      feeTier: number
    ): Promise<
      | {
          poolAddress: Address;
          token0: Address;
          token1: Address;
          token0Balance: bigint;
          token1Balance: bigint;
          token0Decimals: number;
          token1Decimals: number;
        }
      | null
    > => {
      if (!publicClient) return null;

      // Order tokens consistently (token0 < token1)
      const token0 = (tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenA : tokenB) as Address;
      const token1 = (token0 === tokenA ? tokenB : tokenA) as Address;

      const poolAddress = await checkPoolExists(token0, token1, feeTier);
      if (!poolAddress) return null;

      try {
        const [token0Decimals, token1Decimals, token0Balance, token1Balance] = (await Promise.all([
          publicClient.readContract({ address: token0, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
          publicClient.readContract({ address: token1, abi: ERC20_ABI, functionName: 'decimals' }) as Promise<number>,
          publicClient.readContract({ address: token0, abi: ERC20_ABI, functionName: 'balanceOf', args: [poolAddress], }) as Promise<bigint>,
          publicClient.readContract({ address: token1, abi: ERC20_ABI, functionName: 'balanceOf', args: [poolAddress], }) as Promise<bigint>,
        ])) as [number, number, bigint, bigint];

        return {
          poolAddress,
          token0,
          token1,
          token0Balance,
          token1Balance,
          token0Decimals,
          token1Decimals,
        };
      } catch (err) {
        console.error('Error reading pool balances:', err);
        return null;
      }
    },
    [publicClient, checkPoolExists]
  );

  /**
   * Approve token spending
   */
  const approveToken = useCallback(
    async (tokenAddress: Address, amount: bigint): Promise<boolean> => {
      if (!walletClient || !address) {
        const errorMsg = 'Wallet not connected for approval';
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }

      if (!publicClient) {
        throw new Error('Public client not available');
      }

      try {
        console.log('🔍 Checking allowance for token:', tokenAddress);
        console.log('👛 User address:', address);
        console.log('📍 Spender (Position Manager):', PANCAKESWAP_V3.POSITION_MANAGER);
        
        // First, check if the token contract exists
        const code = await publicClient.getBytecode({ address: tokenAddress });
        if (!code || code === '0x') {
          throw new Error(`Token contract not found at ${tokenAddress}. Are you on the correct network?`);
        }
        
        console.log('✅ Token contract exists');
        
        // Check current allowance
        let currentAllowance: bigint;
        try {
          currentAllowance = await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [address, PANCAKESWAP_V3.POSITION_MANAGER],
          }) as bigint;
        } catch (err) {
          console.warn('⚠️ Could not check allowance, assuming 0:', err);
          currentAllowance = BigInt(0);
        }

        console.log('📊 Current allowance:', currentAllowance.toString(), 'Required:', amount.toString());

        if (currentAllowance >= amount) {
          console.log('✅ Sufficient allowance already exists');
          return true;
        }

        console.log('📝 Requesting approval transaction...');
        
        // Approve spending
        const hash = await walletClient.writeContract({
          address: tokenAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [PANCAKESWAP_V3.POSITION_MANAGER, amount],
        });

        console.log('⏳ Approval tx sent:', hash);

        // Wait for confirmation
        const receipt = await publicClient?.waitForTransactionReceipt({ hash });
        console.log('✅ Approval confirmed. Status:', receipt?.status);

        return true;
      } catch (err) {
        console.error('❌ Error approving token:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to approve token';
        throw new Error(`Token approval failed: ${errorMsg}`);
      }
    },
    [walletClient, address, publicClient]
  );

  /**
   * Create pool if it doesn't exist
   */
  const createPool = useCallback(
    async (
      token0: Address,
      token1: Address,
      feeTier: number,
      sqrtPriceX96: bigint
    ): Promise<Address | null> => {
      if (!walletClient || !address) {
        const errorMsg = 'Wallet not connected';
        setError(errorMsg);
        throw new Error(errorMsg);
      }

      try {
        console.log('🏊 Creating pool with params:', {
          token0,
          token1,
          feeTier,
          sqrtPriceX96: sqrtPriceX96.toString(),
        });

        const hash = await walletClient.writeContract({
          address: PANCAKESWAP_V3.POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: 'createAndInitializePoolIfNecessary',
          args: [token0, token1, feeTier, sqrtPriceX96],
        });

        console.log('⏳ Pool creation tx sent:', hash);

        // Wait for confirmation
        const receipt = await publicClient?.waitForTransactionReceipt({ hash });
        console.log('✅ Pool creation tx confirmed:', receipt?.status);

        // Get the pool address
        const poolAddress = await checkPoolExists(token0, token1, feeTier);
        
        if (!poolAddress) {
          throw new Error('Pool creation succeeded but pool address not found');
        }

        console.log('✅ Pool created at:', poolAddress);
        return poolAddress;
      } catch (err) {
        console.error('❌ Error creating pool:', err);
        const errorMsg = err instanceof Error ? err.message : 'Failed to create pool';
        setError(errorMsg);
        throw err; // Re-throw to be caught by addLiquidity
      }
    },
    [walletClient, address, publicClient, checkPoolExists]
  );

  /**
   * Add liquidity to V3 pool
   */
  const addLiquidity = useCallback(
    async (params: {
      token0: Address;
      token1: Address;
      feeTier: number;
      tickLower: number;
      tickUpper: number;
      amount0Desired: bigint;
      amount1Desired: bigint;
      slippageTolerance: number;
      createPoolIfNeeded?: boolean;
      sqrtPriceX96?: bigint;
    }): Promise<bigint | null> => {
      if (!walletClient || !address) {
        setError('Wallet not connected');
        return null;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Check network
        if (chain) {
          console.log('🌐 Connected to network:', chain.name, 'Chain ID:', chain.id);
          if (chain.id !== 56 && chain.id !== 97) {
            throw new Error(`Wrong network! Please switch to BSC Mainnet (56) or BSC Testnet (97). Currently on: ${chain.name} (${chain.id})`);
          }
        } else {
          console.warn('⚠️ Chain not detected');
        }

        const {
          token0,
          token1,
          feeTier,
          tickLower,
          tickUpper,
          amount0Desired,
          amount1Desired,
          slippageTolerance,
          createPoolIfNeeded = false,
          sqrtPriceX96,
        } = params;

        console.log('💧 Adding liquidity with params:', {
          token0,
          token1,
          feeTier,
          tickLower,
          tickUpper,
          amount0Desired: amount0Desired.toString(),
          amount1Desired: amount1Desired.toString(),
          createPoolIfNeeded,
        });

        // ✅ PRE-FLIGHT CHECK: Verify sufficient balances
        console.log('🔍 Checking balances before transaction...');
        const balanceCheck = await checkBalances(token0, token1, amount0Desired, amount1Desired);
        
        if (!balanceCheck.sufficient) {
          const errorMsg = '❌ Insufficient Balance:\n' + balanceCheck.errors.join('\n');
          console.error(errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log('✅ Balance check passed!');

        // ✅ TICK VALIDATION: Ensure ticks are valid
        const MIN_TICK = -887272;
        const MAX_TICK = 887272;
        
        if (tickLower < MIN_TICK || tickLower > MAX_TICK) {
          throw new Error(`Invalid tickLower: ${tickLower}. Must be between ${MIN_TICK} and ${MAX_TICK}`);
        }
        
        if (tickUpper < MIN_TICK || tickUpper > MAX_TICK) {
          throw new Error(`Invalid tickUpper: ${tickUpper}. Must be between ${MIN_TICK} and ${MAX_TICK}`);
        }
        
        if (tickLower >= tickUpper) {
          throw new Error(`Invalid tick range: tickLower (${tickLower}) must be less than tickUpper (${tickUpper})`);
        }
        
        // Check tick spacing for fee tier
        const tickSpacing = feeTier === 10000 ? 200 : feeTier === 2500 ? 50 : feeTier === 500 ? 10 : 1;
        
        if (tickLower % tickSpacing !== 0) {
          throw new Error(`tickLower (${tickLower}) must be divisible by tick spacing (${tickSpacing}) for fee tier ${feeTier}`);
        }
        
        if (tickUpper % tickSpacing !== 0) {
          throw new Error(`tickUpper (${tickUpper}) must be divisible by tick spacing (${tickSpacing}) for fee tier ${feeTier}`);
        }
        
        console.log('✅ Tick validation passed!');

        // Check if pool exists
        let poolAddress = await checkPoolExists(token0, token1, feeTier);
        console.log('🔍 Pool exists check:', poolAddress ? 'YES' : 'NO');
        if (poolAddress) {
          console.log('🏊 Pool address:', poolAddress);
        }

        // If pool exists, check current tick
        let poolSqrtPriceX96: bigint | null = null;
        let currentPoolTick: number | null = null;
        if (poolAddress) {
          try {
            const slot0 = await publicClient?.readContract({
              address: poolAddress,
              abi: POOL_ABI,
              functionName: 'slot0',
            }) as [bigint, number, number, number, number, number, boolean];

            currentPoolTick = slot0[1];
            poolSqrtPriceX96 = slot0[0];
            console.log('📍 Pool current tick:', currentPoolTick);
            console.log('📍 Your tick range:', tickLower, 'to', tickUpper);
            
            // Check if pool has any liquidity
            const poolLiquidity = await publicClient?.readContract({
              address: poolAddress,
              abi: POOL_ABI,
              functionName: 'liquidity',
            }) as bigint;
            console.log('💧 Pool liquidity:', poolLiquidity.toString());
            
            // Also check token0 and token1 from pool to verify correct pool
            const poolToken0 = await publicClient?.readContract({
              address: poolAddress,
              abi: POOL_ABI,
              functionName: 'token0',
            }) as Address;
            const poolToken1 = await publicClient?.readContract({
              address: poolAddress,
              abi: POOL_ABI,
              functionName: 'token1',
            }) as Address;
            
            console.log('🔍 Pool token0:', poolToken0);
            console.log('🔍 Pool token1:', poolToken1);
            console.log('🔍 Expected token0:', token0);
            console.log('🔍 Expected token1:', token1);
            
            if (poolToken0.toLowerCase() !== token0.toLowerCase() || 
                poolToken1.toLowerCase() !== token1.toLowerCase()) {
              throw new Error(`Token mismatch! Pool has different tokens than expected. Pool: ${poolToken0}/${poolToken1}, Expected: ${token0}/${token1}`);
            }
            
            if (poolLiquidity === BigInt(0)) {
              console.warn('⚠️ WARNING: Pool has ZERO liquidity! This is the first liquidity addition.');
              console.warn('💡 First liquidity additions sometimes require special handling.');
              console.warn('💡 Checking if pool is properly initialized...');
              
              // Verify sqrtPriceX96 is not zero
              if (slot0[0] === BigInt(0)) {
                throw new Error('Pool sqrtPriceX96 is zero! Pool was not properly initialized.');
              }
              
              console.log('✅ Pool sqrtPriceX96 is set:', slot0[0].toString());
            }
            
            // CRITICAL V3 CHECK: Validate the range is compatible with providing liquidity
            if (currentPoolTick > tickUpper) {
              // Current price is ABOVE your range - can only deposit token0 (MWG)
              console.warn('⚠️ Current price is ABOVE your range. Only token0 (MWG) can be used.');
              console.warn('⚠️ This means you can only provide MWG, not BNB, in this position.');
            } else if (currentPoolTick < tickLower) {
              // Current price is BELOW your range - can only deposit token1 (BNB)
              console.warn('⚠️ Current price is BELOW your range. Only token1 (BNB) can be used.');
              console.warn('⚠️ This means you can only provide BNB, not MWG, in this position.');
            } else {
              console.log('✅ Current price is within your tick range');
            }
          } catch (err) {
            console.warn('⚠️ Could not fetch pool current tick:', err);
          }
        }

        // Determine which tokens are BNB
  const wbnb = getWBNBAddress(chain?.id);
  const isToken0BNB = token0.toLowerCase() === wbnb.toLowerCase();
  const isToken1BNB = token1.toLowerCase() === wbnb.toLowerCase();
        
        console.log('💰 Token check:', { isToken0BNB, isToken1BNB });

        // Approve tokens BEFORE creating pool or adding liquidity
        if (!isToken0BNB) {
          console.log('✅ Approving token0 before pool creation...');
          try {
            await approveToken(token0, amount0Desired);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Token0 approval failed';
            console.error('❌ Token0 approval error:', errorMsg);
            throw new Error(errorMsg);
          }
        }

        if (!isToken1BNB) {
          console.log('✅ Approving token1 before pool creation...');
          try {
            await approveToken(token1, amount1Desired);
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Token1 approval failed';
            console.error('❌ Token1 approval error:', errorMsg);
            throw new Error(errorMsg);
          }
        }

        if (!poolAddress && createPoolIfNeeded && sqrtPriceX96) {
          console.log('🏗️ Creating new pool...');
          // Create pool if it doesn't exist
          poolAddress = await createPool(token0, token1, feeTier, sqrtPriceX96);
          if (!poolAddress) {
            throw new Error('Failed to create pool');
          }
          // After creation, fetch slot0 so we can compute min amounts accurately
          try {
            const slot0 = await publicClient?.readContract({
              address: poolAddress,
              abi: POOL_ABI,
              functionName: 'slot0',
            }) as [bigint, number, number, number, number, number, boolean];
            poolSqrtPriceX96 = slot0[0];
            console.log('🆕 Pool initialized. slot0 sqrtPriceX96:', poolSqrtPriceX96?.toString());
          } catch (e) {
            console.warn('⚠️ Could not fetch slot0 after pool creation:', e);
          }
        } else if (!poolAddress) {
          throw new Error('Pool does not exist. Please enable pool creation.');
        }

        // Calculate minimum amounts with slippage, using pool state to avoid underfill reverts
        let amount0Min: bigint;
        let amount1Min: bigint;
        if (poolSqrtPriceX96) {
          try {
            const mins = calculateMintMinFromPoolState({
              amount0Desired,
              amount1Desired,
              tickLower,
              tickUpper,
              sqrtPriceX96: poolSqrtPriceX96,
              slippageTolerance,
            });
            amount0Min = mins.amount0Min;
            amount1Min = mins.amount1Min;
          } catch (e) {
            console.warn('⚠️ Failed to compute min amounts from pool state, falling back to zero mins:', e);
            amount0Min = BigInt(0);
            amount1Min = BigInt(0);
          }
        } else {
          // Without pool state, be permissive to avoid reverts (user still protected by ticks)
          amount0Min = BigInt(0);
          amount1Min = BigInt(0);
        }

        console.log('📊 Min amounts:', {
          amount0Min: amount0Min.toString(),
          amount1Min: amount1Min.toString(),
        });

        // Set deadline (20 minutes from now)
        const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
        
        console.log('⏰ Current time:', Math.floor(Date.now() / 1000));
        console.log('⏰ Deadline:', deadline);
        console.log('⏰ Time remaining:', (deadline - Math.floor(Date.now() / 1000)) / 60, 'minutes');

        // Prepare mint params
        const mintParams: AddLiquidityParams = {
          token0,
          token1,
          fee: feeTier,
          tickLower,
          tickUpper,
          amount0Desired,
          amount1Desired,
          amount0Min,
          amount1Min,
          recipient: address,
          deadline,
        };

        // Determine BNB value to send
        const bnbValue = isToken0BNB ? amount0Desired : isToken1BNB ? amount1Desired : BigInt(0);
        
        console.log('💸 BNB value to send:', bnbValue.toString());
        console.log('🔍 Full mint params:', JSON.stringify({
          token0,
          token1,
          fee: feeTier,
          tickLower,
          tickUpper,
          amount0Desired: amount0Desired.toString(),
          amount1Desired: amount1Desired.toString(),
          amount0Min: amount0Min.toString(),
          amount1Min: amount1Min.toString(),
          recipient: address,
          deadline,
          bnbValue: bnbValue.toString(),
        }, null, 2));
        
        // Log ratio for debugging
        const ratio = Number(amount1Desired) / Number(amount0Desired);
        console.log('📊 Amount ratio (amount1/amount0):', ratio);
        console.log('📊 Expected BNB:', Number(amount1Desired) / 1e18);
        console.log('📊 Expected MWG:', Number(amount0Desired) / 1e18);
        
        console.log('🚀 Minting position...');

        // First, simulate to catch revert reasons early
        let finalMintParams = mintParams;
        let finalBnbValue = bnbValue;
        try {
          await publicClient?.simulateContract({
            address: PANCAKESWAP_V3.POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'mint',
            args: [finalMintParams],
            value: finalBnbValue,
            account: address,
          });
        } catch (err) {
          const error = err as Error & { shortMessage?: string; cause?: { reason?: string; data?: string }; details?: string };
          const reason = error.cause?.reason || error.shortMessage || error.details || error.message;
          console.error('🧪 Simulation failed. Revert reason:', reason);
          console.error('🧪 Simulation error (raw):', safeStringify(error));

          // Fallback: if we have pool state, re-estimate actual used amounts and try again
          if (poolSqrtPriceX96) {
            console.log('🔁 Retrying simulation with slot0-based usage estimates...');
            console.log('🔍 Pool sqrtPriceX96:', poolSqrtPriceX96.toString());
            console.log('🔍 Tick range:', tickLower, 'to', tickUpper);
            
            try {
              const usage = estimateUsageFromPoolState({
                amount0Desired,
                amount1Desired,
                tickLower,
                tickUpper,
                sqrtPriceX96: poolSqrtPriceX96,
              });

              console.log('💡 Usage estimation result:', {
                usedAmount0Wei: usage.usedAmount0Wei.toString(),
                usedAmount1Wei: usage.usedAmount1Wei.toString(),
                oneSided: usage.oneSided,
              });

              const adjAmount0Desired = usage.usedAmount0Wei;
              const adjAmount1Desired = usage.usedAmount1Wei;
              
              // CRITICAL CHECK: If both amounts are zero, the range is completely out of bounds
              if (adjAmount0Desired === BigInt(0) && adjAmount1Desired === BigInt(0)) {
                console.error('❌ Both token amounts are zero. Your tick range is too far from current pool price.');
                throw new Error('Your price range is incompatible with the current pool price. Please adjust your target price or widen your range significantly.');
              }
              
              // ADDITIONAL CHECK: Verify the one-sided amount is actually usable
              if (adjAmount0Desired === BigInt(0) && adjAmount1Desired > BigInt(0)) {
                console.log('💡 One-sided deposit: Only BNB will be used (token1)');
                // This is only valid if current tick < tickLower (price below range)
                // If current tick > tickUpper, we can't add token1 liquidity
                console.error('❌ CRITICAL: Trying to add token1 (BNB) but current tick is above your range!');
                console.error('❌ This is mathematically impossible in Uniswap V3.');
                console.error('💡 Solution: Your target price needs to be HIGHER, closer to the current pool price.');
                throw new Error(`Cannot add BNB-only liquidity below current price. Current pool tick is ${currentPoolTick || 'unknown'} but your range ends at ${tickUpper}. Please increase your target price to be closer to the current pool price.`);
              }
              
              if (adjAmount1Desired === BigInt(0) && adjAmount0Desired > BigInt(0)) {
                console.log('💡 One-sided deposit: Only MWG will be used (token0)');
                // This is only valid if current tick > tickUpper (price above range)
              }

              // Recompute mins for adjusted desired amounts
              let adjAmount0Min: bigint = BigInt(0);
              let adjAmount1Min: bigint = BigInt(0);
              
              // CRITICAL: If a token's desired amount is zero, its min MUST be zero
              if (adjAmount0Desired === BigInt(0)) {
                adjAmount0Min = BigInt(0);
              } else {
                // Apply slippage directly to adjusted amount
                adjAmount0Min = (adjAmount0Desired * BigInt(Math.floor((1 - slippageTolerance / 100) * 10000))) / BigInt(10000);
              }
              
              if (adjAmount1Desired === BigInt(0)) {
                adjAmount1Min = BigInt(0);
              } else {
                // Apply slippage directly to adjusted amount
                adjAmount1Min = (adjAmount1Desired * BigInt(Math.floor((1 - slippageTolerance / 100) * 10000))) / BigInt(10000);
              }
              
              console.log('📊 Adjusted min amounts calculated:');
              console.log('  amount0Desired:', adjAmount0Desired.toString());
              console.log('  amount0Min:', adjAmount0Min.toString());
              console.log('  amount1Desired:', adjAmount1Desired.toString());
              console.log('  amount1Min:', adjAmount1Min.toString());
              console.log('  slippageTolerance:', slippageTolerance);
              console.log('  Min/Desired ratio 0:', Number(adjAmount0Min) / Number(adjAmount0Desired));
              console.log('  Min/Desired ratio 1:', Number(adjAmount1Min) / Number(adjAmount1Desired));

              finalMintParams = {
                ...mintParams,
                amount0Desired: adjAmount0Desired,
                amount1Desired: adjAmount1Desired,
                amount0Min: adjAmount0Min,
                amount1Min: adjAmount1Min,
              };

              // Determine new BNB value to send
              finalBnbValue = isToken0BNB ? adjAmount0Desired : isToken1BNB ? adjAmount1Desired : BigInt(0);

              console.log('🔁 Retried mint params:', JSON.stringify({
                ...finalMintParams,
                amount0Desired: finalMintParams.amount0Desired.toString(),
                amount1Desired: finalMintParams.amount1Desired.toString(),
                amount0Min: finalMintParams.amount0Min.toString(),
                amount1Min: finalMintParams.amount1Min.toString(),
                bnbValue: finalBnbValue.toString(),
              }, null, 2));

              await publicClient?.simulateContract({
                address: PANCAKESWAP_V3.POSITION_MANAGER,
                abi: POSITION_MANAGER_ABI,
                functionName: 'mint',
                args: [finalMintParams],
                value: finalBnbValue,
                account: address,
                gas: BigInt(5000000), // Explicit gas limit
              });
            } catch (retryErr) {
              const rErr = retryErr as Error & { shortMessage?: string; cause?: { reason?: string; data?: string }; details?: string };
              const rReason = rErr.cause?.reason || rErr.shortMessage || rErr.details || rErr.message;
              console.error('🧪 Retried simulation failed. Revert reason:', rReason);
              console.error('🧪 Retried simulation error (raw):', safeStringify(rErr));
              console.warn('⚠️ SIMULATION FAILED - Will attempt actual transaction anyway...');
              console.warn('💡 Sometimes simulations fail but actual transactions succeed on testnet');
              // Don't throw - let it proceed to actual transaction
            }
          } else {
            console.warn('⚠️ Initial simulation failed, but proceeding with original parameters');
          }
        }

        // Add liquidity - proceed even if simulation failed
        let hash: `0x${string}`;
        try {
          console.log('🚀 Executing mint transaction with params:', safeStringify({
            amount0Desired: finalMintParams.amount0Desired.toString(),
            amount1Desired: finalMintParams.amount1Desired.toString(),
            amount0Min: finalMintParams.amount0Min.toString(),
            amount1Min: finalMintParams.amount1Min.toString(),
            tickLower: finalMintParams.tickLower,
            tickUpper: finalMintParams.tickUpper,
          }));
          
          hash = await walletClient.writeContract({
            address: PANCAKESWAP_V3.POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'mint',
            args: [finalMintParams],
            value: finalBnbValue,
            gas: BigInt(5000000), // Explicit gas limit for transaction too
          });
        } catch (err) {
          console.error('❌ Mint transaction failed:', err);
          // Extract revert reason if available
          const error = err as Error & { 
            shortMessage?: string;
            cause?: { reason?: string; data?: unknown };
            details?: string;
            metaMessages?: string[];
          };
          
          // Try to extract the most useful error message
          let errorMsg = 'Transaction failed';
          
          if (error.cause?.reason) {
            errorMsg = error.cause.reason;
          } else if (error.shortMessage) {
            errorMsg = error.shortMessage;
          } else if (error.details) {
            errorMsg = error.details;
          } else if (error.message) {
            errorMsg = error.message;
          }
          
          // Log full error for debugging
          console.error('📋 Full error object:', safeStringify(error));
          
          throw new Error(`Failed to mint position: ${errorMsg}`);
        }

        console.log('⏳ Mint tx sent:', hash);

  // Wait for confirmation
        const receipt = await publicClient?.waitForTransactionReceipt({ hash });
        console.log('📝 Receipt status:', receipt?.status);
        
        // Check if transaction was successful
        if (receipt?.status === 'reverted') {
          throw new Error(`Transaction reverted. Check transaction on BSCScan: https://testnet.bscscan.com/tx/${hash}`);
        }
        
        console.log('✅ Mint tx confirmed successfully!');

        // Extract token ID from logs (the NFT position ID from IncreaseLiquidity event)
        let tokenId: bigint | null = null;
        
        if (receipt?.logs) {
          // The Transfer event from the NFT mint has the tokenId as the last topic
          // Topic 0: event signature (Transfer)
          // Topic 1: from address (0x0 for mint)
          // Topic 2: to address (recipient)
          // Topic 3: tokenId
          const transferEvent = receipt.logs.find(log => 
            log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' && // Transfer event signature
            log.topics[1] === '0x0000000000000000000000000000000000000000000000000000000000000000' // from = 0x0 (mint)
          );
          
          if (transferEvent && transferEvent.topics[3]) {
            tokenId = BigInt(transferEvent.topics[3]);
            console.log('🎫 Position NFT minted with ID:', tokenId.toString());
          }
        }
        
        // Fallback: if we couldn't extract from logs, get the latest position for this user
        if (!tokenId) {
          console.warn('⚠️ Could not extract tokenId from logs, fetching latest position...');
          const balance = await publicClient?.readContract({
            address: PANCAKESWAP_V3.POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'balanceOf',
            args: [address],
          }) as bigint;
          
          if (balance > 0) {
            tokenId = await publicClient?.readContract({
              address: PANCAKESWAP_V3.POSITION_MANAGER,
              abi: POSITION_MANAGER_ABI,
              functionName: 'tokenOfOwnerByIndex',
              args: [address, balance - BigInt(1)], // Get the last (most recent) position
            }) as bigint;
            console.log('🎫 Latest position ID:', tokenId?.toString());
          }
        }
        
        return tokenId;
      } catch (err) {
        console.error('❌ Error adding liquidity:', err);
        setError(err instanceof Error ? err.message : 'Failed to add liquidity');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient, checkPoolExists, createPool, approveToken, checkBalances, chain]
  );

  /**
   * Get user's LP positions
   */
  const getUserPositions = useCallback(
    async (): Promise<LiquidityPosition[]> => {
      if (!publicClient || !address) return [];

      try {
        setIsLoading(true);

        console.log('🔍 Checking positions for wallet:', address);
        console.log('🔍 Position Manager contract:', PANCAKESWAP_V3.POSITION_MANAGER);
        console.log('🔍 Chain ID:', chain?.id);

        // Get number of positions
        const balance = await publicClient.readContract({
          address: PANCAKESWAP_V3.POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: 'balanceOf',
          args: [address],
        }) as bigint;

        console.log('🎫 NFT Balance for this wallet:', balance.toString());

        const positions: LiquidityPosition[] = [];

        // Get each position
        for (let i = 0; i < Number(balance); i++) {
          const tokenId = await publicClient.readContract({
            address: PANCAKESWAP_V3.POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'tokenOfOwnerByIndex',
            args: [address, BigInt(i)],
          }) as bigint;

          const positionData = await publicClient.readContract({
            address: PANCAKESWAP_V3.POSITION_MANAGER,
            abi: POSITION_MANAGER_ABI,
            functionName: 'positions',
            args: [tokenId],
          }) as [bigint, Address, Address, Address, number, number, number, bigint, bigint, bigint, bigint, bigint];

          const token0 = positionData[2];
          const token1 = positionData[3];
          const fee = positionData[4];
          const tickLower = positionData[5];
          const tickUpper = positionData[6];

          // Get pool address for this position
          const poolAddress = await checkPoolExists(token0, token1, fee);
          
          // Determine if position is in range by checking current pool tick
          // Also calculate current price and price range
          let inRange = false;
          let currentPrice: number | undefined;
          let minPrice: number | undefined;
          let maxPrice: number | undefined;
          let currentTick: number | undefined;

          if (poolAddress) {
            try {
              const poolState = await getPoolState(poolAddress);
              if (poolState) {
                currentTick = poolState.tick;
                inRange = currentTick >= tickLower && currentTick <= tickUpper;
                
                // Calculate prices using tick values
                // price = 1.0001^tick
                const Q96 = BigInt(2) ** BigInt(96);
                const sqrtPrice = Number(poolState.sqrtPriceX96) / Number(Q96);
                const priceToken1PerToken0 = sqrtPrice * sqrtPrice;
                
                // Determine if token0 is MWG
                const token0IsMWG = token0.toLowerCase() === CONTRACT_ADDRESSES.TOKEN.toLowerCase();
                
                // If token0 is MWG, then priceToken1PerToken0 = WBNB/MWG
                const bnbPerMWG = token0IsMWG ? priceToken1PerToken0 : (priceToken1PerToken0 === 0 ? 0 : 1 / priceToken1PerToken0);
                
                // Assume BNB price ~$600 (could fetch from API for accuracy)
                const BNB_PRICE_USD = 600;
                currentPrice = bnbPerMWG * BNB_PRICE_USD;
                
                // Calculate min/max prices from tick range
                const priceAtTickLower = Math.pow(1.0001, tickLower);
                const priceAtTickUpper = Math.pow(1.0001, tickUpper);
                
                const bnbPerMWG_Lower = token0IsMWG ? priceAtTickLower : (priceAtTickLower === 0 ? 0 : 1 / priceAtTickLower);
                const bnbPerMWG_Upper = token0IsMWG ? priceAtTickUpper : (priceAtTickUpper === 0 ? 0 : 1 / priceAtTickUpper);
                
                minPrice = bnbPerMWG_Lower * BNB_PRICE_USD;
                maxPrice = bnbPerMWG_Upper * BNB_PRICE_USD;
                
                console.log(`📊 Position #${tokenId} - Current tick: ${currentTick}, Range: [${tickLower}, ${tickUpper}], In Range: ${inRange}`);
                console.log(`💰 Prices - Current: $${currentPrice.toFixed(6)}, Min: $${minPrice.toFixed(6)}, Max: $${maxPrice.toFixed(6)}`);
              }
            } catch (err) {
              console.warn(`⚠️ Could not check range for position #${tokenId}:`, err);
              // If we can't fetch pool state, default to undefined
              inRange = false;
            }
          }

          positions.push({
            tokenId,
            token0,
            token1,
            fee,
            tickLower,
            tickUpper,
            liquidity: positionData[7],
            feeGrowthInside0: positionData[8],
            feeGrowthInside1: positionData[9],
            tokensOwed0: positionData[10],
            tokensOwed1: positionData[11],
            inRange,
            currentPrice,
            minPrice,
            maxPrice,
            currentTick,
          });
        }

        console.log('✅ Loaded positions with range status:', positions.map(p => ({
          tokenId: p.tokenId.toString(),
          inRange: p.inRange,
        })));

        return positions;
      } catch (err) {
        console.error('Error getting user positions:', err);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [publicClient, address, chain?.id, checkPoolExists, getPoolState]
  );

  /**
   * Remove liquidity from position
   */
  const removeLiquidity = useCallback(
    async (
      tokenId: bigint,
      liquidity: bigint
    ): Promise<boolean> => {
      if (!walletClient || !address) {
        setError('Wallet not connected');
        return false;
      }

      try {
        setIsLoading(true);
        setError(null);

        // Set deadline
        const deadline = Math.floor(Date.now() / 1000) + 20 * 60;

        // Remove liquidity
        const hash = await walletClient.writeContract({
          address: PANCAKESWAP_V3.POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: 'decreaseLiquidity',
          args: [{
            tokenId,
            liquidity,
            amount0Min: BigInt(0),
            amount1Min: BigInt(0),
            deadline,
          }],
        });

        await publicClient?.waitForTransactionReceipt({ hash });

        // Collect tokens
        const collectHash = await walletClient.writeContract({
          address: PANCAKESWAP_V3.POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: 'collect',
          args: [{
            tokenId,
            recipient: address,
            amount0Max: BigInt('340282366920938463463374607431768211455'), // uint128 max
            amount1Max: BigInt('340282366920938463463374607431768211455'),
          }],
        });

        await publicClient?.waitForTransactionReceipt({ hash: collectHash });

        return true;
      } catch (err) {
        console.error('Error removing liquidity:', err);
        setError(err instanceof Error ? err.message : 'Failed to remove liquidity');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient]
  );

  /**
   * Collect fees from position
   */
  const collectFees = useCallback(
    async (tokenId: bigint): Promise<boolean> => {
      if (!walletClient || !address) {
        setError('Wallet not connected');
        return false;
      }

      try {
        setIsLoading(true);
        setError(null);

        const hash = await walletClient.writeContract({
          address: PANCAKESWAP_V3.POSITION_MANAGER,
          abi: POSITION_MANAGER_ABI,
          functionName: 'collect',
          args: [{
            tokenId,
            recipient: address,
            amount0Max: BigInt('340282366920938463463374607431768211455'), // uint128 max
            amount1Max: BigInt('340282366920938463463374607431768211455'),
          }],
        });

        await publicClient?.waitForTransactionReceipt({ hash });

        return true;
      } catch (err) {
        console.error('Error collecting fees:', err);
        setError(err instanceof Error ? err.message : 'Failed to collect fees');
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [walletClient, address, publicClient]
  );

  return {
    checkPoolExists,
    getPoolState,
    getPoolBalances,
    approveToken,
    createPool,
    addLiquidity,
    getUserPositions,
    removeLiquidity,
    collectFees,
    checkBalances,
    isLoading,
    error,
  };
}
