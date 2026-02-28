const { ethers } = require('ethers');
const logger = require('../../utils/logger');

// Contract ABIs
const PancakeRouterABI = require('../../../contracts/abis/IPancakeRouter.json');
const PancakePairABI = require('../../../contracts/abis/IPancakePair.json');

// PancakeSwap V2 Factory ABI (only getPair needed)
const PancakeFactoryABI = [
    {
        "inputs": [
            { "internalType": "address", "name": "tokenA", "type": "address" },
            { "internalType": "address", "name": "tokenB", "type": "address" }
        ],
        "name": "getPair",
        "outputs": [
            { "internalType": "address", "name": "pair", "type": "address" }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

// PancakeSwap V2 Factory address on BSC Mainnet
const PANCAKE_V2_FACTORY = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';

// Common quote tokens on BSC to check pairs against
const QUOTE_TOKENS = {
    WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
    USDT: '0x55d398326f99059fF775485246999027B3197955',
    BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
    USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
};

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

class LiquidityManager {
    constructor() {
        // Validate required environment variables
        const required = {
            BSC_MAINNET_RPC_URL: process.env.BSC_MAINNET_RPC_URL,
            LIQUIDITY_WALLET_PRIVATE_KEY: process.env.LIQUIDITY_WALLET_PRIVATE_KEY,
            PANCAKE_ROUTER_ADDRESS: process.env.PANCAKE_ROUTER_ADDRESS,
            WBNB_ADDRESS: process.env.WBNB_ADDRESS
        };

        const missing = Object.entries(required).filter(([k, v]) => !v).map(([k]) => k);
        if (missing.length > 0) {
            throw new Error(`LiquidityManager: Missing required environment variables: ${missing.join(', ')}`);
        }

        this.provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);

        this.wallet = new ethers.Wallet(
            process.env.LIQUIDITY_WALLET_PRIVATE_KEY,
            this.provider
        );

        this.router = new ethers.Contract(
            process.env.PANCAKE_ROUTER_ADDRESS,
            PancakeRouterABI,
            this.wallet
        );

        this.factory = new ethers.Contract(
            PANCAKE_V2_FACTORY,
            PancakeFactoryABI,
            this.provider
        );

        this.WBNB = process.env.WBNB_ADDRESS.toLowerCase();
        this.routerAddress = process.env.PANCAKE_ROUTER_ADDRESS;

        logger.info(`LiquidityManager initialized. Wallet: ${this.wallet.address}`);
    }

    /**
     * Find all V2 pair addresses for a given token by checking against common quote tokens.
     * Returns only pairs that actually exist (non-zero address).
     * @param {string} tokenAddress - The token contract address
     * @returns {Promise<Object[]>} Array of { quoteToken, quoteSymbol, pairAddress }
     */
    async findPairsForToken(tokenAddress) {
        const tokenLower = tokenAddress.toLowerCase();
        const found = [];

        // Query factory for pairs against each quote token in parallel
        const queries = Object.entries(QUOTE_TOKENS).map(async ([symbol, quoteAddr]) => {
            // Skip if the token IS the quote token
            if (tokenLower === quoteAddr.toLowerCase()) return null;

            try {
                const pairAddress = await this.factory.getPair(tokenAddress, quoteAddr);
                if (pairAddress && pairAddress !== ZERO_ADDRESS) {
                    return { quoteToken: quoteAddr, quoteSymbol: symbol, pairAddress };
                }
            } catch (error) {
                logger.warn(`Factory query failed for ${symbol} pair: ${error.message}`);
            }
            return null;
        });

        const results = await Promise.all(queries);
        for (const r of results) {
            if (r) found.push(r);
        }

        return found;
    }

    /**
     * Resolve a token address to all V2 pair addresses with LP balance.
     * Returns pairs where the wallet actually holds LP tokens.
     * @param {string} tokenAddress - The token contract address
     * @returns {Promise<Object[]>} Array of pairs with LP balance info
     */
    async findPairsWithLiquidity(tokenAddress) {
        logger.info(`🔎 Looking up V2 pairs for token ${tokenAddress}...`);

        const pairs = await this.findPairsForToken(tokenAddress);

        if (pairs.length === 0) {
            logger.info(`   No V2 pairs found for token ${tokenAddress}`);
            return [];
        }

        logger.info(`   Found ${pairs.length} V2 pair(s): ${pairs.map(p => `${p.quoteSymbol}@${p.pairAddress}`).join(', ')}`);

        // Check LP balance on each pair in parallel
        const pairsWithBalance = [];
        const balanceChecks = pairs.map(async (p) => {
            try {
                const pair = new ethers.Contract(p.pairAddress, PancakePairABI, this.provider);
                const lpBalance = await pair.balanceOf(this.wallet.address);
                if (lpBalance > 0n) {
                    pairsWithBalance.push({ ...p, lpBalance, lpBalanceFormatted: ethers.formatEther(lpBalance) });
                }
            } catch (error) {
                logger.warn(`   Failed to check balance on pair ${p.pairAddress}: ${error.message}`);
            }
        });

        await Promise.all(balanceChecks);

        logger.info(`   ${pairsWithBalance.length} pair(s) have LP balance`);
        return pairsWithBalance;
    }

    /**
     * Check LP balance for a given pair address
     * @param {string} pairAddress - PancakeSwap V2 pair contract address
     * @returns {Promise<Object>} LP balance info
     */
    async checkLiquidity(pairAddress) {
        try {
            const pair = new ethers.Contract(pairAddress, PancakePairABI, this.provider);

            const [lpBalance, totalSupply, token0, token1, reserves] = await Promise.all([
                pair.balanceOf(this.wallet.address),
                pair.totalSupply(),
                pair.token0(),
                pair.token1(),
                pair.getReserves()
            ]);

            const hasLiquidity = lpBalance > 0n;

            let expectedToken0 = 0n;
            let expectedToken1 = 0n;

            if (hasLiquidity && totalSupply > 0n) {
                expectedToken0 = (reserves[0] * lpBalance) / totalSupply;
                expectedToken1 = (reserves[1] * lpBalance) / totalSupply;
            }

            return {
                pairAddress,
                hasLiquidity,
                lpBalance: ethers.formatEther(lpBalance),
                lpBalanceRaw: lpBalance,
                totalSupply: ethers.formatEther(totalSupply),
                token0: token0,
                token1: token1,
                reserves: {
                    reserve0: ethers.formatEther(reserves[0]),
                    reserve1: ethers.formatEther(reserves[1])
                },
                expectedOut: {
                    token0: ethers.formatEther(expectedToken0),
                    token1: ethers.formatEther(expectedToken1)
                }
            };
        } catch (error) {
            logger.error(`Failed to check liquidity for pair ${pairAddress}:`, error);
            throw new Error(`Failed to check liquidity for pair ${pairAddress}: ${error.message}`);
        }
    }

    /**
     * Check LP balance and withdraw all liquidity if it exists
     * @param {string} pairAddress - PancakeSwap V2 pair contract address
     * @param {number} slippage - Slippage tolerance in percent (default 1%)
     * @returns {Promise<Object>} Withdrawal result
     */
    async checkAndWithdraw(pairAddress, slippage = 1) {
        try {
            logger.info(`🔍 Checking liquidity for pair ${pairAddress}...`);

            // 1. Check LP balance
            const info = await this.checkLiquidity(pairAddress);

            if (!info.hasLiquidity) {
                logger.info(`⏭️  No LP balance for pair ${pairAddress}. Skipping.`);
                return {
                    pair: pairAddress,
                    withdrawn: false,
                    reason: 'No LP balance',
                    lpBalance: '0',
                    token0: info.token0,
                    token1: info.token1
                };
            }

            logger.info(`💰 Found ${info.lpBalance} LP tokens for pair ${pairAddress}`);
            logger.info(`   Expected: ${info.expectedOut.token0} token0, ${info.expectedOut.token1} token1`);

            // 2. Determine if one side is WBNB
            const token0Lower = info.token0.toLowerCase();
            const token1Lower = info.token1.toLowerCase();
            const token0IsWBNB = token0Lower === this.WBNB;
            const token1IsWBNB = token1Lower === this.WBNB;
            const hasWBNB = token0IsWBNB || token1IsWBNB;

            // 3. Calculate minimum amounts with slippage
            const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
            const expectedToken0Raw = (info.lpBalanceRaw * BigInt(ethers.parseEther(info.reserves.reserve0).toString()))
                / BigInt(ethers.parseEther(info.totalSupply).toString());
            const expectedToken1Raw = (info.lpBalanceRaw * BigInt(ethers.parseEther(info.reserves.reserve1).toString()))
                / BigInt(ethers.parseEther(info.totalSupply).toString());

            // Re-calculate from raw reserves for precision
            const pair = new ethers.Contract(pairAddress, PancakePairABI, this.provider);
            const [reserves, totalSupply] = await Promise.all([
                pair.getReserves(),
                pair.totalSupply()
            ]);

            const amount0Expected = (reserves[0] * info.lpBalanceRaw) / totalSupply;
            const amount1Expected = (reserves[1] * info.lpBalanceRaw) / totalSupply;

            const amount0Min = (amount0Expected * slippageMultiplier) / 10000n;
            const amount1Min = (amount1Expected * slippageMultiplier) / 10000n;

            logger.info(`📊 Slippage: ${slippage}%`);
            logger.info(`   Min token0: ${ethers.formatEther(amount0Min)}`);
            logger.info(`   Min token1: ${ethers.formatEther(amount1Min)}`);

            // 4. Approve router to spend LP tokens
            logger.info(`🔐 Approving router to spend LP tokens...`);
            const currentAllowance = await pair.allowance(this.wallet.address, this.routerAddress);

            if (currentAllowance < info.lpBalanceRaw) {
                const approveTx = await pair.connect(this.wallet).approve(
                    this.routerAddress,
                    info.lpBalanceRaw
                );
                const approveReceipt = await approveTx.wait();
                logger.info(`✅ Approval confirmed in block ${approveReceipt.blockNumber}`);
            } else {
                logger.info(`✅ Router already has sufficient allowance`);
            }

            // 5. Set deadline (20 minutes from now)
            const deadline = Math.floor(Date.now() / 1000) + 1200;

            // 6. Execute removal
            let tx;
            let method;
            if (hasWBNB) {
                // One side is WBNB — use removeLiquidityETH to receive native BNB
                const otherToken = token0IsWBNB ? info.token1 : info.token0;
                const amountTokenMin = token0IsWBNB ? amount1Min : amount0Min;
                const amountETHMin = token0IsWBNB ? amount0Min : amount1Min;

                logger.info(`📤 Calling removeLiquidityETH...`);
                logger.info(`   Token: ${otherToken}`);
                logger.info(`   LP Amount: ${ethers.formatEther(info.lpBalanceRaw)}`);

                try {
                    tx = await this.router.removeLiquidityETH(
                        otherToken,
                        info.lpBalanceRaw,
                        amountTokenMin,
                        amountETHMin,
                        this.wallet.address,
                        deadline
                    );
                    method = 'removeLiquidityETH';
                } catch (ethError) {
                    // Token likely has transfer tax — retry with fee-on-transfer variant
                    logger.warn(`⚠️  removeLiquidityETH failed (likely fee-on-transfer token). Retrying with removeLiquidityETHSupportingFeeOnTransferTokens...`);
                    logger.warn(`   Error: ${ethError.message?.substring(0, 120)}`);

                    tx = await this.router.removeLiquidityETHSupportingFeeOnTransferTokens(
                        otherToken,
                        info.lpBalanceRaw,
                        amountTokenMin,
                        amountETHMin,
                        this.wallet.address,
                        deadline
                    );
                    method = 'removeLiquidityETHSupportingFeeOnTransferTokens';
                }
            } else {
                // Both sides are ERC20 — use removeLiquidity
                logger.info(`📤 Calling removeLiquidity...`);
                logger.info(`   TokenA: ${info.token0}`);
                logger.info(`   TokenB: ${info.token1}`);
                logger.info(`   LP Amount: ${ethers.formatEther(info.lpBalanceRaw)}`);

                tx = await this.router.removeLiquidity(
                    info.token0,
                    info.token1,
                    info.lpBalanceRaw,
                    amount0Min,
                    amount1Min,
                    this.wallet.address,
                    deadline
                );
                method = 'removeLiquidity';
            }

            logger.info(`📤 Transaction sent: ${tx.hash}`);
            logger.info(`⏳ Waiting for confirmation...`);

            const receipt = await tx.wait();

            const gasCost = receipt.gasUsed * receipt.gasPrice;
            const gasCostBNB = ethers.formatEther(gasCost);

            logger.info(`✅ Liquidity withdrawn successfully!`);
            logger.info(`   Block: ${receipt.blockNumber}`);
            logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            logger.info(`   Gas cost: ${gasCostBNB} BNB`);

            return {
                pair: pairAddress,
                withdrawn: true,
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                lpWithdrawn: ethers.formatEther(info.lpBalanceRaw),
                token0: info.token0,
                token1: info.token1,
                expectedToken0: ethers.formatEther(amount0Expected),
                expectedToken1: ethers.formatEther(amount1Expected),
                minToken0: ethers.formatEther(amount0Min),
                minToken1: ethers.formatEther(amount1Min),
                method,
                gasUsed: receipt.gasUsed.toString(),
                gasCostBNB,
                slippage: `${slippage}%`,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            logger.error(`❌ Failed to withdraw liquidity from pair ${pairAddress}:`, error);
            return {
                pair: pairAddress,
                withdrawn: false,
                reason: `Transaction failed: ${error.message}`,
                error: error.code || 'UNKNOWN_ERROR'
            };
        }
    }

    /**
     * Bulk check and withdraw liquidity from multiple token addresses.
     * For each token, finds all V2 pairs via factory, checks LP balance, and withdraws.
     * Processes sequentially to avoid nonce conflicts.
     * @param {string[]} tokenAddresses - Array of token contract addresses
     * @param {number} slippage - Slippage tolerance in percent (default 1%)
     * @returns {Promise<Object>} Bulk withdrawal results
     */
    async bulkCheckAndWithdraw(tokenAddresses, slippage = 1) {
        logger.info(`🚀 Starting bulk liquidity withdrawal for ${tokenAddresses.length} token(s)...`);
        const startTime = Date.now();

        const results = [];
        let withdrawnCount = 0;
        let skippedCount = 0;
        let failedCount = 0;
        let noPairsCount = 0;

        for (const tokenAddress of tokenAddresses) {
            logger.info(`\n📌 Processing token: ${tokenAddress}`);

            // 1. Find all V2 pairs for this token
            const pairsWithLP = await this.findPairsWithLiquidity(tokenAddress);

            if (pairsWithLP.length === 0) {
                // Check if pairs exist at all
                const allPairs = await this.findPairsForToken(tokenAddress);
                if (allPairs.length === 0) {
                    noPairsCount++;
                    results.push({
                        token: tokenAddress,
                        withdrawn: false,
                        reason: 'No V2 pairs found on PancakeSwap',
                        pairsChecked: Object.keys(QUOTE_TOKENS).length
                    });
                } else {
                    skippedCount++;
                    results.push({
                        token: tokenAddress,
                        withdrawn: false,
                        reason: 'No LP balance in any pair',
                        pairsFound: allPairs.map(p => ({ quote: p.quoteSymbol, pair: p.pairAddress })),
                        pairsChecked: allPairs.length
                    });
                }
                continue;
            }

            // 2. Withdraw from each pair with LP balance (sequentially for nonce safety)
            for (const pairInfo of pairsWithLP) {
                logger.info(`   Withdrawing from ${pairInfo.quoteSymbol} pair: ${pairInfo.pairAddress} (${pairInfo.lpBalanceFormatted} LP)`);

                const result = await this.checkAndWithdraw(pairInfo.pairAddress, slippage);

                // Enrich result with token & pair context
                result.token = tokenAddress;
                result.quoteSymbol = pairInfo.quoteSymbol;
                result.quoteToken = pairInfo.quoteToken;
                results.push(result);

                if (result.withdrawn) {
                    withdrawnCount++;
                } else if (result.reason === 'No LP balance') {
                    skippedCount++;
                } else {
                    failedCount++;
                }
            }
        }

        const elapsedTime = Date.now() - startTime;

        logger.info(`\n✅ Bulk withdrawal complete in ${elapsedTime}ms`);
        logger.info(`   Withdrawn: ${withdrawnCount}, Skipped: ${skippedCount}, No pairs: ${noPairsCount}, Failed: ${failedCount}`);

        return {
            totalTokens: tokenAddresses.length,
            totalWithdrawals: withdrawnCount,
            skipped: skippedCount,
            noPairs: noPairsCount,
            failed: failedCount,
            wallet: this.wallet.address,
            elapsedMs: elapsedTime,
            results
        };
    }

    /**
     * Bulk check liquidity for multiple token addresses (read-only, no withdrawal).
     * @param {string[]} tokenAddresses - Array of token contract addresses
     * @returns {Promise<Object>} Check results per token
     */
    async bulkCheckLiquidity(tokenAddresses) {
        logger.info(`🔍 Checking liquidity for ${tokenAddresses.length} token(s)...`);
        const results = [];

        for (const tokenAddress of tokenAddresses) {
            const tokenResult = {
                token: tokenAddress,
                pairs: []
            };

            const allPairs = await this.findPairsForToken(tokenAddress);

            if (allPairs.length === 0) {
                tokenResult.noPairsFound = true;
                results.push(tokenResult);
                continue;
            }

            for (const pairInfo of allPairs) {
                try {
                    const info = await this.checkLiquidity(pairInfo.pairAddress);
                    tokenResult.pairs.push({
                        quoteSymbol: pairInfo.quoteSymbol,
                        quoteToken: pairInfo.quoteToken,
                        ...info
                    });
                } catch (error) {
                    tokenResult.pairs.push({
                        quoteSymbol: pairInfo.quoteSymbol,
                        pairAddress: pairInfo.pairAddress,
                        hasLiquidity: false,
                        error: error.message
                    });
                }
            }

            results.push(tokenResult);
        }

        return results;
    }
}

module.exports = LiquidityManager;
