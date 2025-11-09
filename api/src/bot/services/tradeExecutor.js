const { ethers } = require('ethers');
const logger = require('../../utils/logger');
const PriceOracleV3 = require('./priceOracleV3');

// Contract ABIs
const PancakeRouterV2ABI = require('../../../contracts/abis/IPancakeRouter.json');
const PancakeRouterV3ABI = require('../../../contracts/abis/IPancakeV3SwapRouter.json');
const ERC20ABI = require('../../../contracts/MagicWorldToken.json').abi;

class TradeExecutor {
    constructor() {
        // Use BSC Mainnet for production trading
        this.provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);

        // Initialize price oracle for V3
        this.priceOracle = new PriceOracleV3();

        // Create wallet instance for signing transactions
        this.wallet = new ethers.Wallet(
            process.env.BOT_WALLET_PRIVATE_KEY,
            this.provider
        );

        // Determine if using V3 or V2
        this.isV3 = process.env.IS_V3_POOL === 'true';

        // Initialize router contract with signer (V3 or V2)
        const routerABI = this.isV3 ? PancakeRouterV3ABI : PancakeRouterV2ABI;
        this.router = new ethers.Contract(
            process.env.PANCAKE_ROUTER_ADDRESS,
            routerABI,
            this.wallet
        );

        // Initialize MWT token contract with signer
        this.mwtToken = new ethers.Contract(
            process.env.TOKEN_CONTRACT_ADDRESS,
            ERC20ABI,
            this.wallet
        );

        // WBNB address for swap paths
        this.WBNB = process.env.WBNB_ADDRESS;

        // V3 pool fee tier (2500 = 0.25%)
        this.V3_FEE = 2500;

        // Track nonces to prevent nonce conflicts
        this.pendingNonce = null;

        logger.info(`TradeExecutor initialized with ${this.isV3 ? 'V3' : 'V2'} router`);
    }

    /**
     * Execute BUY operation (BNB → MWT)
     * @param {number} bnbAmount - Amount of BNB to spend
     * @param {number} minMWTOut - Minimum MWT to receive
     * @param {number} slippage - Slippage tolerance (default 2%)
     * @param {string} urgency - Trade urgency: LOW, MEDIUM, HIGH, EMERGENCY
     * @returns {Promise<Object>} Trade result
     */
    async executeBuy(bnbAmount, minMWTOut, slippage = 0.02, urgency = 'MEDIUM') {
        if (this.isV3) {
            return this.executeBuyV3(bnbAmount, minMWTOut, slippage, urgency);
        } else {
            return this.executeBuyV2(bnbAmount, minMWTOut, slippage, urgency);
        }
    }

    /**
     * Execute BUY operation on V3 (BNB → MWT)
     */
    async executeBuyV3(bnbAmount, minMWTOut, slippage = 0.02, urgency = 'MEDIUM') {
        try {
            logger.info(`🔵 Executing V3 BUY: ${bnbAmount} BNB → MWT (slippage: ${slippage * 100}%)`);

            // 1. Check BNB balance
            const balance = await this.provider.getBalance(this.wallet.address);
            const required = ethers.parseEther(bnbAmount.toString());

            if (balance < required) {
                throw new Error(
                    `Insufficient BNB balance. Have: ${ethers.formatEther(balance)}, Need: ${bnbAmount}`
                );
            }

            logger.info(`✅ Balance check passed: ${ethers.formatEther(balance)} BNB available`);

            // 2. Estimate output amount
            const estimate = await this.estimateSwapOutput(bnbAmount, true);
            const expectedOut = parseFloat(estimate.amountOut);

            // 3. Calculate minimum output with slippage protection
            const minOut = ethers.parseEther((expectedOut * (1 - slippage)).toFixed(18));
            logger.info(`📊 Expected out: ${expectedOut} MWT`);
            logger.info(`📊 Min MWT out (with ${slippage * 100}% slippage): ${ethers.formatEther(minOut)}`);

            // 4. Set deadline (20 minutes from now)
            const deadline = Math.floor(Date.now() / 1000) + 1200;

            // 5. Prepare V3 swap params for BUY (BNB → MWT)
            // deadline is passed in multicall, not in params
            const params = {
                tokenIn: this.WBNB,      // Input: WBNB
                tokenOut: this.mwtToken.target, // Output: MWT (use .target for address)
                fee: this.V3_FEE,
                recipient: this.wallet.address, // Receive MWT tokens
                amountIn: required,      // BNB amount to spend
                amountOutMinimum: minOut, // Min MWT to receive
                sqrtPriceLimitX96: 0
            };

            // 6. Get optimal gas price based on urgency
            const gasPrice = await this.getOptimalGasPrice(urgency);
            logger.info(`⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei (${urgency})`);

            // 7. Get next nonce
            const nonce = await this.getNextNonce();
            logger.info(`🔢 Using nonce: ${nonce}`);

            // 8. Estimate gas limit
            let gasLimit;
            try {
                gasLimit = await this.router.exactInputSingle.estimateGas(params, { value: required });
                logger.info(`📊 Estimated gas: ${gasLimit.toString()}`);
            } catch (estimateError) {
                logger.warn(`⚠️ Gas estimation failed, using default: ${estimateError.message}`);
                gasLimit = 300000n; // Default gas limit for V3 swaps
            }

            // 9. Execute swap using multicall for better error handling
            logger.info(`📤 Sending V3 swap transaction...`);
            
            const swapData = this.router.interface.encodeFunctionData('exactInputSingle', [params]);
            const refundData = this.router.interface.encodeFunctionData('refundETH', []);
            
            const tx = await this.router.multicall(
                deadline, // Pass deadline as first parameter
                [swapData, refundData],
                {
                    value: required,
                    gasPrice,
                    gasLimit: gasLimit + (gasLimit * 20n / 100n), // Add 20% buffer
                    nonce
                }
            );            logger.info(`📤 Transaction sent: ${tx.hash}`);

            // 10. Wait for confirmation
            logger.info(`⏳ Waiting for confirmation...`);
            const receipt = await tx.wait();

            // 11. Calculate actual gas cost
            const gasCost = receipt.gasUsed * receipt.gasPrice;
            const gasCostBNB = ethers.formatEther(gasCost);

            logger.info(`✅ V3 BUY executed successfully!`);
            logger.info(`   Block: ${receipt.blockNumber}`);
            logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            logger.info(`   Gas cost: ${gasCostBNB} BNB`);

            return {
                success: true,
                action: 'BUY',
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: receipt.gasPrice.toString(),
                gasCostBNB,
                inputAmount: bnbAmount,
                inputToken: 'BNB',
                outputToken: 'MWT',
                minOutputAmount: ethers.formatEther(minOut),
                path: [this.WBNB, process.env.TOKEN_CONTRACT_ADDRESS],
                slippage,
                urgency,
                poolType: 'V3',
                fee: this.V3_FEE,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error(`❌ V3 BUY execution failed:`, error);

            // Parse error for better reporting
            const errorMessage = this.parseError(error);

            return {
                success: false,
                action: 'BUY',
                error: errorMessage,
                inputAmount: bnbAmount,
                inputToken: 'BNB',
                outputToken: 'MWT',
                timestamp: new Date()
            };
        }
    }

    /**
     * Execute BUY operation on V2 (BNB → MWT)
     */
    async executeBuyV2(bnbAmount, minMWTOut, slippage = 0.02, urgency = 'MEDIUM') {
        try {
            logger.info(`🔵 Executing V2 BUY: ${bnbAmount} BNB → MWT (slippage: ${slippage * 100}%)`);

            // 1. Check BNB balance
            const balance = await this.provider.getBalance(this.wallet.address);
            const required = ethers.parseEther(bnbAmount.toString());

            if (balance < required) {
                throw new Error(
                    `Insufficient BNB balance. Have: ${ethers.formatEther(balance)}, Need: ${bnbAmount}`
                );
            }

            logger.info(`✅ Balance check passed: ${ethers.formatEther(balance)} BNB available`);

            // 2. Calculate minimum output with slippage protection
            const minOut = ethers.parseEther((minMWTOut * (1 - slippage)).toFixed(18));
            logger.info(`📊 Min MWT out (with ${slippage * 100}% slippage): ${ethers.formatEther(minOut)}`);

            // 3. Set deadline (20 minutes from now)
            const deadline = Math.floor(Date.now() / 1000) + 1200;

            // 4. Define swap path: WBNB → MWT
            const path = [this.WBNB, process.env.TOKEN_CONTRACT_ADDRESS];

            // 5. Get optimal gas price based on urgency
            const gasPrice = await this.getOptimalGasPrice(urgency);
            logger.info(`⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei (${urgency})`);

            // 6. Get next nonce
            const nonce = await this.getNextNonce();
            logger.info(`🔢 Using nonce: ${nonce}`);

            // 7. Estimate gas limit
            const gasLimit = await this.router.swapExactETHForTokens.estimateGas(
                minOut,
                path,
                this.wallet.address,
                deadline,
                { value: required }
            );
            logger.info(`📊 Estimated gas: ${gasLimit.toString()}`);

            // 8. Execute swap
            logger.info(`📤 Sending transaction...`);
            const tx = await this.router.swapExactETHForTokens(
                minOut,
                path,
                this.wallet.address,
                deadline,
                {
                    value: required,
                    gasPrice,
                    gasLimit: gasLimit + (gasLimit * 20n / 100n), // Add 20% buffer
                    nonce
                }
            );

            logger.info(`📤 Transaction sent: ${tx.hash}`);

            // 9. Wait for confirmation
            logger.info(`⏳ Waiting for confirmation...`);
            const receipt = await tx.wait();

            // 10. Calculate actual gas cost
            const gasCost = receipt.gasUsed * receipt.gasPrice;
            const gasCostBNB = ethers.formatEther(gasCost);

            logger.info(`✅ V2 BUY executed successfully!`);
            logger.info(`   Block: ${receipt.blockNumber}`);
            logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            logger.info(`   Gas cost: ${gasCostBNB} BNB`);

            return {
                success: true,
                action: 'BUY',
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: receipt.gasPrice.toString(),
                gasCostBNB,
                inputAmount: bnbAmount,
                inputToken: 'BNB',
                outputToken: 'MWT',
                minOutputAmount: ethers.formatEther(minOut),
                path,
                slippage,
                urgency,
                poolType: 'V2',
                timestamp: new Date()
            };

        } catch (error) {
            logger.error(`❌ V2 BUY execution failed:`, error);

            // Parse error for better reporting
            const errorMessage = this.parseError(error);

            return {
                success: false,
                action: 'BUY',
                error: errorMessage,
                inputAmount: bnbAmount,
                inputToken: 'BNB',
                outputToken: 'MWT',
                timestamp: new Date()
            };
        }
    }

    /**
     * Execute SELL operation (MWT → BNB)
     * @param {number} mwtAmount - Amount of MWT to sell
     * @param {number} minBNBOut - Minimum BNB to receive
     * @param {number} slippage - Slippage tolerance (default 2%)
     * @param {string} urgency - Trade urgency: LOW, MEDIUM, HIGH, EMERGENCY
     * @returns {Promise<Object>} Trade result
     */
    async executeSell(mwtAmount, minBNBOut, slippage = 0.02, urgency = 'MEDIUM') {
        if (this.isV3) {
            return this.executeSellV3(mwtAmount, minBNBOut, slippage, urgency);
        } else {
            return this.executeSellV2(mwtAmount, minBNBOut, slippage, urgency);
        }
    }

    /**
     * Execute SELL operation on V3 (MWT → BNB)
     */
    async executeSellV3(mwtAmount, minBNBOut, slippage = 0.02, urgency = 'MEDIUM') {
        try {
            logger.info(`🔴 Executing V3 SELL: ${mwtAmount} MWT → BNB (slippage: ${slippage * 100}%)`);

            // 1. Check MWT balance
            const balance = await this.mwtToken.balanceOf(this.wallet.address);
            const required = ethers.parseEther(mwtAmount.toString());

            if (balance < required) {
                throw new Error(
                    `Insufficient MWT balance. Have: ${ethers.formatEther(balance)}, Need: ${mwtAmount}`
                );
            }

            logger.info(`✅ Balance check passed: ${ethers.formatEther(balance)} MWT available`);

            // 2. Check and approve if needed
            await this.ensureApproval(required);

            // 3. Estimate output amount
            const estimate = await this.estimateSwapOutput(mwtAmount, false);
            const expectedOut = parseFloat(estimate.amountOut);

            // 4. Calculate minimum output with slippage protection
            const minOut = ethers.parseEther((expectedOut * (1 - slippage)).toFixed(18));
            logger.info(`📊 Expected out: ${expectedOut} BNB`);
            logger.info(`📊 Min BNB out (with ${slippage * 100}% slippage): ${ethers.formatEther(minOut)}`);

            // 5. Set deadline (20 minutes from now)
            const deadline = Math.floor(Date.now() / 1000) + 1200;

            // 6. Prepare V3 swap params (deadline is passed in multicall, not in params)
            // For SELL: recipient gets WBNB which will be unwrapped to BNB in multicall
            const params = {
                tokenIn: process.env.TOKEN_CONTRACT_ADDRESS,
                tokenOut: this.WBNB,
                fee: this.V3_FEE,
                recipient: this.wallet.address, // Receive WBNB directly, unwrap happens in multicall
                amountIn: required,
                amountOutMinimum: minOut,
                sqrtPriceLimitX96: 0 // No price limit
            };

            // 7. Get optimal gas price based on urgency
            const gasPrice = await this.getOptimalGasPrice(urgency);
            logger.info(`⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei (${urgency})`);

            // 8. Get next nonce
            const nonce = await this.getNextNonce();
            logger.info(`🔢 Using nonce: ${nonce}`);

            // 9. Estimate gas limit
            let gasLimit;
            try {
                gasLimit = await this.router.exactInputSingle.estimateGas(params);
                logger.info(`📊 Estimated gas: ${gasLimit.toString()}`);
            } catch (estimateError) {
                logger.warn(`⚠️ Gas estimation failed, using default: ${estimateError.message}`);
                gasLimit = 300000n; // Default gas limit for V3 swaps
            }

            // 10. Execute swap using multicall (swap + unwrap WBNB to BNB)
            logger.info(`📤 Sending V3 swap transaction...`);
            
            const swapData = this.router.interface.encodeFunctionData('exactInputSingle', [params]);
            // Use unwrapWETH9 with 2 parameters: (amountMinimum, recipient)
            const unwrapData = this.router.interface.encodeFunctionData('unwrapWETH9(uint256,address)', [
                0, // Accept any amount (already protected by minOut in swap)
                this.wallet.address
            ]);

            const tx = await this.router.multicall(
                deadline, // Pass deadline as first parameter
                [swapData, unwrapData],
                {
                    gasPrice,
                    gasLimit: gasLimit + (gasLimit * 20n / 100n), // Add 20% buffer
                    nonce
                }
            );            logger.info(`📤 Transaction sent: ${tx.hash}`);

            // 11. Wait for confirmation
            logger.info(`⏳ Waiting for confirmation...`);
            const receipt = await tx.wait();

            // 12. Calculate actual gas cost
            const gasCost = receipt.gasUsed * receipt.gasPrice;
            const gasCostBNB = ethers.formatEther(gasCost);

            logger.info(`✅ V3 SELL executed successfully!`);
            logger.info(`   Block: ${receipt.blockNumber}`);
            logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            logger.info(`   Gas cost: ${gasCostBNB} BNB`);

            return {
                success: true,
                action: 'SELL',
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: receipt.gasPrice.toString(),
                gasCostBNB,
                inputAmount: mwtAmount,
                inputToken: 'MWT',
                outputToken: 'BNB',
                minOutputAmount: ethers.formatEther(minOut),
                path: [process.env.TOKEN_CONTRACT_ADDRESS, this.WBNB],
                slippage,
                urgency,
                poolType: 'V3',
                fee: this.V3_FEE,
                timestamp: new Date()
            };

        } catch (error) {
            logger.error(`❌ V3 SELL execution failed:`, error);

            // Parse error for better reporting
            const errorMessage = this.parseError(error);

            return {
                success: false,
                action: 'SELL',
                error: errorMessage,
                inputAmount: mwtAmount,
                inputToken: 'MWT',
                outputToken: 'BNB',
                timestamp: new Date()
            };
        }
    }

    /**
     * Execute SELL operation on V2 (MWT → BNB)
     */
    async executeSellV2(mwtAmount, minBNBOut, slippage = 0.02, urgency = 'MEDIUM') {
        try {
            logger.info(`🔴 Executing V2 SELL: ${mwtAmount} MWT → BNB (slippage: ${slippage * 100}%)`);

            // 1. Check MWT balance
            const balance = await this.mwtToken.balanceOf(this.wallet.address);
            const required = ethers.parseEther(mwtAmount.toString());

            if (balance < required) {
                throw new Error(
                    `Insufficient MWT balance. Have: ${ethers.formatEther(balance)}, Need: ${mwtAmount}`
                );
            }

            logger.info(`✅ Balance check passed: ${ethers.formatEther(balance)} MWT available`);

            // 2. Check and approve if needed
            await this.ensureApproval(required);

            // 3. Calculate minimum output with slippage protection
            const minOut = ethers.parseEther((minBNBOut * (1 - slippage)).toFixed(18));
            logger.info(`📊 Min BNB out (with ${slippage * 100}% slippage): ${ethers.formatEther(minOut)}`);

            // 4. Set deadline (20 minutes from now)
            const deadline = Math.floor(Date.now() / 1000) + 1200;

            // 5. Define swap path: MWT → WBNB
            const path = [process.env.TOKEN_CONTRACT_ADDRESS, this.WBNB];

            // 6. Get optimal gas price based on urgency
            const gasPrice = await this.getOptimalGasPrice(urgency);
            logger.info(`⛽ Gas price: ${ethers.formatUnits(gasPrice, 'gwei')} Gwei (${urgency})`);

            // 7. Get next nonce
            const nonce = await this.getNextNonce();
            logger.info(`🔢 Using nonce: ${nonce}`);

            // 8. Estimate gas limit
            const gasLimit = await this.router.swapExactTokensForETH.estimateGas(
                required,
                minOut,
                path,
                this.wallet.address,
                deadline
            );
            logger.info(`📊 Estimated gas: ${gasLimit.toString()}`);

            // 9. Execute swap
            logger.info(`📤 Sending transaction...`);
            const tx = await this.router.swapExactTokensForETH(
                required,
                minOut,
                path,
                this.wallet.address,
                deadline,
                {
                    gasPrice,
                    gasLimit: gasLimit + (gasLimit * 20n / 100n), // Add 20% buffer
                    nonce
                }
            );

            logger.info(`📤 Transaction sent: ${tx.hash}`);

            // 10. Wait for confirmation
            logger.info(`⏳ Waiting for confirmation...`);
            const receipt = await tx.wait();

            // 11. Calculate actual gas cost
            const gasCost = receipt.gasUsed * receipt.gasPrice;
            const gasCostBNB = ethers.formatEther(gasCost);

            logger.info(`✅ V2 SELL executed successfully!`);
            logger.info(`   Block: ${receipt.blockNumber}`);
            logger.info(`   Gas used: ${receipt.gasUsed.toString()}`);
            logger.info(`   Gas cost: ${gasCostBNB} BNB`);

            return {
                success: true,
                action: 'SELL',
                txHash: tx.hash,
                blockNumber: receipt.blockNumber,
                gasUsed: receipt.gasUsed.toString(),
                gasPrice: receipt.gasPrice.toString(),
                gasCostBNB,
                inputAmount: mwtAmount,
                inputToken: 'MWT',
                outputToken: 'BNB',
                minOutputAmount: ethers.formatEther(minOut),
                path,
                slippage,
                urgency,
                poolType: 'V2',
                timestamp: new Date()
            };

        } catch (error) {
            logger.error(`❌ V2 SELL execution failed:`, error);

            // Parse error for better reporting
            const errorMessage = this.parseError(error);

            return {
                success: false,
                action: 'SELL',
                error: errorMessage,
                inputAmount: mwtAmount,
                inputToken: 'MWT',
                outputToken: 'BNB',
                timestamp: new Date()
            };
        }
    }

    /**
     * Ensure MWT token is approved for router
     * @param {BigInt} amount - Amount to approve
     */
    async ensureApproval(amount) {
        try {
            const currentAllowance = await this.mwtToken.allowance(
                this.wallet.address,
                process.env.PANCAKE_ROUTER_ADDRESS
            );

            if (currentAllowance < amount) {
                logger.info(`🔓 Current allowance insufficient: ${ethers.formatEther(currentAllowance)} MWT`);
                logger.info(`🔓 Approving MWT for router...`);

                // Approve max amount to avoid repeated approvals
                const maxApproval = ethers.MaxUint256;

                const nonce = await this.getNextNonce();
                const tx = await this.mwtToken.approve(
                    process.env.PANCAKE_ROUTER_ADDRESS,
                    maxApproval,
                    {
                        gasLimit: 100000,
                        nonce
                    }
                );

                logger.info(`📤 Approval transaction sent: ${tx.hash}`);
                await tx.wait();
                logger.info(`✅ Approval confirmed - Max allowance granted`);
            } else {
                logger.info(`✅ Allowance sufficient: ${ethers.formatEther(currentAllowance)} MWT`);
            }

        } catch (error) {
            logger.error(`❌ Approval failed:`, error);
            throw error;
        }
    }

    /**
     * Get optimal gas price based on urgency
     * @param {string} urgency - LOW, MEDIUM, HIGH, EMERGENCY
     * @returns {Promise<BigInt>} Gas price in wei
     */
    async getOptimalGasPrice(urgency = 'MEDIUM') {
        try {
            const feeData = await this.provider.getFeeData();
            const baseGasPrice = feeData.gasPrice;

            // Multipliers based on urgency
            const multipliers = {
                'LOW': 1.0,
                'MEDIUM': 1.1,
                'HIGH': 1.2,
                'EMERGENCY': 1.5
            };

            const multiplier = multipliers[urgency] || 1.1;
            const adjustedGasPrice = baseGasPrice * BigInt(Math.floor(multiplier * 100)) / 100n;

            return adjustedGasPrice;

        } catch (error) {
            logger.error('Error getting gas price:', error);
            // Fallback to 5 Gwei (typical BSC gas price)
            return ethers.parseUnits('5', 'gwei');
        }
    }

    /**
     * Get next nonce for wallet (handles pending transactions)
     * @returns {Promise<number>} Next nonce
     */
    async getNextNonce() {
        try {
            if (this.pendingNonce !== null) {
                // Use pending nonce and increment
                const nonce = this.pendingNonce;
                this.pendingNonce++;
                return nonce;
            }

            // Get current nonce from network (including pending)
            const nonce = await this.provider.getTransactionCount(
                this.wallet.address,
                'pending'
            );

            // Set pending nonce for next transaction
            this.pendingNonce = nonce + 1;

            return nonce;

        } catch (error) {
            logger.error('Error getting nonce:', error);
            throw error;
        }
    }

    /**
     * Reset nonce tracker (call after transactions are confirmed)
     */
    resetNonce() {
        this.pendingNonce = null;
        logger.debug('Nonce tracker reset');
    }

    /**
     * Get wallet balances (BNB and MWT)
     * @returns {Promise<Object>} Wallet balances
     */
    async getBalances() {
        try {
            const bnbBalance = await this.provider.getBalance(this.wallet.address);
            const mwtBalance = await this.mwtToken.balanceOf(this.wallet.address);

            return {
                bnb: ethers.formatEther(bnbBalance),
                mwt: ethers.formatEther(mwtBalance),
                bnbRaw: bnbBalance.toString(),
                mwtRaw: mwtBalance.toString(),
                address: this.wallet.address
            };

        } catch (error) {
            logger.error('Error fetching balances:', error);
            throw error;
        }
    }

    /**
     * Estimate swap output (dry run without executing)
     * Uses V3 pool price to calculate expected output
     * @param {number} amountIn - Input amount
     * @param {boolean} isBuy - true for BUY (BNB→MWT), false for SELL (MWT→BNB)
     * @returns {Promise<Object>} Estimated output
     */
    async estimateSwapOutput(amountIn, isBuy) {
        try {
            // Get current price from V3 pool
            const prices = await this.priceOracle.getAllPrices();
            const mwtBnbPrice = prices.mwtBnb; // MWT price in BNB

            let amountOut;
            let inputToken;
            let outputToken;

            if (isBuy) {
                // BUY: BNB → MWT
                // If we spend X BNB, we get X / mwtBnbPrice MWT
                amountOut = amountIn / mwtBnbPrice;
                inputToken = 'BNB';
                outputToken = 'MWT';
            } else {
                // SELL: MWT → BNB
                // If we sell X MWT, we get X * mwtBnbPrice BNB
                amountOut = amountIn * mwtBnbPrice;
                inputToken = 'MWT';
                outputToken = 'BNB';
            }

            // Apply 0.25% fee (PancakeSwap V3 fee tier)
            const feeMultiplier = 0.9975; // 1 - 0.0025
            amountOut = amountOut * feeMultiplier;

            return {
                amountIn: amountIn.toString(),
                amountOut: amountOut.toString(),
                price: isBuy ? mwtBnbPrice : (1 / mwtBnbPrice),
                inputToken,
                outputToken,
                feePercent: 0.25,
                poolType: 'V3',
                priceImpact: 0 // V3 price impact would require more complex calculation
            };

        } catch (error) {
            logger.error('Error estimating swap:', error);
            throw error;
        }
    }

    /**
     * Calculate price impact of a trade
     * @param {number} amountIn - Input amount
     * @param {number} amountOut - Expected output amount
     * @param {number} currentPrice - Current market price
     * @returns {number} Price impact percentage
     */
    calculatePriceImpact(amountIn, amountOut, currentPrice) {
        const effectivePrice = amountIn / amountOut;
        const priceImpact = ((effectivePrice - currentPrice) / currentPrice) * 100;
        return priceImpact;
    }

    /**
     * Parse error message for better user feedback
     * @param {Error} error - Error object
     * @returns {string} Parsed error message
     */
    parseError(error) {
        const message = error.message || error.toString();

        // Common PancakeSwap/DEX errors
        if (message.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
            return 'Slippage tolerance exceeded - try increasing slippage or reducing trade size';
        }
        if (message.includes('INSUFFICIENT_INPUT_AMOUNT')) {
            return 'Input amount too small for swap';
        }
        if (message.includes('INSUFFICIENT_LIQUIDITY')) {
            return 'Insufficient liquidity in the pool';
        }
        if (message.includes('TRANSFER_FAILED')) {
            return 'Token transfer failed - check allowance and balance';
        }
        if (message.includes('EXPIRED')) {
            return 'Transaction deadline expired';
        }
        if (message.includes('insufficient funds')) {
            return 'Insufficient funds for gas + trade amount';
        }
        if (message.includes('nonce')) {
            return 'Nonce conflict - transaction already pending';
        }
        if (message.includes('gas')) {
            return 'Gas estimation failed or gas price too low';
        }

        // Return original message if no match
        return message;
    }

    /**
     * Check if wallet has sufficient funds for trade
     * @param {number} amount - Trade amount
     * @param {string} token - Token symbol (BNB or MWT)
     * @param {number} gasEstimate - Estimated gas cost in BNB
     * @returns {Promise<Object>} Sufficiency check result
     */
    async checkSufficientFunds(amount, token, gasEstimate = 0.001) {
        try {
            const balances = await this.getBalances();

            if (token === 'BNB') {
                const required = amount + gasEstimate;
                const available = parseFloat(balances.bnb);

                return {
                    sufficient: available >= required,
                    required,
                    available,
                    shortfall: available < required ? required - available : 0,
                    token: 'BNB'
                };
            }

            if (token === 'MWT') {
                const required = amount;
                const available = parseFloat(balances.mwt);

                // Also check BNB for gas
                const bnbRequired = gasEstimate;
                const bnbAvailable = parseFloat(balances.bnb);

                return {
                    sufficient: available >= required && bnbAvailable >= bnbRequired,
                    required,
                    available,
                    shortfall: available < required ? required - available : 0,
                    token: 'MWT',
                    gasCheck: {
                        sufficient: bnbAvailable >= bnbRequired,
                        required: bnbRequired,
                        available: bnbAvailable
                    }
                };
            }

            throw new Error(`Unknown token: ${token}`);

        } catch (error) {
            logger.error('Error checking funds:', error);
            throw error;
        }
    }
}

module.exports = TradeExecutor;
