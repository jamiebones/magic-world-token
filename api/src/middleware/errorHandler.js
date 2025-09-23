const logger = require('../utils/logger');

/**
 * Global error handler middleware
 */
const errorHandler = (error, req, res, next) => {
    let statusCode = 500;
    let message = 'Internal Server Error';
    let details = {};

    // Log the error
    logger.error('API Error:', {
        error: error.message,
        stack: error.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    // Handle specific error types
    if (error.name === 'ValidationError') {
        statusCode = 400;
        message = 'Validation Error';
        details = error.details || {};
    } else if (error.name === 'UnauthorizedError' || error.message.includes('authentication')) {
        statusCode = 401;
        message = 'Authentication failed';
    } else if (error.message.includes('rate limit')) {
        statusCode = 429;
        message = 'Rate limit exceeded';
    } else if (error.message.includes('blockchain') || error.message.includes('contract')) {
        statusCode = 503;
        message = 'Blockchain service unavailable';
        details = { blockchain: error.message };
    } else if (error.message.includes('Invalid address')) {
        statusCode = 400;
        message = 'Invalid wallet address';
    } else if (error.message.includes('Insufficient')) {
        statusCode = 400;
        message = 'Insufficient funds or tokens';
    }

    // Don't expose internal errors in production
    if (process.env.NODE_ENV === 'production' && statusCode === 500) {
        message = 'Something went wrong. Please try again later.';
        details = {};
    } else if (process.env.NODE_ENV !== 'production') {
        details.stack = error.stack;
    }

    res.status(statusCode).json({
        success: false,
        error: {
            message,
            statusCode,
            timestamp: new Date().toISOString(),
            requestId: req.id || 'unknown',
            ...details
        }
    });
};

/**
 * Async error wrapper to avoid try-catch in every route
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    errorHandler,
    asyncHandler
};