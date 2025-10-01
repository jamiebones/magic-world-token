const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiKey = require('../models/ApiKey');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * Validation helper
 */
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            error: {
                message: 'Validation failed',
                code: 'VALIDATION_ERROR',
                details: errors.array()
            }
        });
    }
    next();
};

/**
 * Admin secret validation middleware
 * Validates X-Admin-Secret header against hashed secret
 */
const validateAdminSecret = async (req, res, next) => {
    try {
        const adminSecret = req.headers['x-admin-secret'];

        if (!adminSecret) {
            logger.warn(`Missing admin secret header from ${req.ip}`);
            return res.status(401).json({
                success: false,
                error: {
                    message: 'Admin secret required',
                    code: 'MISSING_ADMIN_SECRET',
                    details: 'Provide admin secret in X-Admin-Secret header'
                }
            });
        }

        // Hash the provided secret with optional salt
        const salt = process.env.ADMIN_SECRET_SALT || '';
        const providedHash = crypto.createHash('sha256')
            .update(adminSecret + salt)
            .digest('hex');

        const storedHash = process.env.ADMIN_SECRET_HASH;

        if (!storedHash) {
            logger.error('ADMIN_SECRET_HASH not configured');
            return res.status(500).json({
                success: false,
                error: {
                    message: 'Admin authentication not configured',
                    code: 'CONFIG_ERROR'
                }
            });
        }

        // Check length before timing-safe comparison to prevent crash
        if (providedHash.length !== storedHash.length) {
            logger.warn(`Invalid admin secret attempt from ${req.ip} - hash length mismatch`);
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Invalid admin secret',
                    code: 'INVALID_ADMIN_SECRET'
                }
            });
        }

        // Use timing-safe comparison to prevent timing attacks
        const isValid = crypto.timingSafeEqual(
            Buffer.from(providedHash, 'hex'),
            Buffer.from(storedHash, 'hex')
        );

        if (!isValid) {
            logger.warn(`Invalid admin secret attempt from ${req.ip}: ${adminSecret.substring(0, 8)}...`);
            return res.status(403).json({
                success: false,
                error: {
                    message: 'Invalid admin secret',
                    code: 'INVALID_ADMIN_SECRET'
                }
            });
        }

        logger.info(`Admin secret validated for request from ${req.ip}`);
        next();

    } catch (error) {
        logger.error('Admin secret validation error:', error);
        res.status(500).json({
            success: false,
            error: {
                message: 'Admin authentication error',
                code: 'AUTH_ERROR'
            }
        });
    }
};

/**
 * Rate limiting for admin endpoints (stricter than regular API)
 */
const adminRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: {
        success: false,
        error: {
            message: 'Too many admin requests from this IP, please try again later.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((15 * 60 * 1000) / 1000)
        }
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Log rate limit violations
    onLimitReached: (req) => {
        logger.warn(`Admin rate limit exceeded for IP: ${req.ip}`);
    }
});

/**
 * @swagger
 * /api/admin/generate-key:
 *   post:
 *     summary: Generate a new API key (Admin only - requires X-Admin-Secret header)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication (hashed validation)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Descriptive name for the API key
 *                 example: "Game Server Key"
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [read, distribute, admin]
 *                 description: Permissions for the API key
 *                 example: ["distribute"]
 *               gameName:
 *                 type: string
 *                 description: Name of the game using this key
 *                 example: "My Awesome Game"
 *               description:
 *                 type: string
 *                 description: Additional description
 *                 example: "Production API key for game server"
 *               dailyLimit:
 *                 type: integer
 *                 description: Daily token distribution limit
 *                 example: 10000
 *     responses:
 *       201:
 *         description: API key created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     apiKey:
 *                       type: string
 *                       example: "mwt_a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890"
 *                     id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     name:
 *                       type: string
 *                       example: "Game Server Key"
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["distribute"]
 *                     gameName:
 *                       type: string
 *                       example: "My Awesome Game"
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Missing admin secret
 *       403:
 *         description: Invalid admin secret
 *       429:
 *         description: Rate limit exceeded
 */
router.post('/generate-key',
    adminRateLimit,
    validateAdminSecret,
    [
        body('name')
            .isString()
            .trim()
            .isLength({ min: 1, max: 100 })
            .withMessage('Name must be 1-100 characters'),
        body('permissions')
            .optional()
            .isArray()
            .withMessage('Permissions must be an array'),
        body('permissions.*')
            .optional()
            .isIn(['read', 'distribute', 'admin'])
            .withMessage('Invalid permission - must be read, distribute, or admin'),
        body('gameName')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 100 })
            .withMessage('Game name must be max 100 characters'),
        body('description')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 500 })
            .withMessage('Description must be max 500 characters'),
        body('dailyLimit')
            .optional()
            .isInt({ min: 0, max: 1000000 })
            .withMessage('Daily limit must be 0-1000000')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const {
            name,
            permissions = ['read'],
            gameName,
            description,
            dailyLimit
        } = req.body;

        // Generate the API key
        const { apiKey, keyData } = ApiKey.generateApiKey(name, permissions, {
            gameName,
            description,
            rateLimitOverride: dailyLimit
        });

        // Save to database
        const newApiKey = new ApiKey(keyData);
        await newApiKey.save();

        logger.info(`API key generated via admin endpoint: ${name} by admin from ${req.ip}`);

        // Return the key (only time the plain key is returned)
        res.status(201).json({
            success: true,
            data: {
                apiKey, // This is returned only once
                id: keyData.id,
                name: keyData.name,
                permissions: keyData.permissions,
                gameName: keyData.gameName,
                description: keyData.description,
                dailyLimit: keyData.rateLimitOverride,
                createdAt: newApiKey.createdAt
            }
        });
    })
);

/**
 * @swagger
 * /api/admin/keys:
 *   get:
 *     summary: List all API keys (Admin only)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication
 *     responses:
 *       200:
 *         description: API keys retrieved successfully
 */
router.get('/keys',
    adminRateLimit,
    validateAdminSecret,
    asyncHandler(async (req, res) => {
        const keys = await ApiKey.find({})
            .select('-hashedKey') // Never return the hash
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: keys
        });
    })
);

/**
 * @swagger
 * /api/admin/keys/{id}/revoke:
 *   post:
 *     summary: Revoke an API key (Admin only)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: API key ID to revoke
 *     responses:
 *       200:
 *         description: API key revoked successfully
 */
router.post('/keys/:id/revoke',
    adminRateLimit,
    validateAdminSecret,
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        const apiKey = await ApiKey.findOne({ id });
        if (!apiKey) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'API key not found',
                    code: 'KEY_NOT_FOUND'
                }
            });
        }

        if (!apiKey.isActive) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'API key is already revoked',
                    code: 'KEY_ALREADY_REVOKED'
                }
            });
        }

        await apiKey.deactivate();

        logger.info(`API key revoked via admin endpoint: ${apiKey.name} by admin from ${req.ip}`);

        res.json({
            success: true,
            message: 'API key revoked successfully'
        });
    })
);

module.exports = router;