/**
 * @swagger
 * tags:
 *   name: Merkle
 *   description: Merkle distribution endpoints for creating and managing token airdrops/distributions
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { authMiddleware, requirePermission } = require('../middleware/auth');
const blockchainService = require('../services/blockchain');
const MerkleTreeBuilder = require('../utils/merkleTreeBuilder');
const MerkleDistribution = require('../models/MerkleDistribution');
const MerkleLeaf = require('../models/MerkleLeaf');
const MerkleDistributionService = require('../merkle/services/merkleDistributionService');
const { ethers } = require('ethers');
const logger = require('../utils/logger');

const router = express.Router();

// Singleton instance of MerkleDistributionService
let merkleServiceInstance = null;

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
 * Get Merkle distribution service (Singleton pattern)
 * Creates instance once and reuses it for all requests
 */
const getMerkleService = () => {
    if (!merkleServiceInstance) {
        merkleServiceInstance = new MerkleDistributionService(
            blockchainService.provider,
            blockchainService.wallet,
            blockchainService.gameContract.target
        );
        logger.info('MerkleDistributionService singleton initialized');
    }
    return merkleServiceInstance;
};

// ============================================
// PUBLIC ENDPOINTS
// ============================================

/**
 * @swagger
 * /api/merkle/distributions:
 *   get:
 *     summary: List all Merkle distributions
 *     description: Retrieve a list of all Merkle distributions with optional filtering
 *     tags: [Merkle]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, active, expired, finalized]
 *         description: Filter by distribution status
 *       - in: query
 *         name: vaultType
 *         schema:
 *           type: string
 *           enum: [PLAYER_TASKS, SOCIAL_FOLLOWERS, SOCIAL_POSTERS, ECOSYSTEM_FUND]
 *         description: Filter by vault type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of results to return
 *     responses:
 *       200:
 *         description: List of distributions successfully retrieved
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
 *                     distributions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: integer
 *                       example: 10
 *       400:
 *         description: Validation error
 *       500:
 *         description: Internal server error
 */
router.get('/distributions',
    [
        query('status').optional().isIn(['pending', 'active', 'expired', 'finalized']),
        query('vaultType').optional().isIn(['PLAYER_TASKS', 'SOCIAL_FOLLOWERS', 'SOCIAL_POSTERS', 'ECOSYSTEM_FUND']),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const merkleService = getMerkleService();

        const filters = {
            status: req.query.status,
            vaultType: req.query.vaultType,
            limit: req.query.limit || 50,
        };

        const distributions = await merkleService.listDistributions(filters);

        res.json({
            success: true,
            data: {
                distributions,
                count: distributions.length,
            }
        });
    })
);

/**
 * @swagger
 * /api/merkle/distributions/{id}:
 *   get:
 *     summary: Get specific distribution details
 *     description: Retrieve detailed information about a specific Merkle distribution including statistics
 *     tags: [Merkle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Distribution ID
 *     responses:
 *       200:
 *         description: Distribution details successfully retrieved
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
 *                     distribution:
 *                       type: object
 *                     stats:
 *                       type: object
 *       404:
 *         description: Distribution not found
 *       500:
 *         description: Internal server error
 */
router.get('/distributions/:id',
    [
        param('id').isInt({ min: 0 }).toInt(),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const distributionId = req.params.id;

        const distribution = await MerkleDistribution.findOne({ distributionId });

        if (!distribution) {
            return res.status(404).json({
                success: false,
                error: {
                    message: 'Distribution not found',
                    code: 'DISTRIBUTION_NOT_FOUND'
                }
            });
        }

        const merkleService = getMerkleService();
        const stats = await merkleService.getDistributionStats(distributionId);

        res.json({
            success: true,
            data: {
                distribution: distribution.toObject(),
                stats,
            }
        });
    })
);

/**
 * @swagger
 * /api/merkle/distributions/{id}/eligibility/{address}:
 *   get:
 *     summary: Check address eligibility
 *     description: Check if a specific address is eligible to claim from a distribution
 *     tags: [Merkle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Distribution ID
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Ethereum address to check
 *     responses:
 *       200:
 *         description: Eligibility status retrieved
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
 *                     eligible:
 *                       type: boolean
 *                       example: true
 *                     claimable:
 *                       type: string
 *                       example: "1000000000000000000"
 *                     allocatedAmount:
 *                       type: string
 *                     claimedAmount:
 *                       type: string
 *       400:
 *         description: Invalid address format
 *       500:
 *         description: Internal server error
 */
router.get('/distributions/:id/eligibility/:address',
    [
        param('id').isInt({ min: 0 }).toInt(),
        param('address').custom(value => {

            if (!ethers.isAddress(value)) {
                throw new Error('Invalid Ethereum address');
            }
            return true;
        }),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { id: distributionId, address } = req.params;

        const merkleService = getMerkleService();
        const claimableInfo = await merkleService.getClaimableAmount(distributionId, address);

        res.json({
            success: true,
            data: claimableInfo,
        });
    })
);

/**
 * @swagger
 * /api/merkle/distributions/{id}/proof/{address}:
 *   get:
 *     summary: Get Merkle proof for address
 *     description: Generate Merkle proof that user can use to claim tokens on-chain
 *     tags: [Merkle]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Distribution ID
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Ethereum address to get proof for
 *     responses:
 *       200:
 *         description: Merkle proof generated successfully
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
 *                     eligible:
 *                       type: boolean
 *                       example: true
 *                     proof:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["0xabc...", "0xdef..."]
 *                     allocatedAmount:
 *                       type: string
 *                     claimedAmount:
 *                       type: string
 *                     unclaimedAmount:
 *                       type: string
 *                     leafHash:
 *                       type: string
 *       400:
 *         description: Invalid address format
 *       404:
 *         description: Address not found in distribution
 *       500:
 *         description: Internal server error
 */
router.get('/distributions/:id/proof/:address',
    [
        param('id').isInt({ min: 0 }).toInt(),
        param('address').custom(value => {
            const { ethers } = require('ethers');
            if (!ethers.isAddress(value)) {
                throw new Error('Invalid Ethereum address');
            }
            return true;
        }),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { id: distributionId, address } = req.params;

        const merkleService = getMerkleService();
        const proofData = await merkleService.getProof(distributionId, address);

        res.json({
            success: true,
            data: proofData,
        });
    })
);

/**
 * @swagger
 * /api/merkle/users/{address}/distributions:
 *   get:
 *     summary: Get all distributions for a user
 *     description: Retrieve all distributions that a specific address is eligible for
 *     tags: [Merkle]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *           pattern: '^0x[a-fA-F0-9]{40}$'
 *         description: Ethereum address to check
 *     responses:
 *       200:
 *         description: User distributions retrieved successfully
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
 *                     address:
 *                       type: string
 *                       example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     distributions:
 *                       type: array
 *                       items:
 *                         type: object
 *                     count:
 *                       type: integer
 *                       example: 3
 *       400:
 *         description: Invalid address format
 *       500:
 *         description: Internal server error
 */
router.get('/users/:address/distributions',
    [
        param('address').custom(value => {
            const { ethers } = require('ethers');
            if (!ethers.isAddress(value)) {
                throw new Error('Invalid Ethereum address');
            }
            return true;
        }),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { address } = req.params;

        const merkleService = getMerkleService();
        const distributions = await merkleService.getUserDistributions(address);

        res.json({
            success: true,
            data: {
                address,
                distributions,
                count: distributions.length,
            }
        });
    })
);

// ============================================
// ADMIN ENDPOINTS (Require Authentication)
// ============================================

/**
 * @swagger
 * /api/merkle/distributions/create:
 *   post:
 *     summary: Create new Merkle distribution
 *     description: Create a new Merkle-based token distribution from JSON allocations (Admin only)
 *     tags: [Merkle]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - allocations
 *               - vaultType
 *               - durationInDays
 *               - title
 *             properties:
 *               allocations:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - address
 *                     - amount
 *                   properties:
 *                     address:
 *                       type: string
 *                       pattern: '^0x[a-fA-F0-9]{40}$'
 *                       example: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
 *                     amount:
 *                       type: number
 *                       example: 100
 *               vaultType:
 *                 type: string
 *                 enum: [PLAYER_TASKS, SOCIAL_FOLLOWERS, SOCIAL_POSTERS, ECOSYSTEM_FUND]
 *                 example: "PLAYER_TASKS"
 *               durationInDays:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 example: 30
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 200
 *                 example: "Q4 2024 Player Rewards"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Reward distribution for top players"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["rewards", "players"]
 *               category:
 *                 type: string
 *                 example: "gameplay"
 *     responses:
 *       201:
 *         description: Distribution created successfully
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
 *                     distribution:
 *                       type: object
 *                     stats:
 *                       type: object
 *                     transactionHash:
 *                       type: string
 *                     blockNumber:
 *                       type: integer
 *       400:
 *         description: Validation error or insufficient vault balance
 *       401:
 *         description: Unauthorized - API key required
 *       403:
 *         description: Forbidden - admin permission required
 *       500:
 *         description: Internal server error
 */
router.post('/distributions/create',
    authMiddleware,
    requirePermission('admin'),
    [
        body('allocations').isArray({ min: 1 }),
        body('allocations.*.address').custom(value => {
            const { ethers } = require('ethers');
            if (!ethers.isAddress(value)) {
                throw new Error('Invalid Ethereum address');
            }
            return true;
        }),
        body('allocations.*.amount').isNumeric(),
        body('vaultType').isIn(['PLAYER_TASKS', 'SOCIAL_FOLLOWERS', 'SOCIAL_POSTERS', 'ECOSYSTEM_FUND']),
        body('durationInDays').isInt({ min: 1, max: 365 }),
        body('title').isString().trim().isLength({ min: 1, max: 200 }),
        body('description').optional().isString().trim().isLength({ max: 1000 }),
        body('tags').optional().isArray(),
        body('category').optional().isString(),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { allocations, vaultType, durationInDays, title, description, tags, category } = req.body;

        logger.info(`Admin creating Merkle distribution: ${title}`);

        const merkleService = getMerkleService();

        const metadata = {
            title,
            description,
            tags,
            category,
        };

        // Use authenticated user's wallet address or blockchain service wallet as creator
        const creatorAddress = req.apiKey.wallet || blockchainService.wallet.address;

        const result = await merkleService.createDistribution(
            allocations,
            vaultType,
            durationInDays,
            metadata,
            creatorAddress
        );

        logger.info(`Distribution created successfully: ID ${result.distribution.distributionId}`);

        res.status(201).json({
            success: true,
            data: result,
        });
    })
);

/**
 * @swagger
 * /api/merkle/distributions/{id}/sync:
 *   post:
 *     summary: Sync distribution from blockchain
 *     description: Synchronize distribution data from on-chain state (Admin only)
 *     tags: [Merkle]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Distribution ID
 *     responses:
 *       200:
 *         description: Distribution synced successfully
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Distribution not found
 *       500:
 *         description: Internal server error
 */
router.post('/distributions/:id/sync',
    authMiddleware,
    requirePermission('admin'),
    [
        param('id').isInt({ min: 0 }).toInt(),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const distributionId = req.params.id;

        logger.info(`Syncing distribution ${distributionId} from blockchain`);

        const merkleService = getMerkleService();
        const distribution = await merkleService.syncDistribution(distributionId);

        res.json({
            success: true,
            data: distribution,
        });
    })
);

/**
 * @swagger
 * /api/merkle/distributions/{id}/finalize:
 *   post:
 *     summary: Finalize expired distribution
 *     description: Finalize an expired distribution and return unclaimed tokens to vault (Admin only)
 *     tags: [Merkle]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Distribution ID
 *     responses:
 *       200:
 *         description: Distribution finalized successfully
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
 *                     distributionId:
 *                       type: integer
 *                     transactionHash:
 *                       type: string
 *                     blockNumber:
 *                       type: integer
 *                     distribution:
 *                       type: object
 *       400:
 *         description: Distribution not expired or already finalized
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Distribution not found
 *       500:
 *         description: Internal server error
 */
router.post('/distributions/:id/finalize',
    authMiddleware,
    requirePermission('admin'),
    [
        param('id').isInt({ min: 0 }).toInt(),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const distributionId = req.params.id;

        logger.info(`Finalizing distribution ${distributionId}`);

        const merkleService = getMerkleService();
        const result = await merkleService.finalizeDistribution(distributionId);

        logger.info(`Distribution ${distributionId} finalized`);

        res.json({
            success: true,
            data: result,
        });
    })
);

/**
 * @swagger
 * /api/merkle/validate-allocations:
 *   post:
 *     summary: Validate allocations before creating distribution
 *     description: Validate allocation data and get statistics before committing to blockchain (Admin only)
 *     tags: [Merkle]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - allocations
 *             properties:
 *               allocations:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - address
 *                     - amount
 *                   properties:
 *                     address:
 *                       type: string
 *                       pattern: '^0x[a-fA-F0-9]{40}$'
 *                     amount:
 *                       type: number
 *     responses:
 *       200:
 *         description: Allocations validated successfully
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
 *                     valid:
 *                       type: boolean
 *                       example: true
 *                     stats:
 *                       type: object
 *                       properties:
 *                         recipientCount:
 *                           type: integer
 *                         totalAllocated:
 *                           type: string
 *                         merkleRoot:
 *                           type: string
 *                         treeDepth:
 *                           type: integer
 *                         averageAllocation:
 *                           type: string
 *                         minAllocation:
 *                           type: string
 *                         maxAllocation:
 *                           type: string
 *       400:
 *         description: Invalid allocations
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.post('/validate-allocations',
    authMiddleware,
    requirePermission('admin'),
    [
        body('allocations').isArray({ min: 1 }),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const { allocations } = req.body;

        const validation = MerkleTreeBuilder.validateAllocations(allocations);

        if (validation.valid) {
            // Build tree to get stats
            const treeData = MerkleTreeBuilder.buildTree(allocations);
            const stats = MerkleTreeBuilder.getTreeStats(treeData);

            res.json({
                success: true,
                data: {
                    valid: true,
                    stats,
                }
            });
        } else {
            res.status(400).json({
                success: false,
                error: {
                    message: 'Invalid allocations',
                    code: 'INVALID_ALLOCATIONS',
                    details: validation.errors,
                }
            });
        }
    })
);

/**
 * @swagger
 * /api/merkle/distributions/{id}/leaves:
 *   get:
 *     summary: Get all leaves for a distribution
 *     description: Retrieve all allocation leaves for a distribution with pagination (Admin only)
 *     tags: [Merkle]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Distribution ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Leaves retrieved successfully
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
 *                     leaves:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           userAddress:
 *                             type: string
 *                           allocatedAmount:
 *                             type: string
 *                           claimedAmount:
 *                             type: string
 *                           leafHash:
 *                             type: string
 *                           leafIndex:
 *                             type: integer
 *                           fullyClaimed:
 *                             type: boolean
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         pages:
 *                           type: integer
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       500:
 *         description: Internal server error
 */
router.get('/distributions/:id/leaves',
    authMiddleware,
    requirePermission('admin'),
    [
        param('id').isInt({ min: 0 }).toInt(),
        query('page').optional().isInt({ min: 1 }).toInt(),
        query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    ],
    handleValidationErrors,
    asyncHandler(async (req, res) => {
        const distributionId = req.params.id;
        const page = req.query.page || 1;
        const limit = req.query.limit || 50;
        const skip = (page - 1) * limit;

        const [leaves, total] = await Promise.all([
            MerkleLeaf.find({ distributionId })
                .sort({ leafIndex: 1 })
                .skip(skip)
                .limit(limit),
            MerkleLeaf.countDocuments({ distributionId }),
        ]);

        res.json({
            success: true,
            data: {
                leaves: leaves.map(l => l.toObject()),
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                }
            }
        });
    })
);

module.exports = router;
