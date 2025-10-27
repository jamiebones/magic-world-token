const cron = require('node-cron');
const logger = require('../utils/logger');
const distributionFinalizer = require('./distributionFinalizer');
const walletBalanceMonitor = require('./walletBalanceMonitor');

/**
 * Service for managing scheduled cron jobs
 * Handles auto-finalization of expired Merkle distributions
 * Handles wallet balance monitoring and alerts
 */
class CronJobsService {
    constructor() {
        this.jobs = {};
        this.isInitialized = false;
    }

    /**
     * Initialize all cron jobs
     */
    async initialize() {
        if (this.isInitialized) {
            logger.warn('CronJobsService already initialized');
            return;
        }

        try {
            logger.info('Initializing CronJobsService');

            // Initialize the distribution finalizer
            await distributionFinalizer.initialize();

            // Initialize the wallet balance monitor
            await walletBalanceMonitor.initialize();

            // Setup auto-finalization cron job
            this.setupAutoFinalizationJob();

            // Setup retry processing job
            this.setupRetryProcessingJob();

            // Setup wallet balance check job
            this.setupWalletBalanceCheckJob();

            this.isInitialized = true;
            logger.info('CronJobsService initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize CronJobsService', { error: error.message });
            throw error;
        }
    }

    /**
     * Setup the auto-finalization cron job
     * Runs weekly by default (configurable via FINALIZATION_CRON_SCHEDULE)
     */
    setupAutoFinalizationJob() {
        const isEnabled = process.env.ENABLE_AUTO_FINALIZATION === 'true';

        if (!isEnabled) {
            logger.info('Auto-finalization is disabled, skipping cron job setup');
            return;
        }

        // Default: Run every Sunday at midnight (0 0 * * 0)
        // Can be overridden with FINALIZATION_CRON_SCHEDULE env var
        const cronSchedule = process.env.FINALIZATION_CRON_SCHEDULE || '0 0 * * 0';

        try {
            // Validate cron expression
            if (!cron.validate(cronSchedule)) {
                throw new Error(`Invalid cron schedule: ${cronSchedule}`);
            }

            // Create the cron job
            this.jobs.autoFinalization = cron.schedule(
                cronSchedule,
                async () => {
                    logger.info('Auto-finalization cron job triggered');
                    try {
                        const result = await distributionFinalizer.run();
                        logger.info('Auto-finalization cron job completed', result);
                    } catch (error) {
                        logger.error('Auto-finalization cron job failed', { error: error.message });
                    }
                },
                {
                    scheduled: true,
                    timezone: process.env.CRON_TIMEZONE || 'UTC'
                }
            );

            logger.info('Auto-finalization cron job scheduled', {
                schedule: cronSchedule,
                timezone: process.env.CRON_TIMEZONE || 'UTC',
                nextRun: this.getNextAutoFinalizationRun()
            });
        } catch (error) {
            logger.error('Failed to setup auto-finalization cron job', { error: error.message });
            throw error;
        }
    }

    /**
     * Setup the retry processing cron job
     * Runs every hour to process failed finalizations
     */
    setupRetryProcessingJob() {
        const isEnabled = process.env.ENABLE_AUTO_FINALIZATION === 'true';

        if (!isEnabled) {
            return;
        }

        // Run every hour
        const cronSchedule = '0 * * * *';

        try {
            this.jobs.retryProcessing = cron.schedule(
                cronSchedule,
                async () => {
                    logger.info('Retry processing cron job triggered');
                    try {
                        await distributionFinalizer.processRetries();
                        logger.info('Retry processing cron job completed');
                    } catch (error) {
                        logger.error('Retry processing cron job failed', { error: error.message });
                    }
                },
                {
                    scheduled: true,
                    timezone: process.env.CRON_TIMEZONE || 'UTC'
                }
            );

            logger.info('Retry processing cron job scheduled', {
                schedule: cronSchedule,
                timezone: process.env.CRON_TIMEZONE || 'UTC'
            });
        } catch (error) {
            logger.error('Failed to setup retry processing cron job', { error: error.message });
            throw error;
        }
    }

    /**
     * Setup the wallet balance check cron job
     * Runs daily at 9 AM by default (configurable via WALLET_BALANCE_CHECK_SCHEDULE)
     */
    setupWalletBalanceCheckJob() {
        const isEnabled = process.env.WALLET_BALANCE_CHECK_ENABLED === 'true';

        if (!isEnabled) {
            logger.info('Wallet balance monitoring is disabled, skipping cron job setup');
            return;
        }

        // Default: Run daily at 9 AM (0 9 * * *)
        // Can be overridden with WALLET_BALANCE_CHECK_SCHEDULE env var
        const cronSchedule = process.env.WALLET_BALANCE_CHECK_SCHEDULE || '0 9 * * *';

        try {
            // Validate cron expression
            if (!cron.validate(cronSchedule)) {
                throw new Error(`Invalid cron schedule: ${cronSchedule}`);
            }

            // Create the cron job
            this.jobs.walletBalanceCheck = cron.schedule(
                cronSchedule,
                async () => {
                    logger.info('Wallet balance check cron job triggered');
                    try {
                        const results = await walletBalanceMonitor.checkAllWallets();
                        logger.info('Wallet balance check cron job completed', {
                            walletsChecked: results.length,
                            alertsSent: results.filter(r => r.alertSent).length
                        });
                    } catch (error) {
                        logger.error('Wallet balance check cron job failed', { error: error.message });
                    }
                },
                {
                    scheduled: true,
                    timezone: process.env.CRON_TIMEZONE || 'UTC'
                }
            );

            logger.info('Wallet balance check cron job scheduled', {
                schedule: cronSchedule,
                timezone: process.env.CRON_TIMEZONE || 'UTC',
                nextRun: this.getNextWalletBalanceCheckRun()
            });
        } catch (error) {
            logger.error('Failed to setup wallet balance check cron job', { error: error.message });
            throw error;
        }
    }

    /**
     * Get next auto-finalization run time
     */
    getNextAutoFinalizationRun() {
        const cronSchedule = process.env.FINALIZATION_CRON_SCHEDULE || '0 0 * * 0';

        try {
            // Parse cron expression to get next run
            const cronParts = cronSchedule.split(' ');
            if (cronParts.length !== 5) {
                return 'Invalid schedule';
            }

            // Simple next run calculation for weekly schedule (Sunday midnight)
            const now = new Date();
            const dayOfWeek = now.getDay(); // 0 = Sunday
            const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
            const nextRun = new Date(now);
            nextRun.setDate(now.getDate() + daysUntilSunday);
            nextRun.setHours(0, 0, 0, 0);

            return nextRun.toISOString();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Get next wallet balance check run time
     */
    getNextWalletBalanceCheckRun() {
        const cronSchedule = process.env.WALLET_BALANCE_CHECK_SCHEDULE || '0 9 * * *';

        try {
            // Parse cron expression to get next run
            const cronParts = cronSchedule.split(' ');
            if (cronParts.length !== 5) {
                return 'Invalid schedule';
            }

            // Simple next run calculation for daily schedule (9 AM)
            const now = new Date();
            const nextRun = new Date(now);
            nextRun.setHours(9, 0, 0, 0);

            // If 9 AM has already passed today, schedule for tomorrow
            if (now.getHours() >= 9) {
                nextRun.setDate(now.getDate() + 1);
            }

            return nextRun.toISOString();
        } catch (error) {
            return 'Unknown';
        }
    }

    /**
     * Stop all cron jobs
     */
    stopAll() {
        Object.keys(this.jobs).forEach(jobName => {
            if (this.jobs[jobName]) {
                this.jobs[jobName].stop();
                logger.info(`Stopped cron job: ${jobName}`);
            }
        });
    }

    /**
     * Start all cron jobs
     */
    startAll() {
        Object.keys(this.jobs).forEach(jobName => {
            if (this.jobs[jobName]) {
                this.jobs[jobName].start();
                logger.info(`Started cron job: ${jobName}`);
            }
        });
    }

    /**
     * Get cron job status
     */
    getStatus() {
        return {
            isInitialized: this.isInitialized,
            autoFinalization: {
                enabled: process.env.ENABLE_AUTO_FINALIZATION === 'true',
                schedule: process.env.FINALIZATION_CRON_SCHEDULE || '0 0 * * 0',
                nextRun: this.getNextAutoFinalizationRun(),
                running: distributionFinalizer.isRunning
            },
            walletBalanceCheck: {
                enabled: process.env.WALLET_BALANCE_CHECK_ENABLED === 'true',
                schedule: process.env.WALLET_BALANCE_CHECK_SCHEDULE || '0 9 * * *',
                nextRun: this.getNextWalletBalanceCheckRun(),
                monitoredWallet: process.env.GAME_ADMIN_ADDRESS || 'Not configured'
            },
            timezone: process.env.CRON_TIMEZONE || 'UTC',
            jobs: Object.keys(this.jobs).map(name => ({
                name,
                running: this.jobs[name] ? true : false
            }))
        };
    }

    /**
     * Manually trigger auto-finalization
     * Used for testing or emergency finalization
     */
    async triggerManualFinalization() {
        logger.info('Manual finalization triggered');
        return await distributionFinalizer.run();
    }

    /**
     * Manually trigger wallet balance check
     * Used for testing or immediate balance check
     */
    async triggerManualBalanceCheck() {
        logger.info('Manual wallet balance check triggered');
        return await walletBalanceMonitor.checkAllWallets();
    }
}

// Singleton instance
const cronJobsService = new CronJobsService();

module.exports = cronJobsService;
