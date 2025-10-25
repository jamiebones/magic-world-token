const { ethers } = require('ethers');
const logger = require('../utils/logger');
const DistributionFinalization = require('../models/DistributionFinalization');
const MagicWorldGameABI = require('../../contracts/MagicWorldGame.json');

/**
 * Service for auto-finalizing expired Merkle distributions
 * Returns unclaimed tokens to vaults by calling finalizeDistribution on-chain
 */
class DistributionFinalizer {
    constructor() {
        this.isInitialized = false;
        this.provider = null;
        this.wallet = null;
        this.gameContract = null;
        this.isRunning = false;
    }

    /**
     * Initialize the finalizer with contract and wallet configuration
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // Validate required environment variables
            const requiredEnvVars = [
                'RPC_URL',
                'GAME_CONTRACT_ADDRESS',
                'FINALIZATION_WALLET_PRIVATE_KEY'
            ];

            for (const envVar of requiredEnvVars) {
                if (!process.env[envVar]) {
                    throw new Error(`Missing required environment variable: ${envVar}`);
                }
            }

            // Setup provider and wallet
            this.provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            this.wallet = new ethers.Wallet(
                process.env.FINALIZATION_WALLET_PRIVATE_KEY,
                this.provider
            );

            // Initialize game contract
            this.gameContract = new ethers.Contract(
                process.env.GAME_CONTRACT_ADDRESS,
                MagicWorldGameABI.abi,
                this.wallet
            );

            this.isInitialized = true;

            logger.info('DistributionFinalizer initialized', {
                gameContract: process.env.GAME_CONTRACT_ADDRESS,
                finalizerWallet: this.wallet.address,
                network: process.env.NETWORK || 'unknown'
            });
        } catch (error) {
            logger.error('Failed to initialize DistributionFinalizer', { error: error.message });
            throw error;
        }
    }

    /**
     * Check if auto-finalization is enabled
     */
    isEnabled() {
        return process.env.ENABLE_AUTO_FINALIZATION === 'true';
    }

    /**
     * Get the maximum number of finalizations per run
     */
    getMaxFinalizationsPerRun() {
        return parseInt(process.env.MAX_FINALIZATIONS_PER_RUN || '50', 10);
    }

    /**
     * Check wallet balance and ensure sufficient gas
     */
    async checkWalletBalance() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const balance = await this.provider.getBalance(this.wallet.address);
        const balanceInEth = ethers.formatEther(balance);

        // Minimum balance: 0.01 BNB (enough for ~100 transactions)
        const minBalance = ethers.parseEther('0.01');

        if (balance < minBalance) {
            logger.warn('Finalization wallet balance low', {
                address: this.wallet.address,
                balance: balanceInEth,
                minRequired: '0.01'
            });
            return false;
        }

        return true;
    }

    /**
     * Fetch expired distributions from blockchain
     * Returns array of distribution IDs that are expired but not finalized
     */
    async fetchExpiredDistributions() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const currentTime = Math.floor(Date.now() / 1000);
            const expiredDistributions = [];

            // Get next distribution ID from contract
            const nextDistributionId = await this.gameContract.nextDistributionId();
            const maxId = Number(nextDistributionId);

            logger.info('Scanning for expired distributions', {
                maxDistributionId: maxId,
                currentTime
            });

            // Check each distribution
            for (let distributionId = 0; distributionId < maxId; distributionId++) {
                try {
                    const info = await this.gameContract.getDistributionInfo(distributionId);

                    const [
                        merkleRoot,
                        totalAllocated,
                        totalClaimed,
                        startTime,
                        endTime,
                        vaultType,
                        finalized,
                        isActive,
                        unclaimedAmount
                    ] = info;

                    // Skip if already finalized
                    if (finalized) {
                        continue;
                    }

                    // Check if expired
                    const endTimeNum = Number(endTime);
                    if (currentTime >= endTimeNum) {
                        expiredDistributions.push({
                            distributionId,
                            endTime: endTimeNum,
                            totalAllocated: totalAllocated.toString(),
                            totalClaimed: totalClaimed.toString(),
                            unclaimedAmount: unclaimedAmount.toString(),
                            vaultType: Number(vaultType)
                        });

                        logger.info('Found expired distribution', {
                            distributionId,
                            endTime: new Date(endTimeNum * 1000).toISOString(),
                            unclaimedAmount: ethers.formatEther(unclaimedAmount)
                        });
                    }
                } catch (error) {
                    // Distribution might not exist, skip
                    logger.debug(`Skipping distribution ${distributionId}`, { error: error.message });
                }
            }

            logger.info('Expired distributions scan complete', {
                totalFound: expiredDistributions.length
            });

            return expiredDistributions;
        } catch (error) {
            logger.error('Failed to fetch expired distributions', { error: error.message });
            throw error;
        }
    }

    /**
     * Finalize a single distribution
     */
    async finalizeDistribution(distributionId, distributionInfo) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        // Create finalization record
        const finalizationRecord = new DistributionFinalization({
            distributionId,
            status: 'pending',
            executionType: 'auto',
            executedBy: 'cron',
            distributionEndTime: new Date(distributionInfo.endTime * 1000),
            totalAllocated: distributionInfo.totalAllocated,
            totalClaimed: distributionInfo.totalClaimed,
            unclaimedAmount: distributionInfo.unclaimedAmount,
            vaultType: distributionInfo.vaultType
        });

        await finalizationRecord.save();

        try {
            logger.info('Finalizing distribution', {
                distributionId,
                unclaimedAmount: ethers.formatEther(distributionInfo.unclaimedAmount)
            });

            // Estimate gas
            const gasEstimate = await this.gameContract.finalizeDistribution.estimateGas(distributionId);
            const gasLimit = gasEstimate * 120n / 100n; // Add 20% buffer

            // Execute finalization transaction
            const tx = await this.gameContract.finalizeDistribution(distributionId, {
                gasLimit
            });

            logger.info('Finalization transaction submitted', {
                distributionId,
                txHash: tx.hash
            });

            // Wait for confirmation
            const receipt = await tx.wait();

            if (receipt.status === 1) {
                // Transaction successful
                await finalizationRecord.markSuccess(
                    receipt.hash,
                    receipt.blockNumber,
                    receipt.gasUsed.toString(),
                    distributionInfo.unclaimedAmount,
                    distributionInfo.vaultType
                );

                logger.info('Distribution finalized successfully', {
                    distributionId,
                    txHash: receipt.hash,
                    blockNumber: receipt.blockNumber,
                    gasUsed: receipt.gasUsed.toString()
                });

                return {
                    success: true,
                    txHash: receipt.hash,
                    gasUsed: receipt.gasUsed.toString()
                };
            } else {
                // Transaction failed
                const error = 'Transaction reverted';
                await finalizationRecord.markFailed(error);

                logger.error('Distribution finalization failed', {
                    distributionId,
                    txHash: receipt.hash,
                    error
                });

                return {
                    success: false,
                    error
                };
            }
        } catch (error) {
            // Handle errors
            let errorMessage = error.message;

            // Check if it's a common error
            if (error.message.includes('Distribution does not exist')) {
                errorMessage = 'Distribution does not exist';
                await finalizationRecord.markSkipped(errorMessage);
            } else if (error.message.includes('Already finalized')) {
                errorMessage = 'Already finalized';
                await finalizationRecord.markSkipped(errorMessage);
            } else if (error.message.includes('Not expired yet')) {
                errorMessage = 'Not expired yet';
                await finalizationRecord.markSkipped(errorMessage);
            } else {
                // Generic error - mark as failed and schedule retry
                await finalizationRecord.markFailed(errorMessage);

                // Schedule retry if under max retries
                if (finalizationRecord.retryCount < 3) {
                    const retryDelay = (finalizationRecord.retryCount + 1) * 3600000; // 1hr, 2hr, 3hr
                    await finalizationRecord.scheduleRetry(retryDelay);

                    logger.warn('Distribution finalization failed, scheduled for retry', {
                        distributionId,
                        retryCount: finalizationRecord.retryCount,
                        nextRetryAt: finalizationRecord.nextRetryAt
                    });
                }
            }

            logger.error('Distribution finalization error', {
                distributionId,
                error: errorMessage
            });

            return {
                success: false,
                error: errorMessage
            };
        }
    }

    /**
     * Run the auto-finalization process
     * Fetches expired distributions and finalizes them
     */
    async run() {
        if (this.isRunning) {
            logger.warn('Finalization already running, skipping this run');
            return {
                success: false,
                error: 'Already running'
            };
        }

        if (!this.isEnabled()) {
            logger.info('Auto-finalization is disabled');
            return {
                success: false,
                error: 'Auto-finalization disabled'
            };
        }

        this.isRunning = true;

        try {
            logger.info('Starting auto-finalization run');

            // Initialize if needed
            if (!this.isInitialized) {
                await this.initialize();
            }

            // Check wallet balance
            const hasBalance = await this.checkWalletBalance();
            if (!hasBalance) {
                logger.error('Insufficient wallet balance for finalization');
                return {
                    success: false,
                    error: 'Insufficient wallet balance'
                };
            }

            // Fetch expired distributions
            const expiredDistributions = await this.fetchExpiredDistributions();

            if (expiredDistributions.length === 0) {
                logger.info('No expired distributions to finalize');
                return {
                    success: true,
                    finalized: 0,
                    skipped: 0,
                    failed: 0
                };
            }

            // Limit number of finalizations per run
            const maxFinalizations = this.getMaxFinalizationsPerRun();
            const distributionsToProcess = expiredDistributions.slice(0, maxFinalizations);

            logger.info('Processing expired distributions', {
                total: expiredDistributions.length,
                processing: distributionsToProcess.length,
                limit: maxFinalizations
            });

            // Process each distribution
            const results = {
                finalized: 0,
                skipped: 0,
                failed: 0,
                transactions: []
            };

            for (const distribution of distributionsToProcess) {
                const result = await this.finalizeDistribution(
                    distribution.distributionId,
                    distribution
                );

                if (result.success) {
                    results.finalized++;
                    results.transactions.push({
                        distributionId: distribution.distributionId,
                        txHash: result.txHash,
                        gasUsed: result.gasUsed
                    });
                } else {
                    if (result.error.includes('Already finalized') ||
                        result.error.includes('does not exist')) {
                        results.skipped++;
                    } else {
                        results.failed++;
                    }
                }

                // Add delay between transactions to avoid nonce issues
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            logger.info('Auto-finalization run complete', results);

            return {
                success: true,
                ...results
            };
        } catch (error) {
            logger.error('Auto-finalization run failed', { error: error.message });
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * Process pending retries
     */
    async processRetries() {
        if (!this.isEnabled()) {
            return;
        }

        try {
            const pendingRetries = await DistributionFinalization.findPendingRetries();

            if (pendingRetries.length === 0) {
                return;
            }

            logger.info('Processing pending retries', { count: pendingRetries.length });

            for (const retry of pendingRetries) {
                // Re-fetch distribution info
                try {
                    const info = await this.gameContract.getDistributionInfo(retry.distributionId);
                    const [, totalAllocated, totalClaimed, , endTime, vaultType, finalized, , unclaimedAmount] = info;

                    if (finalized) {
                        await retry.markSkipped('Already finalized');
                        continue;
                    }

                    const distributionInfo = {
                        endTime: Number(endTime),
                        totalAllocated: totalAllocated.toString(),
                        totalClaimed: totalClaimed.toString(),
                        unclaimedAmount: unclaimedAmount.toString(),
                        vaultType: Number(vaultType)
                    };

                    await this.finalizeDistribution(retry.distributionId, distributionInfo);
                } catch (error) {
                    logger.error('Retry processing failed', {
                        distributionId: retry.distributionId,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Failed to process retries', { error: error.message });
        }
    }

    /**
     * Get finalization statistics
     */
    async getStats(days = 7) {
        return await DistributionFinalization.getSuccessRate(days);
    }

    /**
     * Get finalization history
     */
    async getHistory(limit = 100, status = null) {
        const query = status ? { status } : {};
        return await DistributionFinalization.find(query)
            .sort({ createdAt: -1 })
            .limit(limit);
    }
}

// Singleton instance
const distributionFinalizer = new DistributionFinalizer();

module.exports = distributionFinalizer;
