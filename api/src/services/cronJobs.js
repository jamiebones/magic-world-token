const cron = require('node-cron');
const logger = require('../utils/logger');
const distributionFinalizer = require('./distributionFinalizer');

/**
 * Service for managing scheduled cron jobs
 * Handles auto-finalization of expired Merkle distributions
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

            // Setup auto-finalization cron job
            this.setupAutoFinalizationJob();

            // Setup retry processing job
            this.setupRetryProcessingJob();

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
            enabled: process.env.ENABLE_AUTO_FINALIZATION === 'true',
            schedule: process.env.FINALIZATION_CRON_SCHEDULE || '0 0 * * 0',
            timezone: process.env.CRON_TIMEZONE || 'UTC',
            nextAutoFinalizationRun: this.getNextAutoFinalizationRun(),
            jobs: Object.keys(this.jobs).map(name => ({
                name,
                running: this.jobs[name] ? true : false
            })),
            finalizerRunning: distributionFinalizer.isRunning
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
}

// Singleton instance
const cronJobsService = new CronJobsService();

module.exports = cronJobsService;
