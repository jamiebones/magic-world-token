const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
};

// Define colors for each level
const colors = {
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'white',
};

// Tell winston about the colors
winston.addColors(colors);

// Define the format for logs
const format = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

// Define the format for console logs (more readable)
const consoleFormat = winston.format.combine(
    winston.format.colorize({ all: true }),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.printf(
        (info) => `${info.timestamp} ${info.level}: ${info.message}`
    )
);

// Create transports array
const transports = [
    // Console transport
    new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
    })
];

// Add file transport if in production or if LOG_FILE is specified
if (process.env.NODE_ENV === 'production' || process.env.LOG_FILE) {
    const logDir = path.dirname(process.env.LOG_FILE || 'logs/api.log');

    // Ensure log directory exists
    const fs = require('fs');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    transports.push(
        // File transport for all logs
        new winston.transports.File({
            filename: process.env.LOG_FILE || 'logs/api.log',
            format: format,
            level: process.env.LOG_LEVEL || 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        }),

        // Separate file for errors
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            format: format,
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
        })
    );
}

// Create the logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    levels,
    format,
    transports,
    exitOnError: false
});

// Add request logging helper
logger.logRequest = (req, res, responseTime) => {
    const { method, url, ip, headers } = req;
    const { statusCode } = res;

    logger.info('HTTP Request', {
        method,
        url,
        ip,
        statusCode,
        responseTime: `${responseTime}ms`,
        userAgent: headers['user-agent'],
        referer: headers.referer || 'none'
    });
};

// Add blockchain transaction logging helper
logger.logTransaction = (type, details) => {
    logger.info(`Blockchain Transaction: ${type}`, {
        type,
        ...details,
        timestamp: new Date().toISOString()
    });
};

// Add API usage logging helper
logger.logApiUsage = (apiKey, endpoint, success, details = {}) => {
    logger.info('API Usage', {
        apiKey: apiKey.substring(0, 8) + '...' + apiKey.substring(apiKey.length - 4), // Partial key for security
        endpoint,
        success,
        timestamp: new Date().toISOString(),
        ...details
    });
};

module.exports = logger;