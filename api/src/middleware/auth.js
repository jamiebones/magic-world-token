const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');

// Temporary in-memory cache for faster lookups (optional)
const API_KEY_CACHE = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a new API key and store in database
 * @param {string} name - Name/identifier for the API key
 * @param {Array<string>} permissions - Array of permissions
 * @param {Object} metadata - Additional metadata (gameName, developerEmail, etc.)
 * @returns {Object} API key details
 */
async function generateApiKey(name, permissions = ['read'], metadata = {}) {
    try {
        const { apiKey, keyData } = ApiKey.generateApiKey(name, permissions, metadata);

        // Create new API key document
        const newApiKey = new ApiKey(keyData);
        await newApiKey.save();

        // Update cache
        API_KEY_CACHE.set(keyData.hashedKey, {
            ...keyData,
            _id: newApiKey._id,
            createdAt: newApiKey.createdAt,
            updatedAt: newApiKey.updatedAt,
            data: newApiKey
        });

        logger.info(`Generated new API key for: ${name}`);

        return {
            apiKey, // Only return this once
            id: keyData.id,
            name: keyData.name,
            permissions: keyData.permissions,
            ...metadata
        };
    } catch (error) {
        logger.error('Failed to generate API key:', error);
        throw new Error(`Failed to generate API key: ${error.message}`);
    }
}/**
 * Validate API key against database
 * @param {string} apiKey - The API key to validate
 * @returns {Object|null} Key data if valid, null if invalid
 */
async function validateApiKey(apiKey) {
    try {
        if (!apiKey || !apiKey.startsWith('mwt_')) {
            return null;
        }

        const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
        // Check cache first
        const cached = API_KEY_CACHE.get(hashedKey);
        if (cached && (Date.now() - cached.cachedAt) < CACHE_TTL) {
            return cached.data;
        }

        // Query database
        const keyData = await ApiKey.findByHashedKey(hashedKey);
        if (!keyData) {
            return null;
        }

        // Update cache
        API_KEY_CACHE.set(hashedKey, {
            data: keyData,
            cachedAt: Date.now()
        });
        return keyData;
    } catch (error) {
        logger.error('Error validating API key:', error);
        return null;
    }
}

/**
 * Authentication middleware
 */
const authMiddleware = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');

        if (!apiKey) {
            return res.status(401).json({
                success: false,
                error: {
                    message: 'API key required',
                    code: 'MISSING_API_KEY',
                    details: 'Provide API key in X-API-Key header or Authorization: Bearer <key>'
                }
            });
        }

        const keyData = await validateApiKey(apiKey);
        if (!keyData) {
            logger.warn(`Invalid API key attempt from ${req.ip}`);
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Invalid API key',
                    code: 'INVALID_API_KEY'
                }
            });
        }

        // Record usage
        await keyData.recordUsage();

        // Attach key data to request
        req.apiKey = keyData;
        req.permissions = keyData.permissions;

        // Log API usage
        logger.logApiUsage(apiKey, req.originalUrl, true, {
            method: req.method,
            ip: req.ip,
            keyName: keyData.name
        });

        next();

    } catch (error) {
        logger.error('Authentication error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Authentication service error',
                code: 'AUTH_ERROR'
            }
        });
    }
};/**
 * Permission check middleware
 * @param {string} requiredPermission - Permission required for the route
 */
const requirePermission = (requiredPermission) => {
    return (req, res, next) => {
        if (!req.permissions || !req.permissions.includes(requiredPermission)) {
            logger.warn(`Permission denied: ${req.apiKey.name} attempted ${requiredPermission} on ${req.originalUrl}`);
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Insufficient permissions',
                    code: 'PERMISSION_DENIED',
                    required: requiredPermission,
                    current: req.permissions
                }
            });
        }
        next();
    };
};

/**
 * Initialize default API keys for development
 */
async function initializeDefaultKeys() {
    try {
        if (process.env.NODE_ENV === 'development') {
            // Check if any keys exist
            const existingKeys = await ApiKey.countDocuments();
            if (existingKeys === 0) {
                // Generate a default development key
                const devKey = await generateApiKey('Development Key', ['read', 'distribute', 'admin'], {
                    gameName: 'Development Game',
                    developerEmail: 'dev@magicworldtoken.com',
                    description: 'Default development API key - replace in production'
                });

                logger.info('🔑 Development API Key generated:');
                logger.info(`   Key: ${devKey.apiKey}`);
                logger.info(`   Permissions: ${devKey.permissions.join(', ')}`);
                logger.info('   ⚠️  This key is for development only! Replace in production.');
                logger.info('   📧 Add this to your .env file or use in API requests');
            } else {
                logger.info(`Found ${existingKeys} existing API keys`);
            }
        }
    } catch (error) {
        logger.error('Error initializing default keys:', error);
    }
}/**
 * Get API key statistics
 * @returns {Array} Array of API key stats (without sensitive data)
 */
async function getApiKeyStats() {
    try {
        const keys = await ApiKey.find({})
            .select('id name permissions createdAt lastUsed usageCount isActive gameName developerEmail')
            .sort({ createdAt: -1 })
            .lean();

        return keys.map(key => ({
            id: key.id,
            name: key.name,
            permissions: key.permissions,
            createdAt: key.createdAt,
            lastUsed: key.lastUsed,
            usageCount: key.usageCount,
            isActive: key.isActive,
            gameName: key.gameName,
            developerEmail: key.developerEmail
        }));
    } catch (error) {
        logger.error('Error getting API key stats:', error);
        return [];
    }
}/**
 * Revoke an API key
 * @param {string} keyId - ID of the key to revoke
 * @returns {boolean} Success status
 */
async function revokeApiKey(keyId) {
    try {
        const apiKey = await ApiKey.findOne({ id: keyId });
        if (!apiKey) {
            return false;
        }

        await apiKey.deactivate();

        // Clear from cache
        API_KEY_CACHE.clear(); // Clear entire cache for simplicity

        logger.info(`Revoked API key: ${apiKey.name}`);
        return true;
    } catch (error) {
        logger.error('Error revoking API key:', error);
        return false;
    }
}

module.exports = {
    authMiddleware,
    requirePermission,
    generateApiKey,
    validateApiKey,
    initializeDefaultKeys,
    getApiKeyStats,
    revokeApiKey
};