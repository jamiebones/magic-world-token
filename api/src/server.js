const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const crypto = require('crypto');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const cronJobsService = require('./services/cronJobs');
const emailService = require('./services/emailService');
const walletBalanceMonitor = require('./services/walletBalanceMonitor');
const { OrderBookEventListener } = require('./services');

// Order book event listener instance
let orderBookListener = null;

// Import routes
const tokenRoutes = require('./routes/tokens');
const playerRoutes = require('./routes/players');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const botRoutes = require('./routes/bot');
const merkleRoutes = require('./routes/merkle');
const orderbookRoutes = require('./routes/orderbook');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS configuration
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // Get allowed origins from environment variable
        const allowedOrigins = process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',')
            : ['http://localhost:3000', 'http://localhost:3001'];

        if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes('*')) {
            callback(null, true);
        } else {
            logger.warn(`CORS blocked request from origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-secret', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID'],
    maxAge: 86400 // 24 hours
};

// Security middleware - Configure helmet to allow CORS
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));
app.use(cors(corsOptions));

// Request ID middleware - Generate unique ID for each request
app.use((req, res, next) => {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
});

// Logging middleware
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Documentation
if (process.env.NODE_ENV !== 'production') {
    const swaggerUi = require('swagger-ui-express');
    const swaggerSpec = require('./utils/swagger');
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

// Health check (no auth required)
app.use('/health', healthRoutes);

// Admin routes (require admin secret header)
app.use('/api/admin', adminRoutes);

// API routes (require authentication)
app.use('/api/tokens', authMiddleware, tokenRoutes);
app.use('/api/players', authMiddleware, playerRoutes);

// Bot routes (public access - bots will call these)
app.use('/api/bot', botRoutes);

// Merkle distribution routes (mixed auth - public reads, admin writes)
app.use('/api/merkle', merkleRoutes);

// Order book routes (public access)
app.use('/api/orderbook', orderbookRoutes);

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Magic World GEMS API',
        version: '1.0.0',
        status: 'running',
        documentation: process.env.NODE_ENV !== 'production' ? '/api-docs' : 'Contact admin for documentation',
        endpoints: {
            health: '/health',
            admin: '/api/admin',
            tokens: '/api/tokens',
            players: '/api/players',
            bot: '/api/bot',
            merkle: '/api/merkle',
            orderbook: '/api/orderbook'
        }
    });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Endpoint not found',
        message: `Cannot ${req.method} ${req.originalUrl}`,
        availableEndpoints: ['/health', '/api/admin', '/api/tokens', '/api/players', '/api/bot', '/api/merkle', '/api/orderbook']
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`🚀 Magic World Token API server running on port ${PORT}`);
    logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
    logger.info(`🌐 Environment: ${process.env.NODE_ENV}`);
    logger.info(`⛓️  Blockchain Network: ${process.env.BLOCKCHAIN_NETWORK}`);

    // Initialize services asynchronously (non-blocking)
    initializeServices().catch(error => {
        logger.error('Failed to initialize services:', error);
    });
});

// Initialize async services after server starts
async function initializeServices() {
    // Initialize email service (non-critical - continue if fails)
    try {
        await emailService.initialize();
    } catch (error) {
        logger.warn('⚠️  Email service initialization failed (non-critical):', error.message);
    }

    // Initialize wallet balance monitor (non-critical - continue if fails)
    try {
        await walletBalanceMonitor.initialize();
    } catch (error) {
        logger.warn('⚠️  Wallet balance monitor initialization failed (non-critical):', error.message);
    }

    // Initialize cron jobs (includes wallet balance checking)
    try {
        await cronJobsService.initialize();
        logger.info('⏰ Cron jobs initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize cron jobs:', error);
    }

    // Initialize order book event listener (if enabled)
    if (process.env.ORDERBOOK_ENABLED === 'true') {
        try {
            const network = process.env.BLOCKCHAIN_NETWORK || 'bscTestnet';
            const contractAddress = network === 'bsc'
                ? process.env.ORDERBOOK_CONTRACT_ADDRESS_MAINNET
                : process.env.ORDERBOOK_CONTRACT_ADDRESS_TESTNET;
            const rpcUrl = network === 'bsc'
                ? process.env.BSC_MAINNET_RPC_URL
                : process.env.BSC_TESTNET_RPC_URL;
            const startBlock = network === 'bsc'
                ? process.env.ORDERBOOK_START_BLOCK_MAINNET || 0
                : process.env.ORDERBOOK_START_BLOCK_TESTNET || 0;

            if (!contractAddress || contractAddress.trim() === '') {
                logger.warn('⚠️  Order book contract address not configured, skipping initialization');
            } else if (!rpcUrl || rpcUrl.trim() === '') {
                logger.warn('⚠️  RPC URL not configured for order book, skipping initialization');
                logger.warn(`   Set ${network === 'bsc' ? 'BSC_MAINNET_RPC_URL' : 'BSC_TESTNET_RPC_URL'} in .env`);
            } else {
                const config = {
                    contractAddress,
                    network,
                    rpcUrl,
                    startBlock: parseInt(startBlock, 10),
                    pollInterval: parseInt(process.env.ORDERBOOK_POLL_INTERVAL || '15000', 10)
                };

                orderBookListener = OrderBookEventListener.getInstance(config);
                await orderBookListener.initialize();
                await orderBookListener.start();
                logger.info('📖 Order book event listener started successfully');
            }
        } catch (error) {
            logger.error('❌ Failed to initialize order book event listener:', error);
            logger.warn('⚠️  Order book will continue without real-time event monitoring');
        }
    } else {
        logger.info('ℹ️  Order book event listener disabled (set ORDERBOOK_ENABLED=true to enable)');
    }
}

// Graceful shutdown
const gracefulShutdown = async () => {
    logger.info('Shutting down gracefully...');

    // Stop order book event listener
    if (orderBookListener) {
        try {
            await orderBookListener.stop();
            logger.info('📖 Order book event listener stopped');
        } catch (error) {
            logger.error('Error stopping order book event listener:', error);
        }
    }

    // Stop cron jobs
    try {
        cronJobsService.stopAll();
        logger.info('⏰ Cron jobs stopped');
    } catch (error) {
        logger.error('Error stopping cron jobs:', error);
    }

    // Close server
    server.close(() => {
        logger.info('Server closed');
        process.exit(0);
    });

    // Force close after 10 seconds
    setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

module.exports = app;