const { ethers } = require('ethers');
const logger = require('../../utils/logger');

// Contract ABIs
const PancakeRouterABI = require('../../../contracts/abis/IPancakeRouter.json');
const PancakePairABI = require('../../../contracts/abis/IPancakePair.json');

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

        this.WBNB = process.env.WBNB_ADDRESS.toLowerCase();
        this.routerAddress = process.env.PANCAKE_ROUTER_ADDRESS;

        logger.info(`LiquidityManager initialized. Wallet: ${this.wallet.address}`);
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
            if (hasWBNB) {
                // One side is WBNB — use removeLiquidityETH to receive native BNB
                const otherToken = token0IsWBNB ? info.token1 : info.token0;
                const amountTokenMin = token0IsWBNB ? amount1Min : amount0Min;
                const amountETHMin = token0IsWBNB ? amount0Min : amount1Min;

                logger.info(`📤 Calling removeLiquidityETH...`);
                logger.info(`   Token: ${otherToken}`);
                logger.info(`   LP Amount: ${ethers.formatEther(info.lpBalanceRaw)}`);

                tx = await this.router.removeLiquidityETH(
                    otherToken,
                    info.lpBalanceRaw,
                    amountTokenMin,
                    amountETHMin,
                    this.wallet.address,
                    deadline
                );
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
                method: hasWBNB ? 'removeLiquidityETH' : 'removeLiquidity',
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
     * Bulk check and withdraw liquidity from multiple pairs
     * Processes sequentially to avoid nonce conflicts
     * @param {string[]} pairAddresses - Array of pair contract addresses
     * @param {number} slippage - Slippage tolerance in percent (default 1%)
     * @returns {Promise<Object>} Bulk withdrawal results
     */
    async bulkCheckAndWithdraw(pairAddresses, slippage = 1) {
        logger.info(`🚀 Starting bulk liquidity withdrawal for ${pairAddresses.length} pair(s)...`);
        const startTime = Date.now();

        const results = [];
        let withdrawnCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (const pairAddress of pairAddresses) {
            const result = await this.checkAndWithdraw(pairAddress, slippage);
            results.push(result);

            if (result.withdrawn) {
                withdrawnCount++;
            } else if (result.reason === 'No LP balance') {
                skippedCount++;
            } else {
                failedCount++;
            }
        }

        const elapsedTime = Date.now() - startTime;

        logger.info(`✅ Bulk withdrawal complete in ${elapsedTime}ms`);
        logger.info(`   Withdrawn: ${withdrawnCount}, Skipped: ${skippedCount}, Failed: ${failedCount}`);

        return {
            total: pairAddresses.length,
            withdrawn: withdrawnCount,
            skipped: skippedCount,
            failed: failedCount,
            wallet: this.wallet.address,
            elapsedMs: elapsedTime,
            results
        };
    }
}

module.exports = LiquidityManager;
