/**
 * @swagger
 * tags:
 *   name: OrderBook
 *   description: Order book management endpoints for MWG/BNB token exchange
 */

const express = require('express');
const router = express.Router();
const orderBookService = require('../services/orderBookService');
const { validateAddress, validatePagination, validateOrderType, validateStatus } = require('../utils/validators');

/**
 * @swagger
 * /api/orderbook/orders:
 *   get:
 *     summary: Get active orders
 *     description: Retrieves active buy and sell orders with optional filtering by order type
 *     tags: [OrderBook]
 *     parameters:
 *       - in: query
 *         name: orderType
 *         schema:
 *           type: integer
 *           enum: [0, 1]
 *         description: Filter by order type (0 = BUY, 1 = SELL)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Active orders successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 orders:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       orderId:
 *                         type: string
 *                       user:
 *                         type: string
 *                       orderType:
 *                         type: integer
 *                       mwgAmount:
 *                         type: string
 *                       bnbAmount:
 *                         type: string
 *                       pricePerMWG:
 *                         type: string
 *                       filled:
 *                         type: string
 *                       remaining:
 *                         type: string
 *                       status:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       expiresAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     hasMore:
 *                       type: boolean
 *       500:
 *         description: Server error
 */
router.get('/orders', validatePagination, async (req, res) => {
    try {
        const { orderType, limit, offset } = req.query;

        const result = await orderBookService.getActiveOrders(
            orderType ? parseInt(orderType) : null,
            parseInt(limit) || 50,
            parseInt(offset) || 0
        );

        res.json(result);
    } catch (error) {
        console.error('[OrderBook API] Error getting orders:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch orders'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/orders/{orderId}:
 *   get:
 *     summary: Get order details
 *     description: Retrieves specific order details including fill history
 *     tags: [OrderBook]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order details successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 order:
 *                   type: object
 *                 fills:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Order not found
 *       500:
 *         description: Server error
 */
router.get('/orders/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const result = await orderBookService.getOrderDetails(orderId);

        if (!result.success) {
            return res.status(404).json(result);
        }

        res.json(result);
    } catch (error) {
        console.error(`[OrderBook API] Error getting order ${req.params.orderId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order details'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/fills:
 *   get:
 *     summary: Get all fills
 *     description: Retrieves all order fills with pagination
 *     tags: [OrderBook]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Fills successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 fills:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fillId:
 *                         type: string
 *                       orderId:
 *                         type: string
 *                       filler:
 *                         type: string
 *                       mwgAmount:
 *                         type: string
 *                       bnbAmount:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   type: object
 *       500:
 *         description: Server error
 */
router.get('/fills', validatePagination, async (req, res) => {
    try {
        const { limit, offset } = req.query;

        const result = await orderBookService.getRecentFills(
            parseInt(limit) || 20,
            parseInt(offset) || 0
        );

        res.json(result);
    } catch (error) {
        console.error('[OrderBook API] Error getting fills:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch fills'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/fills/{orderId}:
 *   get:
 *     summary: Get fills for specific order
 *     description: Retrieves all fills for a specific order ID
 *     tags: [OrderBook]
 *     parameters:
 *       - in: path
 *         name: orderId
 *         required: true
 *         schema:
 *           type: string
 *         description: Order ID
 *     responses:
 *       200:
 *         description: Order fills successfully retrieved
 *       500:
 *         description: Server error
 */
router.get('/fills/:orderId', async (req, res) => {
    try {
        const { orderId } = req.params;

        const result = await orderBookService.getOrderFills(orderId);

        res.json(result);
    } catch (error) {
        console.error(`[OrderBook API] Error getting fills for order ${req.params.orderId}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch order fills'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/stats:
 *   get:
 *     summary: Get order book statistics
 *     description: Retrieves overall order book statistics including total orders, volume, and active orders
 *     tags: [OrderBook]
 *     responses:
 *       200:
 *         description: Statistics successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 stats:
 *                   type: object
 *                   properties:
 *                     totalOrders:
 *                       type: integer
 *                     activeOrders:
 *                       type: integer
 *                     totalBuyOrders:
 *                       type: integer
 *                     totalSellOrders:
 *                       type: integer
 *                     totalVolumeMWG:
 *                       type: string
 *                     totalVolumeBNB:
 *                       type: string
 *                     totalFills:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/stats', async (req, res) => {
    try {
        const result = await orderBookService.getOrderBookStats();

        res.json(result);
    } catch (error) {
        console.error('[OrderBook API] Error getting stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch statistics'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/recent-activity:
 *   get:
 *     summary: Get recent activity
 *     description: Retrieves recent activity across all event types (orders created, filled, cancelled, withdrawals)
 *     tags: [OrderBook]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of events to return
 *     responses:
 *       200:
 *         description: Recent activity successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 activity:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [order_created, order_filled, order_cancelled, withdrawal]
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       data:
 *                         type: object
 *       500:
 *         description: Server error
 */
router.get('/recent-activity', async (req, res) => {
    try {
        const { limit } = req.query;

        const result = await orderBookService.getRecentActivity(
            parseInt(limit) || 20
        );

        res.json(result);
    } catch (error) {
        console.error('[OrderBook API] Error getting recent activity:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent activity'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/best-prices:
 *   get:
 *     summary: Get best prices
 *     description: Retrieves the best available buy and sell prices in the order book
 *     tags: [OrderBook]
 *     responses:
 *       200:
 *         description: Best prices successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 bestBuy:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     pricePerMWG:
 *                       type: string
 *                     orderId:
 *                       type: string
 *                     remaining:
 *                       type: string
 *                 bestSell:
 *                   type: object
 *                   nullable: true
 *                   properties:
 *                     pricePerMWG:
 *                       type: string
 *                     orderId:
 *                       type: string
 *                     remaining:
 *                       type: string
 *                 spread:
 *                   type: string
 *                   nullable: true
 *       500:
 *         description: Server error
 */
router.get('/best-prices', async (req, res) => {
    try {
        const result = await orderBookService.getBestPrices();

        res.json(result);
    } catch (error) {
        console.error('[OrderBook API] Error getting best prices:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch best prices'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/user/{address}/orders:
 *   get:
 *     summary: Get user's orders
 *     description: Retrieves all orders created by a specific user address
 *     tags: [OrderBook]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User's Ethereum address
 *       - in: query
 *         name: status
 *         schema:
 *           type: integer
 *         description: Filter by order status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: User orders successfully retrieved
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Server error
 */
router.get('/user/:address/orders', validateAddress, validatePagination, async (req, res) => {
    try {
        const { address } = req.params;
        const { status, limit, offset } = req.query;

        const result = await orderBookService.getUserOrders(
            address,
            status ? parseInt(status) : null,
            parseInt(limit) || 50,
            parseInt(offset) || 0
        );

        res.json(result);
    } catch (error) {
        console.error(`[OrderBook API] Error getting orders for ${req.params.address}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user orders'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/user/{address}/fills-as-filler:
 *   get:
 *     summary: Get user's fills as filler
 *     description: Retrieves fills where the user filled other people's orders
 *     tags: [OrderBook]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User's Ethereum address
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Fills successfully retrieved
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Server error
 */
router.get('/user/:address/fills-as-filler', validateAddress, validatePagination, async (req, res) => {
    try {
        const { address } = req.params;
        const { limit, offset } = req.query;

        const result = await orderBookService.getFillsByFiller(
            address,
            parseInt(limit) || 50,
            parseInt(offset) || 0
        );

        res.json(result);
    } catch (error) {
        console.error(`[OrderBook API] Error getting fills for filler ${req.params.address}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch fills'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/user/{address}/fills-as-creator:
 *   get:
 *     summary: Get user's fills as creator
 *     description: Retrieves fills where the user's orders were filled by others
 *     tags: [OrderBook]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User's Ethereum address
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Fills successfully retrieved
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Server error
 */
router.get('/user/:address/fills-as-creator', validateAddress, validatePagination, async (req, res) => {
    try {
        const { address } = req.params;
        const { limit, offset } = req.query;

        const result = await orderBookService.getFillsByOrderCreator(
            address,
            parseInt(limit) || 50,
            parseInt(offset) || 0
        );

        res.json(result);
    } catch (error) {
        console.error(`[OrderBook API] Error getting fills for creator ${req.params.address}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch fills'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/user/{address}/withdrawals:
 *   get:
 *     summary: Get user's withdrawals
 *     description: Retrieves all withdrawals made by a specific user
 *     tags: [OrderBook]
 *     parameters:
 *       - in: path
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: User's Ethereum address
 *       - in: query
 *         name: amountType
 *         schema:
 *           type: string
 *           enum: [MWG, BNB]
 *         description: Filter by token type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Withdrawals successfully retrieved
 *       400:
 *         description: Invalid address
 *       500:
 *         description: Server error
 */
router.get('/user/:address/withdrawals', validateAddress, validatePagination, async (req, res) => {
    try {
        const { address } = req.params;
        const { amountType, limit, offset } = req.query;

        const result = await orderBookService.getUserWithdrawals(
            address,
            amountType || null,
            parseInt(limit) || 50,
            parseInt(offset) || 0
        );

        res.json(result);
    } catch (error) {
        console.error(`[OrderBook API] Error getting withdrawals for ${req.params.address}:`, error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch withdrawals'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/admin/search:
 *   post:
 *     summary: Search orders (Admin)
 *     description: Advanced search for orders by various criteria - Admin only
 *     tags: [OrderBook]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: string
 *               orderType:
 *                 type: integer
 *               status:
 *                 type: string
 *               minAmount:
 *                 type: string
 *               maxAmount:
 *                 type: string
 *               dateFrom:
 *                 type: string
 *                 format: date-time
 *               dateTo:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Search results successfully retrieved
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/admin/search', async (req, res) => {
    try {
        const criteria = req.body;

        const result = await orderBookService.searchOrders(criteria);

        res.json(result);
    } catch (error) {
        console.error('[OrderBook API] Error searching orders:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to search orders'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/admin/analytics:
 *   get:
 *     summary: Get analytics (Admin)
 *     description: Retrieves detailed order book analytics and metrics - Admin only
 *     tags: [OrderBook]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics period
 *     responses:
 *       200:
 *         description: Analytics successfully retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 analytics:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get('/admin/analytics', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const result = await orderBookService.getAnalytics(
            startDate || null,
            endDate || null
        );

        res.json(result);
    } catch (error) {
        console.error('[OrderBook API] Error getting analytics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch analytics'
        });
    }
});

/**
 * @swagger
 * /api/orderbook/admin/sync:
 *   post:
 *     summary: Trigger historical sync (Admin)
 *     description: Manually trigger historical event synchronization from blockchain - Admin only
 *     tags: [OrderBook]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fromBlock:
 *                 type: integer
 *                 description: Starting block number (default from env)
 *               toBlock:
 *                 type: integer
 *                 description: Ending block number (default 'latest')
 *               batchSize:
 *                 type: integer
 *                 description: Number of blocks per batch (default 1000)
 *     responses:
 *       200:
 *         description: Sync started successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 config:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post('/admin/sync', async (req, res) => {
    try {
        const { fromBlock, toBlock, batchSize } = req.body;

        // Get config from environment
        const config = {
            contractAddress: process.env.ORDERBOOK_CONTRACT_ADDRESS_TESTNET || process.env.ORDERBOOK_CONTRACT_ADDRESS_MAINNET,
            network: process.env.NETWORK || 'bscTestnet',
            rpcUrl: process.env.BSC_TESTNET_RPC || process.env.BSC_MAINNET_RPC,
            fromBlock: fromBlock || parseInt(process.env.ORDERBOOK_START_BLOCK_TESTNET || '0'),
            toBlock: toBlock || 'latest',
            batchSize: batchSize || 1000
        };

        const { syncHistoricalEvents } = require('../services');

        // Start sync in background
        syncHistoricalEvents(config)
            .then(result => {
                console.log('[OrderBook API] Historical sync completed:', result);
            })
            .catch(error => {
                console.error('[OrderBook API] Historical sync failed:', error);
            });

        res.json({
            success: true,
            message: 'Historical sync started in background',
            config: {
                fromBlock: config.fromBlock,
                toBlock: config.toBlock,
                batchSize: config.batchSize
            }
        });
    } catch (error) {
        console.error('[OrderBook API] Error starting sync:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start historical sync'
        });
    }
});

module.exports = router;
