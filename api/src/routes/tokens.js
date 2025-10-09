const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { ethers } = require('ethers');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const blockchainService = require('../services/blockchain');
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
 * @swagger
 * /api/tokens/distribute-equal:
 *   post:
 *     summary: Distribute equal amounts to multiple players from a vault (gas efficient)
 *     tags: [Tokens]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vaultType
 *               - recipients
 *               - amount
 *             properties:
 *               vaultType:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 3
 *                 description: Vault type (0=PLAYER_TASKS, 1=SOCIAL_FOLLOWERS, 2=SOCIAL_POSTERS, 3=ECOSYSTEM_FUND)
 *               recipients:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 description: Array of player wallet addresses
 *               amount:
 *                 type: string
 *                 description: Token amount per player (in tokens, not wei)
 *               reason:
 *                 type: string
 *                 description: Reason for distribution (optional)
 *     responses:
 *       200:
 *         description: Tokens distributed successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Insufficient permissions
 */
router.post('/distribute-equal',
    requirePermission('distribute'),
    [
        body('vaultType')
            .isInt({ min: 0, max: 3 })
            .withMessage('Vault type must be 0-3 (0=PLAYER_TASKS, 1=SOCIAL_FOLLOWERS, 2=SOCIAL_POSTERS, 3=ECOSYSTEM_FUND)'),
        body('recipients')
            .isArray({ min: 1 })
            .withMessage('Recipients must be a non-empty array'),
        body('recipients.*')
            .isEthereumAddress()
            .withMessage('Each recipient must be a valid Ethereum address'),
        body('amount')
            .isFloat({ min: 0 })
            .withMessage('Amount must be a positive number'),
        body('reason')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 200 })
            .withMessage('Reason must be a string (max 200 characters)')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { vaultType, recipients, amount, reason = 'Equal Token Distribution' } = req.body;
        const result = await blockchainService.distributeEqualFromVault(vaultType, recipients, amount, reason);
        res.json({
            success: true,
            data: result
        });
    })
);
/**
 * @swagger
 * /api/tokens/distribute:
 *   post:
 *     summary: Distribute different amounts to multiple players from a vault
 *     tags: [Tokens]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - vaultType
 *               - recipients
 *               - amounts
 *             properties:
 *               vaultType:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 3
 *                 description: Vault type (0=PLAYER_TASKS, 1=SOCIAL_FOLLOWERS, 2=SOCIAL_POSTERS, 3=ECOSYSTEM_FUND)
 *               recipients:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 description: Array of player wallet addresses
 *               amounts:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: string
 *                 description: Array of token amounts per player (in tokens, not wei)
 *               reason:
 *                 type: string
 *                 description: Reason for distribution (optional)
 *     responses:
 *       200:
 *         description: Tokens distributed successfully
 *       400:
 *         description: Invalid request data
 *       403:
 *         description: Insufficient permissions
 */
router.post('/distribute',
    requirePermission('distribute'),
    [
        body('vaultType')
            .isInt({ min: 0, max: 3 })
            .withMessage('Vault type must be 0-3 (0=PLAYER_TASKS, 1=SOCIAL_FOLLOWERS, 2=SOCIAL_POSTERS, 3=ECOSYSTEM_FUND)'),
        body('recipients')
            .isArray({ min: 1 })
            .withMessage('Recipients must be a non-empty array'),
        body('recipients.*')
            .isEthereumAddress()
            .withMessage('Each recipient must be a valid Ethereum address'),
        body('amounts')
            .isArray({ min: 1 })
            .withMessage('Amounts must be a non-empty array'),
        body('amounts.*')
            .isFloat({ min: 0 })
            .withMessage('Each amount must be a positive number'),
        body('reason')
            .optional()
            .isString()
            .trim()
            .isLength({ max: 200 })
            .withMessage('Reason must be a string (max 200 characters)')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { vaultType, recipients, amounts, reason = 'Token Distribution' } = req.body;
        // Additional validation
        if (recipients.length !== amounts.length) {
            return res.status(400).json({
                success: false,
                error: {
                    message: 'Recipients and amounts arrays must have the same length',
                    code: 'ARRAY_LENGTH_MISMATCH'
                }
            });
        }

        const result = await blockchainService.distributeFromVault(vaultType, recipients, amounts, reason);

        res.json({
            success: true,
            data: result
        });
    })
);

/**
 * @swagger
 * /api/tokens/balance/{address}:
 *   get:
 *     summary: Get player's token balance
 *     tags: [Tokens]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/balance/:address',
    [
        param('address')
            .isEthereumAddress()
            .withMessage('Invalid Ethereum address')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { address } = req.params;
        const balance = await blockchainService.getPlayerBalance(address);
        res.json({
            success: true,
            data: {
                playerAddress: address,
                balance: balance,
                currency: 'MWT'
            }
        });
    })
);

/**
 * @swagger
 * /api/tokens/stats:
 *   get:
 *     summary: Get contract statistics
 *     tags: [Tokens]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/stats',
    asyncHandler(async (req, res) => {
        const stats = await blockchainService.getContractStats();
        res.json({
            success: true,
            data: stats
        });
    })
);

/**
 * @swagger
 * /api/tokens/transaction/{hash}:
 *   get:
 *     summary: Get transaction status
 *     tags: [Tokens]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/transaction/:hash',
    [
        param('hash')
            .isLength({ min: 66, max: 66 })
            .matches(/^0x[a-fA-F0-9]{64}$/)
            .withMessage('Invalid transaction hash')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { hash } = req.params;
        const status = await blockchainService.getTransactionStatus(hash);
        res.json({
            success: true,
            data: status
        });
    })
);

/**
 * @swagger
 * /api/tokens/estimate-gas:
 *   post:
 *     summary: Estimate gas cost for distribution
 *     tags: [Tokens]
 *     security:
 *       - ApiKeyAuth: []
 */
router.post('/estimate-gas',
    [
        body('method')
            .isIn(['distributeEqualFromVault', 'distributeFromVault'])
            .withMessage('Method must be distributeEqualFromVault or distributeFromVault'),
        body('vaultType')
            .isInt({ min: 0, max: 3 })
            .withMessage('Vault type must be 0-3'),
        body('recipients')
            .isArray({ min: 1 })
            .withMessage('Recipients must be a non-empty array'),
        body('recipients.*')
            .isEthereumAddress()
            .withMessage('Each recipient must be a valid Ethereum address'),
        body('amount')
            .isFloat({ min: 0 })
            .withMessage('Amount must be a positive number'),
        body('amounts')
            .optional()
            .isArray({ min: 1 })
            .withMessage('Amounts must be a non-empty array when using distributeFromVault'),
        body('amounts.*')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('Each amount must be a positive number')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { method, vaultType, recipients, amount, amounts } = req.body;

        let params;
        if (method === 'distributeEqualFromVault') {
            if (!amount) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'amount required for distributeEqualFromVault',
                        code: 'MISSING_AMOUNT'
                    }
                });
            }
            const amountInWei = ethers.parseEther(amount.toString());
            params = [vaultType, recipients, amountInWei, 'Gas Estimation'];
        } else if (method === 'distributeFromVault') {
            if (!amounts) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'amounts array required for distributeFromVault',
                        code: 'MISSING_AMOUNTS'
                    }
                });
            }
            if (recipients.length !== amounts.length) {
                return res.status(400).json({
                    success: false,
                    error: {
                        message: 'Recipients and amounts arrays must have the same length',
                        code: 'ARRAY_LENGTH_MISMATCH'
                    }
                });
            }
            const amountsInWei = amounts.map(a => ethers.parseEther(a.toString()));
            params = [vaultType, recipients, amountsInWei, 'Gas Estimation'];
        }

        const gasEstimate = await blockchainService.estimateGas(method, params);

        res.json({
            success: true,
            data: gasEstimate
        });
    })
);

module.exports = router;




  
