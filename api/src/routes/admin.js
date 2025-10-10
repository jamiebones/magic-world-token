const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { asyncHandler } = require('../middleware/errorHandler');
const ApiKey = require('../models/ApiKey');
const Wallet = require('../models/Wallet');
const { generateEncryptedWallet, decryptPrivateKey } = require('../utils/walletUtils');
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
    // Log rate limit violations using handler
    handler: (req, res, next, options) => {
        logger.warn(`Admin rate limit exceeded for IP: ${req.ip}`);
        res.status(options.statusCode).json(options.message);
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

/**
 * @swagger
 * /api/admin/wallets/generate:
 *   post:
 *     summary: Generate one or more EVM wallet addresses (Admin only)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 2000
 *                 description: Number of wallets to generate (default 1, max 2000)
 *                 example: 5
 *               returnPrivateKey:
 *                 type: boolean
 *                 description: Whether to return the private keys (WARNING - only use for initial setup)
 *                 example: false
 *     responses:
 *       201:
 *         description: Wallet(s) created successfully
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
 *                     count:
 *                       type: integer
 *                       example: 5
 *                     wallets:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             example: "550e8400-e29b-41d4-a716-446655440000"
 *                           address:
 *                             type: string
 *                             example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1"
 *                           privateKey:
 *                             type: string
 *                             example: "0x1234...abcd"
 *                             description: Only included if returnPrivateKey=true
 *                           createdAt:
 *                             type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Missing admin secret
 *       403:
 *         description: Invalid admin secret
 */
router.post('/wallets/generate',
    adminRateLimit,
    validateAdminSecret,
    [
        body('count')
            .optional()
            .isInt({ min: 1, max: 2000 })
            .withMessage('Count must be between 1 and 2000'),
        body('returnPrivateKey')
            .optional()
            .isBoolean()
            .withMessage('returnPrivateKey must be a boolean')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { count = 1, returnPrivateKey = false } = req.body;
        logger.info(`Starting batch generation of ${count} wallet(s) by admin from ${req.ip}`);
        const walletsToCreate = [];
        const walletDetails = [];

        for (let i = 0; i < count; i++) {
            const { address, encryptedPrivateKey, iv } = generateEncryptedWallet();

            walletsToCreate.push({
                address,
                encryptedPrivateKey,
                iv
            });

            walletDetails.push({
                address,
                encryptedPrivateKey,
                iv
            });
        }

        // Batch insert all wallets at once (fast - single DB operation)
        const savedWallets = await Wallet.insertMany(walletsToCreate);

        // Prepare response data
        const wallets = savedWallets.map((wallet, index) => {
            const walletData = {
                id: wallet.id,
                address: wallet.address,
                createdAt: wallet.createdAt
            };

            // Only return private key if explicitly requested (DANGEROUS!)
            if (returnPrivateKey) {
                const privateKey = decryptPrivateKey(
                    walletDetails[index].encryptedPrivateKey,
                    walletDetails[index].iv
                );
                walletData.privateKey = privateKey;
            }

            return walletData;
        });

        if (returnPrivateKey) {
            logger.warn(`⚠️  Private keys returned for ${count} wallet(s) - requested by admin from ${req.ip}`);
        }

        const response = {
            success: true,
            data: {
                count: wallets.length,
                wallets: wallets
            }
        };

        if (returnPrivateKey) {
            response.data.warning = 'PRIVATE KEYS EXPOSED - Store securely and never share!';
        }

        res.status(201).json(response);
    })
);

/**
 * @swagger
 * /api/admin/wallets:
 *   get:
 *     summary: List all generated wallets (Admin only)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results to return
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *     responses:
 *       200:
 *         description: Wallets retrieved successfully
 */
router.get('/wallets',
    adminRateLimit,
    validateAdminSecret,
    asyncHandler(async (req, res) => {
        const { limit = 50, page = 1 } = req.query;

        // Build query
        const query = {};

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = Math.min(parseInt(limit), 100); // Max 100 per page

        // Get wallets (never return encrypted keys)
        const wallets = await Wallet.find(query)
            .select('-encryptedPrivateKey -iv -__v')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip(skip);

        const total = await Wallet.countDocuments(query);

        res.json({
            success: true,
            data: {
                wallets,
                pagination: {
                    total,
                    page: parseInt(page),
                    limit: limitNum,
                    pages: Math.ceil(total / limitNum)
                }
            }
        });
    })
);

/**
 * @swagger
 * /api/admin/wallets/export/addresses:
 *   get:
 *     summary: Export ALL wallet addresses (Admin only)
 *     description: Returns all wallet addresses without pagination. Optimized for bulk export.
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv, txt]
 *           default: json
 *         description: Output format (json, csv, or txt)
 *     responses:
 *       200:
 *         description: All wallet addresses exported successfully
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
 *                     count:
 *                       type: integer
 *                       example: 2000
 *                     addresses:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", "0x..."]
 *           text/csv:
 *             schema:
 *               type: string
 *               example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1\n0x..."
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1\n0x..."
 *       403:
 *         description: Invalid admin secret
 */
router.get('/wallets/export/addresses',
    adminRateLimit,
    validateAdminSecret,
    asyncHandler(async (req, res) => {
        const { format = 'json' } = req.query;

        logger.info(`Exporting all wallet addresses (format: ${format}) by admin from ${req.ip}`);
        const startTime = Date.now();

        // Fetch only address field for efficiency
        const wallets = await Wallet.find({})
            .select('address')
            .sort({ createdAt: 1 })
            .lean(); // Use lean() for better performance (returns plain JS objects)

        const count = wallets.length;
        const elapsedTime = Date.now() - startTime;

        logger.info(`✅ Exported ${count} wallet addresses in ${elapsedTime}ms`);

        // Format output based on requested format
        if (format === 'csv') {
            // CSV format: one address per line with header
            let csv = 'address\n';
            csv += wallets.map(w => w.address).join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="wallet-addresses-${Date.now()}.csv"`);
            return res.send(csv);
        }

        if (format === 'txt') {
            // Plain text format: one address per line (no header)
            const txt = wallets.map(w => w.address).join('\n');

            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="wallet-addresses-${Date.now()}.txt"`);
            return res.send(txt);
        }

        // Default: JSON format - simple array of addresses
        res.json({
            success: true,
            data: {
                count,
                addresses: wallets.map(w => w.address),
                exportedAt: new Date().toISOString(),
                format: 'json'
            }
        });
    })
);

/**
 * @swagger
 * /api/admin/wallets/{address}:
 *   get:
 *     summary: Get wallet details by address (Admin only)
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
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address (0x...)
 *       - in: query
 *         name: includePrivateKey
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include decrypted private key (DANGEROUS!)
 *     responses:
 *       200:
 *         description: Wallet details retrieved
 *       404:
 *         description: Wallet not found
 */
router.get('/wallets/:address',
    adminRateLimit,
    validateAdminSecret,
    asyncHandler(async (req, res) => {
        const { address } = req.params;
        const { includePrivateKey = false } = req.query;

        // Find wallet by address (case-insensitive)
        const wallet = await Wallet.findOne({ address: address.toLowerCase() });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Wallet not found',
                    code: 'WALLET_NOT_FOUND'
                }
            });
        }

        const walletData = {
            id: wallet.id,
            address: wallet.address,
            createdAt: wallet.createdAt,
            updatedAt: wallet.updatedAt
        };

        // Only return private key if explicitly requested
        if (includePrivateKey === 'true') {
            logger.warn(`Private key accessed for wallet ${wallet.address} by admin from ${req.ip}`);
            const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey, wallet.iv);
            walletData.privateKey = privateKey;
            walletData.warning = 'PRIVATE KEY EXPOSED - Handle with extreme care!';
        }

        res.json({
            success: true,
            data: walletData
        });
    })
);

/**
 * @swagger
 * /api/admin/wallets/{address}/private-key:
 *   get:
 *     summary: Get decrypted private key for a wallet (Admin only - DANGEROUS!)
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
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Wallet address (0x...)
 *     responses:
 *       200:
 *         description: Private key retrieved
 *       404:
 *         description: Wallet not found
 */
router.get('/wallets/:address/private-key',
    adminRateLimit,
    validateAdminSecret,
    asyncHandler(async (req, res) => {
        const { address } = req.params;

        // Find wallet by address (case-insensitive)
        const wallet = await Wallet.findOne({ address: address.toLowerCase() });

        if (!wallet) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Wallet not found',
                    code: 'WALLET_NOT_FOUND'
                }
            });
        }

        logger.warn(`🔑 Private key accessed for wallet ${wallet.address} by admin from ${req.ip}`);
        const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey, wallet.iv);

        res.json({
            success: true,
            data: {
                id: wallet.id,
                address: wallet.address,
                privateKey: privateKey,
                warning: 'PRIVATE KEY EXPOSED - Handle with extreme care!'
            }
        });
    })
);

/**
 * @swagger
 * /api/admin/wallets/batch/private-keys:
 *   post:
 *     summary: Get private keys for multiple wallets (Admin only - EXTREMELY DANGEROUS!)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - addresses
 *             properties:
 *               addresses:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of wallet addresses
 *                 example: ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"]
 *     responses:
 *       200:
 *         description: Private keys retrieved for found addresses
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Invalid admin secret
 */
router.post('/wallets/batch/private-keys',
    adminRateLimit,
    validateAdminSecret,
    [
        body('addresses')
            .isArray({ min: 1 })
            .withMessage('Addresses must be a non-empty array'),
        body('addresses.*')
            .isEthereumAddress()
            .withMessage('Each address must be a valid Ethereum address')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { addresses } = req.body;

        logger.warn(`🔑🔑🔑 BATCH PRIVATE KEY ACCESS: ${addresses.length} addresses requested by admin from ${req.ip}`);

        // Convert addresses to lowercase for case-insensitive search
        const lowercaseAddresses = addresses.map(addr => addr.toLowerCase());

        // Find all wallets matching the addresses
        const wallets = await Wallet.find({
            address: { $in: lowercaseAddresses }
        });

        // Build result object: { address: privateKey }
        const result = {};

        for (const wallet of wallets) {
            const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey, wallet.iv);
            result[wallet.address] = privateKey;
        }
        const foundAddresses = wallets.map(w => w.address);
        const notFoundAddresses = lowercaseAddresses.filter(addr => !foundAddresses.includes(addr));

        if (notFoundAddresses.length > 0) {
            logger.info(`⚠️  ${notFoundAddresses.length} addresses not found in database`);
        }

        res.json({
            success: true,
            data: result,
            found: wallets.length,
            notFound: notFoundAddresses.length
        });
    })
);

/**
 * @swagger
 * /api/admin/wallets/batch/private-keys/csv:
 *   post:
 *     summary: Get private keys for multiple wallets as CSV download (Admin only - EXTREMELY DANGEROUS!)
 *     tags: [Admin]
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Admin-Secret
 *         required: true
 *         schema:
 *           type: string
 *         description: Admin secret for authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - addresses
 *             properties:
 *               addresses:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Array of wallet addresses
 *                 example: ["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"]
 *     responses:
 *       200:
 *         description: CSV file with wallet addresses and private keys
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: "address,privateKey\n0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1,0x1234...abcd\n"
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Invalid admin secret
 */
router.post('/wallets/batch/private-keys/csv',
    adminRateLimit,
    validateAdminSecret,
    [
        body('addresses')
            .isArray({ min: 1 })
            .withMessage('Addresses must be a non-empty array'),
        body('addresses.*')
            .isEthereumAddress()
            .withMessage('Each address must be a valid Ethereum address')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { addresses } = req.body;

        logger.warn(`🔑📥 BATCH PRIVATE KEY CSV DOWNLOAD: ${addresses.length} addresses requested by admin from ${req.ip}`);

        // Convert addresses to lowercase for case-insensitive search
        const lowercaseAddresses = addresses.map(addr => addr.toLowerCase());

        // Find all wallets matching the addresses
        const wallets = await Wallet.find({
            address: { $in: lowercaseAddresses }
        });

        // Build CSV content
        let csv = 'address,privateKey\n';

        for (const wallet of wallets) {
            const privateKey = decryptPrivateKey(wallet.encryptedPrivateKey, wallet.iv);
            csv += `${wallet.address},${privateKey}\n`;
            logger.info(`🔑 Private key accessed for CSV export: ${wallet.address}`);
        }

        const foundAddresses = wallets.map(w => w.address);
        const notFoundAddresses = lowercaseAddresses.filter(addr => !foundAddresses.includes(addr));

        if (notFoundAddresses.length > 0) {
            logger.warn(`⚠️  ${notFoundAddresses.length} addresses not found for CSV export`);
            // Add comment in CSV about missing addresses
            csv += `\n# Note: ${notFoundAddresses.length} addresses were not found in the database\n`;
            csv += `# Missing addresses: ${notFoundAddresses.join(', ')}\n`;
        }

        // Set headers for CSV download
        const timestamp = Date.now();
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="wallet-private-keys-${timestamp}.csv"`);

        logger.warn(`⚠️⚠️⚠️ CSV with ${wallets.length} PRIVATE KEYS downloaded by admin from ${req.ip}`);

        res.send(csv);
    })
);

module.exports = router;