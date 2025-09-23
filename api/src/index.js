require('dotenv').config();

const blockchainService = require('./services/blockchain');
const databaseService = require('./services/database');
const { initializeDefaultKeys } = require('./middleware/auth');
const logger = require('./utils/logger');

/**
 * Initialize all services required for the API
 */
async function initialize() {
    try {
        logger.info('🚀 Starting Magic World Token API...');

        // Initialize database connection first
        logger.info('🗄️  Connecting to database...');
        await databaseService.connect();

        // Initialize blockchain service
        logger.info('🔗 Initializing blockchain connection...');
        await blockchainService.initialize();

        // Initialize authentication system
        logger.info('🔑 Setting up authentication...');
        await initializeDefaultKeys();

        logger.info('✅ All services initialized successfully!');

        // Start the server
        require('./server');

    } catch (error) {
        logger.error('❌ Failed to initialize services:', error);
        process.exit(1);
    }
}// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start initialization
initialize();