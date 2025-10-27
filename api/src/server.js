const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
require('dotenv').config();

const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');
const { authMiddleware } = require('./middleware/auth');
const cronJobsService = require('./services/cronJobs');
const emailService = require('./services/emailService');
const walletBalanceMonitor = require('./services/walletBalanceMonitor');

// Import routes
const tokenRoutes = require('./routes/tokens');
const playerRoutes = require('./routes/players');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const botRoutes = require('./routes/bot');
const merkleRoutes = require('./routes/merkle');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

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
            merkle: '/api/merkle'
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
        availableEndpoints: ['/health', '/api/admin', '/api/tokens', '/api/players', '/api/bot', '/api/merkle']
    });
});

// Start server
const server = app.listen(PORT, async () => {
    logger.info(`🚀 Magic World Token API server running on port ${PORT}`);
    logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
    logger.info(`🌐 Environment: ${process.env.NODE_ENV}`);
    logger.info(`⛓️  Blockchain Network: ${process.env.BLOCKCHAIN_NETWORK}`);

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
});

// Graceful shutdown
const gracefulShutdown = async () => {
    logger.info('Shutting down gracefully...');

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