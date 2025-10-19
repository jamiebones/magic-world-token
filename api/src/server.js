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

// Import routes
const tokenRoutes = require('./routes/tokens');
const playerRoutes = require('./routes/players');
const healthRoutes = require('./routes/health');
const adminRoutes = require('./routes/admin');
const botRoutes = require('./routes/bot');

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

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Magic World Token API',
        version: '1.0.0',
        status: 'running',
        documentation: process.env.NODE_ENV !== 'production' ? '/api-docs' : 'Contact admin for documentation',
        endpoints: {
            health: '/health',
            admin: '/api/admin',
            tokens: '/api/tokens',
            players: '/api/players',
            bot: '/api/bot'
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
        availableEndpoints: ['/health', '/api/admin', '/api/tokens', '/api/players', '/api/bot']
    });
});

// Start server
const server = app.listen(PORT, () => {
    logger.info(`🚀 Magic World Token API server running on port ${PORT}`);
    logger.info(`📚 API Documentation available at http://localhost:${PORT}/api-docs`);
    logger.info(`🌐 Environment: ${process.env.NODE_ENV}`);
    logger.info(`⛓️  Blockchain Network: ${process.env.BLOCKCHAIN_NETWORK}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

module.exports = app;