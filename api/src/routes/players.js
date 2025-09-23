const express = require('express');
const { param, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { requirePermission } = require('../middleware/auth');
const blockchainService = require('../services/blockchain');

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
 * /api/players/stats/{address}:
 *   get:
 *     summary: Get player statistics
 *     tags: [Players]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: Player's wallet address
 *     responses:
 *       200:
 *         description: Player statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     playerAddress:
 *                       type: string
 *                     dailyReceived:
 *                       type: string
 *                     totalEarned:
 *                       type: string
 *                     lastReward:
 *                       type: string
 *                     currentBalance:
 *                       type: string
 *       400:
 *         description: Invalid address
 *       404:
 *         description: Player not found
 */
router.get('/stats/:address',
    [
        param('address')
            .isEthereumAddress()
            .withMessage('Invalid Ethereum address')
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { address } = req.params;
        const stats = await blockchainService.getPlayerStats(address);
        res.json({
            success: true,
            data: stats
        });
    })
);

/**
 * @swagger
 * /api/players/balance/{address}:
 *   get:
 *     summary: Get player's current token balance
 *     tags: [Players]
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
                currency: 'MWT',
                timestamp: new Date().toISOString()
            }
        });
    })
);

/**
 * @swagger
 * /api/players/validate/{address}:
 *   get:
 *     summary: Validate if an address is a valid Ethereum address
 *     tags: [Players]
 *     security:
 *       - ApiKeyAuth: []
 */
router.get('/validate/:address',
    asyncHandler(async (req, res) => {
        const { address } = req.params;
        const { ethers } = require('ethers');
        const isValid = ethers.isAddress(address);

        res.json({
            success: true,
            data: {
                address: address,
                isValid: isValid,
                checksumAddress: isValid ? ethers.getAddress(address) : null
            }
        });
    })
);

module.exports = router;