const { ethers } = require('ethers');
const WalletBalanceAlert = require('../models/WalletBalanceAlert');
const emailService = require('./emailService');
const logger = require('../utils/logger');

/**
 * Wallet Balance Monitor Service
 * Checks wallet balances and sends alerts when they fall below threshold
 */
class WalletBalanceMonitor {
    constructor() {
        this.provider = null;
        this.enabled = process.env.WALLET_BALANCE_CHECK_ENABLED === 'true';
        this.threshold = parseFloat(process.env.WALLET_BALANCE_LOW_THRESHOLD_BNB || '0.05');
        this.network = 'BSC Mainnet';
        this.chainId = 56;
        this.explorerBaseUrl = 'https://bscscan.com/address';
    }

    /**
     * Initialize provider
     */
    async initialize() {
        if (!this.enabled) {
            logger.info('💰 Wallet balance monitoring disabled (WALLET_BALANCE_CHECK_ENABLED=false)');
            return;
        }

        // Check required configuration
        if (!process.env.GAME_ADMIN_ADDRESS) {
            logger.warn('💰 Wallet balance monitoring not configured (missing GAME_ADMIN_ADDRESS)');
            logger.info('💰 To enable wallet monitoring:');
            logger.info('   1. Set WALLET_BALANCE_CHECK_ENABLED=true');
            logger.info('   2. Set GAME_ADMIN_ADDRESS=0x...your_wallet_address');
            logger.info('   3. Set WALLET_BALANCE_LOW_THRESHOLD_BNB=0.05');
            logger.info('   4. Configure email alerts (see email service)');
            return;
        }

        try {
            const rpcUrl = process.env.BSC_MAINNET_RPC_URL || 'https://bsc-dataseed1.binance.org/';
            this.provider = new ethers.JsonRpcProvider(rpcUrl);

            // Test connection
            const blockNumber = await this.provider.getBlockNumber();
            logger.info(`💰 Wallet balance monitor initialized successfully`);
            logger.info(`💰 Connected to BSC (block: ${blockNumber})`);
            logger.info(`💰 Monitoring: ${this.getMonitoredWallet()?.name} (${this.getMonitoredWallet()?.address})`);
            logger.info(`💰 Threshold: ${this.threshold} BNB`);
        } catch (error) {
            logger.error('❌ Failed to initialize wallet balance monitor:', error.message);
            logger.warn('💰 Wallet monitoring will be disabled until configuration is fixed');
            logger.info('💰 Common issues:');
            logger.info('   - Invalid BSC RPC URL');
            logger.info('   - Network connectivity issues');
            this.provider = null;
        }
    }

    /**
     * Get monitored wallet from configuration
     */
    getMonitoredWallet() {
        const walletAddress = process.env.GAME_ADMIN_ADDRESS;
        const walletName = process.env.MONITORED_WALLET_NAME || 'Game Admin Wallet';

        if (!walletAddress) {
            logger.warn('⚠️ No wallet address configured for monitoring (GAME_ADMIN_ADDRESS)');
            return null;
        }

        return {
            address: walletAddress,
            name: walletName,
        };
    }

    /**
     * Check wallet balance
     */
    async checkBalance(walletAddress) {
        if (!this.provider) {
            await this.initialize();
            if (!this.provider) {
                throw new Error('Provider not initialized');
            }
        }

        try {
            const balance = await this.provider.getBalance(walletAddress);
            const balanceInBNB = parseFloat(ethers.formatEther(balance));

            return {
                balance: balance.toString(),
                balanceInBNB,
                balanceFormatted: `${balanceInBNB.toFixed(6)} BNB`,
            };
        } catch (error) {
            logger.error(`❌ Failed to check balance for ${walletAddress}:`, error.message);
            throw error;
        }
    }

    /**
     * Check all monitored wallets and send alerts if needed
     */
    async checkAllWallets() {
        if (!this.enabled) {
            logger.info('💰 Wallet balance monitoring disabled');
            return {
                success: false,
                message: 'Wallet balance monitoring disabled',
            };
        }

        logger.info('💰 Starting wallet balance check...');

        const wallet = this.getMonitoredWallet();
        if (!wallet) {
            return {
                success: false,
                message: 'No wallet configured for monitoring',
            };
        }

        try {
            const result = await this.checkWalletAndAlert(wallet);

            logger.info('✅ Wallet balance check completed', {
                wallet: wallet.name,
                balance: result.balance,
                belowThreshold: result.belowThreshold,
                alertSent: result.alertSent,
            });

            return {
                success: true,
                result,
            };
        } catch (error) {
            logger.error('❌ Wallet balance check failed:', error.message);
            return {
                success: false,
                error: error.message,
            };
        }
    }

    /**
     * Check single wallet and send alert if balance is low
     */
    async checkWalletAndAlert(wallet) {
        const { address, name } = wallet;

        // Check current balance
        const balanceInfo = await this.checkBalance(address);
        const { balanceInBNB, balanceFormatted } = balanceInfo;

        const result = {
            walletName: name,
            walletAddress: address,
            balance: balanceFormatted,
            balanceNumber: balanceInBNB,
            threshold: `${this.threshold} BNB`,
            thresholdNumber: this.threshold,
            belowThreshold: balanceInBNB < this.threshold,
            alertSent: false,
            alertSkipped: false,
            skipReason: null,
        };

        // Check if balance is below threshold
        if (balanceInBNB < this.threshold) {
            logger.warn(`⚠️ ${name} balance is LOW: ${balanceFormatted} (threshold: ${this.threshold} BNB)`);

            // Check if we should send alert (throttle to once per 24 hours)
            const shouldAlert = await WalletBalanceAlert.shouldSendAlert(address);

            if (shouldAlert) {
                // Send alert email
                const explorerLink = `${this.explorerBaseUrl}/${address}`;
                const emailResult = await emailService.sendLowBalanceAlert({
                    walletName: name,
                    walletAddress: address,
                    balance: balanceFormatted,
                    threshold: `${this.threshold} BNB`,
                    network: this.network,
                    explorerLink,
                });

                // Save alert to database
                await WalletBalanceAlert.createAlert({
                    walletAddress: address,
                    walletName: name,
                    balance: balanceFormatted,
                    balanceNumber: balanceInBNB,
                    threshold: `${this.threshold} BNB`,
                    thresholdNumber: this.threshold,
                    network: this.network,
                    chainId: this.chainId,
                    emailSent: emailResult.success,
                    emailRecipients: emailResult.recipients || [],
                    emailError: emailResult.error,
                });

                result.alertSent = emailResult.success;
                result.emailError = emailResult.error;

                if (emailResult.success) {
                    logger.info(`📧 Alert email sent for ${name}`);
                } else {
                    logger.error(`❌ Failed to send alert email for ${name}: ${emailResult.error || emailResult.message}`);
                }
            } else {
                result.alertSkipped = true;
                result.skipReason = 'Alert already sent within last 24 hours';
                logger.info(`⏭️ Skipping alert for ${name} (throttled)`);
            }
        } else {
            logger.info(`✅ ${name} balance is sufficient: ${balanceFormatted}`);

            // Auto-resolve any unresolved alerts if balance is now above threshold
            const lastAlert = await WalletBalanceAlert.getLastAlert(address);
            if (lastAlert && !lastAlert.resolved) {
                await WalletBalanceAlert.resolveAlert(
                    lastAlert._id,
                    'Balance restored above threshold'
                );
                logger.info(`✅ Auto-resolved alert for ${name}`);
            }
        }

        return result;
    }

    /**
     * Get alert history for a wallet
     */
    async getAlertHistory(walletAddress = null, limit = 50) {
        const query = walletAddress
            ? { walletAddress: walletAddress.toLowerCase() }
            : {};

        return WalletBalanceAlert.find(query)
            .sort({ alertSentAt: -1 })
            .limit(limit);
    }

    /**
     * Get all unresolved alerts
     */
    async getUnresolvedAlerts(limit = 50) {
        return WalletBalanceAlert.getUnresolvedAlerts(limit);
    }

    /**
     * Get statistics
     */
    async getStatistics(days = 30) {
        return WalletBalanceAlert.getStatistics(days);
    }

    /**
     * Update configuration dynamically
     */
    updateConfiguration({ walletAddress, walletName, threshold }) {
        if (walletAddress) {
            process.env.GAME_ADMIN_ADDRESS = walletAddress;
            logger.info(`💰 Updated monitored wallet address: ${walletAddress}`);
        }

        if (walletName) {
            process.env.MONITORED_WALLET_NAME = walletName;
            logger.info(`💰 Updated monitored wallet name: ${walletName}`);
        }

        if (threshold !== undefined) {
            this.threshold = parseFloat(threshold);
            process.env.WALLET_BALANCE_LOW_THRESHOLD_BNB = threshold.toString();
            logger.info(`💰 Updated balance threshold: ${threshold} BNB`);
        }

        return {
            success: true,
            configuration: this.getConfiguration(),
        };
    }

    /**
     * Get current configuration
     */
    getConfiguration() {
        const wallet = this.getMonitoredWallet();
        return {
            enabled: this.enabled,
            walletAddress: wallet?.address || null,
            walletName: wallet?.name || null,
            threshold: `${this.threshold} BNB`,
            thresholdNumber: this.threshold,
            network: this.network,
            chainId: this.chainId,
            checkSchedule: process.env.WALLET_BALANCE_CHECK_SCHEDULE || '0 9 * * *',
        };
    }
}

// Singleton instance
const walletBalanceMonitor = new WalletBalanceMonitor();

module.exports = walletBalanceMonitor;
