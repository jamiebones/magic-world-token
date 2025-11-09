/**
 * @swagger
 * tags:
 *   name: Bot
 *   description: Automated trading bot endpoints for price monitoring, trade execution, and portfolio management
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission } = require('../middleware/auth');
const PriceOracle = require('../bot/services/priceOracle');
const PriceOracleV3 = require('../bot/services/priceOracleV3');
const TradeExecutor = require('../bot/services/tradeExecutor');
const { Trade, PriceHistory, BotConfig } = require('../bot/models');
const logger = require('../utils/logger');

// Apply authentication to all bot routes
// All bot endpoints require 'bot' or 'admin' permission
router.use(authMiddleware);
router.use(requirePermission('bot'));

// Initialize services - use V3 oracle if IS_V3_POOL is true
const isV3Pool = process.env.IS_V3_POOL === 'true';
const priceOracle = isV3Pool ? new PriceOracleV3() : new PriceOracle();
const tradeExecutor = new TradeExecutor();

logger.info(`Bot initialized with ${isV3Pool ? 'V3' : 'V2'} price oracle`);

// Middleware to check if bot is enabled
const checkBotEnabled = async (req, res, next) => {
    try {
        const config = await BotConfig.getDefault();

        if (!config.enabled) {
            return res.status(403).json({
                success: false,
                error: 'Bot is currently disabled',
                pausedAt: config.pausedAt,
                pauseReason: config.pauseReason
            });
        }

        req.botConfig = config;
        next();
    } catch (error) {
        logger.error('Error checking bot status:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check bot status'
        });
    }
};

// ============================================================================
// PRICE ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/bot/prices/current:
 *   get:
 *     summary: Get current MWT prices
 *     description: Retrieves current MWT prices across all currencies (BNB, USD, BTC) from PancakeSwap and Chainlink oracles
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Current price data successfully retrieved
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
 *                     mwtBnb:
 *                       type: object
 *                       properties:
 *                         price:
 *                           type: string
 *                           example: "0.001"
 *                     bnbUsd:
 *                       type: object
 *                       properties:
 *                         price:
 *                           type: number
 *                           example: 600
 *                     mwtUsd:
 *                       type: object
 *                       properties:
 *                         price:
 *                           type: number
 *                           example: 0.6
 *                     mwtBtc:
 *                       type: object
 *                       properties:
 *                         price:
 *                           type: number
 *                           example: 0.000006
 *                         satoshis:
 *                           type: number
 *                           example: 600
 *                     liquidity:
 *                       type: object
 *                       properties:
 *                         totalLiquidityUSD:
 *                           type: number
 *                           example: 1200000
 *       500:
 *         description: Internal server error
 */
router.get('/prices/current', async (req, res) => {
    try {
        const prices = await priceOracle.getAllPrices();
        return res.json({
            success: true,
            data: prices,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching current prices:', error);
        logger.error('Error stack:', error.stack);
        return res.status(500).json({
            success: false,
            error: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

/**
 * @swagger
 * /api/bot/prices/deviation:
 *   get:
 *     summary: Get peg deviation
 *     description: Calculate how far MWT price deviates from target peg in USD and BTC
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: target
 *         schema:
 *           type: number
 *           default: 0.01
 *         description: Target price in USD
 *     responses:
 *       200:
 *         description: Peg deviation calculated successfully
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
 *                     usd:
 *                       type: object
 *                       properties:
 *                         currentPrice:
 *                           type: number
 *                           example: 0.012
 *                         targetPrice:
 *                           type: number
 *                           example: 0.01
 *                         deviationPercent:
 *                           type: number
 *                           example: 20.0
 *       500:
 *         description: Internal server error
 */
router.get('/prices/deviation', async (req, res) => {
    try {
        const targetPriceUSD = parseFloat(req.query.target || process.env.TARGET_PEG_USD || 0.01);
        const deviation = await priceOracle.getPegDeviation(targetPriceUSD);

        res.json({
            success: true,
            data: deviation,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error calculating deviation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/prices/history:
 *   get:
 *     summary: Get historical price data
 *     description: Retrieve MWT price history over a specified time period for trend analysis and charting
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours of history to retrieve (max 720 = 30 days)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 1000
 *         description: Maximum number of records to return
 *     responses:
 *       200:
 *         description: Price history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PriceData'
 *                 count:
 *                   type: integer
 *                   example: 144
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 * @route   GET /api/bot/prices/history
 * @desc    Get price history
 * @access  Public
 */
router.get('/prices/history', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours || 24);
        const limit = parseInt(req.query.limit || 1000);

        const history = await PriceHistory.getRecent(hours, limit);

        res.json({
            success: true,
            data: history,
            count: history.length,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching price history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/prices/statistics:
 *   get:
 *     summary: Get price statistics for a time period
 *     description: Calculate statistical analysis (min, max, average, volatility) of MWT prices over specified period
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to analyze
 *     responses:
 *       200:
 *         description: Price statistics calculated successfully
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
 *                       example: 144
 *                     mwtUsd:
 *                       type: object
 *                       properties:
 *                         min:
 *                           type: number
 *                           example: 0.0095
 *                         max:
 *                           type: number
 *                           example: 0.0115
 *                         average:
 *                           type: number
 *                           example: 0.0105
 *                         current:
 *                           type: number
 *                           example: 0.0109
 *                     mwtBtc:
 *                       type: object
 *                       properties:
 *                         minSatoshis:
 *                           type: number
 *                           example: 8.5
 *                         maxSatoshis:
 *                           type: number
 *                           example: 11.2
 *                         averageSatoshis:
 *                           type: number
 *                           example: 9.8
 *                     volatility:
 *                       type: number
 *                       example: 8.5
 *                       description: Price volatility percentage
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 * @route   GET /api/bot/prices/statistics
 * @desc    Get price statistics for a period
 * @access  Public
 */
router.get('/prices/statistics', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours || 24);
        const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

        const stats = await PriceHistory.getStatistics(startDate, new Date());

        res.json({
            success: true,
            data: stats,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching price statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/liquidity:
 *   get:
 *     summary: Get liquidity depth from PancakeSwap pair
 *     description: Retrieve current liquidity reserves and calculate liquidity health for trade sizing
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Liquidity data retrieved successfully
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
 *                     mwtReserve:
 *                       type: string
 *                       example: "5000000"
 *                       description: MWT token reserve in the pair
 *                     bnbReserve:
 *                       type: string
 *                       example: "4991.234"
 *                       description: BNB reserve in the pair
 *                     totalLiquidityUSD:
 *                       type: number
 *                       example: 10956789.12
 *                       description: Total liquidity value in USD
 *                     priceImpact:
 *                       type: object
 *                       properties:
 *                         for1BNB:
 *                           type: number
 *                           example: 0.02
 *                           description: Price impact % for 1 BNB trade
 *                         for5BNB:
 *                           type: number
 *                           example: 0.1
 *                         for10BNB:
 *                           type: number
 *                           example: 0.2
 *                     healthy:
 *                       type: boolean
 *                       example: true
 *                       description: Whether liquidity is sufficient for safe trading
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 * @route   GET /api/bot/liquidity
 * @desc    Get liquidity depth
 * @access  Public
 */
router.get('/liquidity', async (req, res) => {
    try {
        const liquidity = await priceOracle.getLiquidityDepth();

        res.json({
            success: true,
            data: liquidity,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching liquidity:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// TRADE ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/bot/trade/execute:
 *   post:
 *     summary: Execute a trade
 *     description: Execute a BUY (BNB → MWT) or SELL (MWT → BNB) trade on PancakeSwap. Requires bot to be enabled.
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *               - amount
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [BUY, SELL]
 *                 description: Trade action - BUY (BNB → MWT) or SELL (MWT → BNB)
 *                 example: BUY
 *               amount:
 *                 type: number
 *                 description: Amount to trade (BNB for BUY, MWT for SELL)
 *                 example: 0.1
 *               minOutput:
 *                 type: number
 *                 description: Minimum output expected (optional)
 *                 example: 95
 *               slippage:
 *                 type: number
 *                 description: Slippage tolerance (default 0.02 = 2%)
 *                 example: 0.02
 *               urgency:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, EMERGENCY]
 *                 description: Trade urgency level
 *                 example: MEDIUM
 *     responses:
 *       200:
 *         description: Trade executed successfully
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
 *                     trade:
 *                       type: object
 *                       properties:
 *                         tradeId:
 *                           type: string
 *                           example: trade_1234567890_abc123
 *                         txHash:
 *                           type: string
 *                           example: "0x..."
 *                         status:
 *                           type: string
 *                           example: SUCCESS
 *                         action:
 *                           type: string
 *                           example: BUY
 *                         inputAmount:
 *                           type: string
 *                           example: "0.1"
 *                         outputAmount:
 *                           type: string
 *                           example: "98.5"
 *       400:
 *         description: Invalid parameters
 *       403:
 *         description: Bot is disabled
 *       429:
 *         description: Daily trading limits exceeded
 *       500:
 *         description: Trade execution failed
 */
router.post('/trade/execute', checkBotEnabled, async (req, res) => {
    try {
        const { action, amount, minOutput, slippage, urgency } = req.body;

        // Validation
        if (!action || !['BUY', 'SELL'].includes(action)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid action. Must be BUY or SELL'
            });
        }

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount. Must be positive'
            });
        }

        // Check daily limits
        const limitsCheck = await req.botConfig.checkDailyLimits(Trade);
        if (limitsCheck.exceeded) {
            return res.status(429).json({
                success: false,
                error: 'Daily trading limits exceeded',
                limits: limitsCheck
            });
        }

        // Get current prices for context
        const prices = await priceOracle.getAllPrices();
        const deviation = await priceOracle.getPegDeviation();

        // Create trade record with placeholders for required chain fields
        const tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Prepare liquidity object expected by Trade model
        const liquidityObj = {
            totalUSD: typeof prices.liquidity === 'number' ? prices.liquidity : (Number(prices.liquidity) || 0),
            mwtReserve: prices.mwtReserve ? String(prices.mwtReserve) : null,
            bnbReserve: prices.bnbReserve ? String(prices.bnbReserve) : null
        };

        const trade = new Trade({
            tradeId,
            // temporary unique txHash until real tx executed
            txHash: `pending_${tradeId}`,
            // placeholder blockNumber (0 until mined)
            blockNumber: 0,
            action,
            inputAmount: amount.toString(),
            inputToken: action === 'BUY' ? 'BNB' : 'MWT',
            outputToken: action === 'BUY' ? 'MWT' : 'BNB',
            minOutputAmount: minOutput ? minOutput.toString() : '0',
            slippage: slippage || req.botConfig.slippage.default,
            urgency: urgency || 'MEDIUM',
            status: 'PENDING',
            marketPriceAtExecution: prices.mwtBnb ? String(prices.mwtBnb) : null,
            // store numeric peg deviation (percentage number, e.g. -0.43)
            pegDeviation: typeof deviation.deviation === 'number' ? deviation.deviation : parseFloat((deviation.deviationPercentage || '').replace('%', '')) || 0,
            liquidity: liquidityObj
        });

        await trade.save();

        // Execute trade
        let result;
        if (action === 'BUY') {
            result = await tradeExecutor.executeBuy(
                amount,
                minOutput || 0,
                slippage || req.botConfig.slippage.default,
                urgency || 'MEDIUM'
            );
        } else {
            result = await tradeExecutor.executeSell(
                amount,
                minOutput || 0,
                slippage || req.botConfig.slippage.default,
                urgency || 'MEDIUM'
            );
        }

        // Update trade record
        if (result.success) {
            await trade.markSuccess({
                outputAmount: result.minOutputAmount,
                executionPrice: result.inputAmount / parseFloat(result.minOutputAmount),
                gasUsed: result.gasUsed,
                gasPrice: result.gasPrice,
                gasCostBNB: result.gasCostBNB
            });

            // Update bot statistics
            await req.botConfig.recordTrade(trade);
        } else {
            await trade.markFailed(result.error);
            await req.botConfig.recordTrade(trade);
        }

        res.json({
            success: result.success,
            data: {
                trade: trade,
                execution: result
            },
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error executing trade:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/trade/estimate:
 *   post:
 *     summary: Estimate trade output
 *     description: Simulate a trade without executing to estimate output amount and price impact (dry-run)
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - action
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Amount to trade
 *                 example: 0.1
 *               action:
 *                 type: string
 *                 enum: [BUY, SELL]
 *                 description: Trade action
 *                 example: BUY
 *     responses:
 *       200:
 *         description: Trade estimated successfully
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
 *                     amountIn:
 *                       type: string
 *                       example: "0.1"
 *                     amountOut:
 *                       type: string
 *                       example: "98.5"
 *                     effectivePrice:
 *                       type: number
 *                       example: 0.001015
 *                     priceImpact:
 *                       type: number
 *                       example: 1.5
 *       400:
 *         description: Invalid parameters
 *       500:
 *         description: Estimation failed
 */
router.post('/trade/estimate', async (req, res) => {
    try {
        const { amount, action } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                error: 'Invalid amount'
            });
        }

        const isBuy = action === 'BUY';
        const estimate = await tradeExecutor.estimateSwapOutput(amount, isBuy);

        // Get current MWT/BNB price for price impact calculation
        const currentPrice = await priceOracle.getMWTBNBPrice();
        const effectivePrice = isBuy
            ? amount / parseFloat(estimate.amountOut)
            : parseFloat(estimate.amountOut) / amount;

        // calculatePriceImpact expects just the price number
        const priceImpact = tradeExecutor.calculatePriceImpact(
            amount,
            parseFloat(estimate.amountOut),
            currentPrice
        );

        res.json({
            success: true,
            data: {
                ...estimate,
                effectivePrice,
                priceImpact
            },
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error estimating trade:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/trade/history:
 *   get:
 *     summary: Get trade execution history
 *     description: Retrieve historical trades with optional filtering by status and time period
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Maximum number of trades to return
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, SUCCESS, FAILED]
 *         description: Filter by trade status (optional)
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours of history (ignored if status filter is used)
 *     responses:
 *       200:
 *         description: Trade history retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TradeResult'
 *                 count:
 *                   type: integer
 *                   example: 42
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 * @route   GET /api/bot/trade/history
 * @desc    Get trade history
 * @access  Public
 */
router.get('/trade/history', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || 50);
        const status = req.query.status;
        const hours = parseInt(req.query.hours || 24);

        let trades;
        if (status) {
            trades = await Trade.getByStatus(status, limit);
        } else {
            trades = await Trade.getRecent(hours, limit);
        }

        res.json({
            success: true,
            data: trades,
            count: trades.length,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching trade history:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/trade/statistics:
 *   get:
 *     summary: Get trade statistics for a time period
 *     description: Calculate trading performance metrics (success rate, volume, profit/loss) over specified period
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: hours
 *         schema:
 *           type: integer
 *           default: 24
 *         description: Number of hours to analyze
 *     responses:
 *       200:
 *         description: Trade statistics calculated successfully
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
 *                     totalTrades:
 *                       type: integer
 *                       example: 42
 *                     successful:
 *                       type: integer
 *                       example: 38
 *                     failed:
 *                       type: integer
 *                       example: 4
 *                     successRate:
 *                       type: number
 *                       example: 90.48
 *                       description: Percentage of successful trades
 *                     totalVolumeBNB:
 *                       type: number
 *                       example: 125.5
 *                     totalVolumeUSD:
 *                       type: number
 *                       example: 137234.25
 *                     profitLoss:
 *                       type: object
 *                       properties:
 *                         totalBNB:
 *                           type: number
 *                           example: 0.45
 *                         totalUSD:
 *                           type: number
 *                           example: 493.85
 *                         percentage:
 *                           type: number
 *                           example: 0.36
 *                     averages:
 *                       type: object
 *                       properties:
 *                         tradeSizeBNB:
 *                           type: number
 *                           example: 2.99
 *                         executionTimeMs:
 *                           type: number
 *                           example: 4523
 *                         gasCostBNB:
 *                           type: number
 *                           example: 0.00012
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 * @route   GET /api/bot/trade/statistics
 * @desc    Get trade statistics
 * @access  Public
 */
router.get('/trade/statistics', async (req, res) => {
    try {
        const hours = parseInt(req.query.hours || 24);
        const startDate = new Date(Date.now() - hours * 60 * 60 * 1000);

        const stats = await Trade.getStatistics(startDate, new Date());

        res.json({
            success: true,
            data: stats,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching trade statistics:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// BALANCE & PORTFOLIO ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/bot/balances:
 *   get:
 *     summary: Get bot wallet balances
 *     description: Retrieve bot wallet balances (BNB and MWT) with USD values
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Balances retrieved successfully
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
 *                     bnb:
 *                       type: string
 *                       example: "10.5"
 *                     mwt:
 *                       type: string
 *                       example: "10000.0"
 *                     bnbUSD:
 *                       type: number
 *                       example: 6300
 *                     mwtUSD:
 *                       type: number
 *                       example: 6000
 *                     totalUSD:
 *                       type: number
 *                       example: 12300
 *                     address:
 *                       type: string
 *                       example: "0x..."
 *       500:
 *         description: Failed to fetch balances
 */
router.get('/balances', async (req, res) => {
    try {
        const balances = await tradeExecutor.getBalances();

        // Get current prices for USD values
        const prices = await priceOracle.getAllPrices();

        const balancesWithUSD = {
            ...balances,
            bnbUSD: parseFloat(balances.bnb) * prices.bnbUsd.price,
            mwtUSD: parseFloat(balances.mwt) * prices.mwtUsd.price,
            totalUSD: (parseFloat(balances.bnb) * prices.bnbUsd.price) +
                (parseFloat(balances.mwt) * prices.mwtUsd.price)
        };

        res.json({
            success: true,
            data: balancesWithUSD,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching balances:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/portfolio/status:
 *   get:
 *     summary: Get comprehensive portfolio status
 *     description: Retrieve complete overview of bot portfolio including balances, prices, bot status, trading activity, and performance metrics
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Portfolio status retrieved successfully
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
 *                     balances:
 *                       type: object
 *                       properties:
 *                         bnb:
 *                           type: string
 *                           example: "10.5"
 *                         mwt:
 *                           type: string
 *                           example: "10000.0"
 *                         bnbUSD:
 *                           type: number
 *                           example: 6300
 *                         mwtUSD:
 *                           type: number
 *                           example: 6000
 *                         totalUSD:
 *                           type: number
 *                           example: 12300
 *                     prices:
 *                       type: object
 *                       properties:
 *                         mwtBnb:
 *                           type: number
 *                           example: 1001.44
 *                         mwtUsd:
 *                           type: number
 *                           example: 0.0109
 *                         mwtBtc:
 *                           type: number
 *                           example: 0.00000010
 *                     botStatus:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                           example: true
 *                         pausedAt:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         pauseReason:
 *                           type: string
 *                           nullable: true
 *                     tradingActivity:
 *                       type: object
 *                       properties:
 *                         dailyVolumeBNB:
 *                           type: number
 *                           example: 12.5
 *                         maxDailyVolumeBNB:
 *                           type: number
 *                           example: 50
 *                         remainingBNB:
 *                           type: number
 *                           example: 37.5
 *                         recentTrades:
 *                           type: integer
 *                           example: 8
 *                     performance:
 *                       type: object
 *                       properties:
 *                         last24h:
 *                           type: object
 *                           properties:
 *                             profitLossBNB:
 *                               type: number
 *                               example: 0.125
 *                             profitLossUSD:
 *                               type: number
 *                               example: 137.25
 *                             totalTrades:
 *                               type: integer
 *                               example: 8
 *                             successRate:
 *                               type: number
 *                               example: 87.5
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Internal server error
 * @route   GET /api/bot/portfolio/status
 * @desc    Get comprehensive portfolio status
 * @access  Public
 */
router.get('/portfolio/status', async (req, res) => {
    try {
        const [balances, prices, config, recentTrades, dailyVolume] = await Promise.all([
            tradeExecutor.getBalances(),
            priceOracle.getAllPrices(),
            BotConfig.getDefault(),
            Trade.getRecent(24, 10),
            Trade.getDailyVolume(new Date())
        ]);

        const totalValueUSD = (parseFloat(balances.bnb) * prices.bnbUsd.price) +
            (parseFloat(balances.mwt) * prices.mwtUsd.price);

        res.json({
            success: true,
            data: {
                balances: {
                    bnb: balances.bnb,
                    mwt: balances.mwt,
                    bnbUSD: parseFloat(balances.bnb) * prices.bnbUsd.price,
                    mwtUSD: parseFloat(balances.mwt) * prices.mwtUsd.price,
                    totalUSD: totalValueUSD
                },
                prices: {
                    mwtBnb: prices.mwtBnb.price,
                    mwtUsd: prices.mwtUsd.price,
                    mwtBtc: prices.mwtBtc.price
                },
                botStatus: {
                    enabled: config.enabled,
                    pausedAt: config.pausedAt,
                    pauseReason: config.pauseReason
                },
                statistics: config.statistics,
                dailyActivity: dailyVolume,
                recentTrades: recentTrades.slice(0, 5)
            },
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching portfolio status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// CONFIGURATION ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/bot/config:
 *   get:
 *     summary: Get bot configuration
 *     description: Retrieve current bot configuration including thresholds, limits, and settings
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Configuration retrieved successfully
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
 *                     botId:
 *                       type: string
 *                       example: default
 *                     enabled:
 *                       type: boolean
 *                       example: false
 *                     targetPeg:
 *                       type: object
 *                       properties:
 *                         usd:
 *                           type: number
 *                           example: 0.01
 *                     thresholds:
 *                       type: object
 *                       properties:
 *                         hold:
 *                           type: number
 *                           example: 0.5
 *                         tradeLow:
 *                           type: number
 *                           example: 2.0
 *                         tradeMedium:
 *                           type: number
 *                           example: 5.0
 *                     limits:
 *                       type: object
 *                       properties:
 *                         maxTradeBNB:
 *                           type: number
 *                           example: 1.0
 *                         maxDailyVolumeBNB:
 *                           type: number
 *                           example: 10.0
 *       500:
 *         description: Failed to fetch configuration
 */
router.get('/config', async (req, res) => {
    try {
        const config = await BotConfig.getDefault();

        res.json({
            success: true,
            data: config,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error fetching config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/config:
 *   put:
 *     summary: Update bot configuration
 *     description: Update bot trading parameters including thresholds, limits, slippage, strategy, and safety settings (requires admin authentication)
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               thresholds:
 *                 type: object
 *                 properties:
 *                   hold:
 *                     type: number
 *                     example: 0.5
 *                   tradeLow:
 *                     type: number
 *                     example: 2.0
 *                   tradeMedium:
 *                     type: number
 *                     example: 5.0
 *                   tradeHigh:
 *                     type: number
 *                     example: 10.0
 *                   tradeEmergency:
 *                     type: number
 *                     example: 15.0
 *               limits:
 *                 type: object
 *                 properties:
 *                   maxTradeBNB:
 *                     type: number
 *                     example: 5
 *                   maxDailyVolumeBNB:
 *                     type: number
 *                     example: 50
 *                   minBalanceBNB:
 *                     type: number
 *                     example: 0.01
 *               slippage:
 *                 type: object
 *                 properties:
 *                   low:
 *                     type: number
 *                     example: 1
 *                   medium:
 *                     type: number
 *                     example: 3
 *                   high:
 *                     type: number
 *                     example: 5
 *                   emergency:
 *                     type: number
 *                     example: 10
 *               strategy:
 *                 type: object
 *                 properties:
 *                   priceCheckInterval:
 *                     type: number
 *                     example: 60000
 *                     description: Milliseconds between price checks
 *                   minTimeBetweenTrades:
 *                     type: number
 *                     example: 300000
 *                     description: Cooldown period between trades (ms)
 *               safety:
 *                 type: object
 *                 properties:
 *                   maxConsecutiveErrors:
 *                     type: number
 *                     example: 3
 *                   autoPauseOnErrors:
 *                     type: boolean
 *                     example: true
 *                   circuitBreaker:
 *                     type: boolean
 *                     example: true
 *               modifiedBy:
 *                 type: string
 *                 example: "admin_user"
 *                 description: Who made the configuration change
 *     responses:
 *       200:
 *         description: Configuration updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/BotConfig'
 *                 message:
 *                   type: string
 *                   example: "Configuration updated successfully"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to update configuration
 * @route   PUT /api/bot/config
 * @desc    Update bot configuration
 * @access  Protected (requires admin)
 */
router.put('/config', async (req, res) => {
    try {
        const config = await BotConfig.getDefault();
        const { targetPeg, thresholds, limits, slippage, strategy, safety } = req.body;

        // Update fields
        if (targetPeg) Object.assign(config.targetPeg, targetPeg);
        if (thresholds) Object.assign(config.thresholds, thresholds);
        if (limits) Object.assign(config.limits, limits);
        if (slippage) Object.assign(config.slippage, slippage);
        if (strategy) Object.assign(config.strategy, strategy);
        if (safety) Object.assign(config.safety, safety);

        config.lastModifiedBy = req.body.modifiedBy || 'api';

        await config.save();

        logger.info('Bot configuration updated:', req.body);

        res.json({
            success: true,
            data: config,
            message: 'Configuration updated successfully',
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error updating config:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/config/enable:
 *   post:
 *     summary: Enable bot trading
 *     description: Activate the trading bot to allow autonomous trading operations (requires admin authentication)
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Manual enable after testing completed"
 *                 description: Reason for enabling the bot (for audit trail)
 *     responses:
 *       200:
 *         description: Bot enabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bot enabled successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BotConfig'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to enable bot
 * @route   POST /api/bot/config/enable
 * @desc    Enable bot trading
 * @access  Protected (requires admin)
 */
router.post('/config/enable', async (req, res) => {
    try {
        const config = await BotConfig.getDefault();
        const reason = req.body.reason || 'Manual enable via API';

        await config.enable(reason);

        logger.info('Bot enabled:', reason);

        res.json({
            success: true,
            message: 'Bot enabled successfully',
            data: config,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error enabling bot:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/config/disable:
 *   post:
 *     summary: Disable bot trading
 *     description: Deactivate the trading bot to stop all autonomous trading operations (requires admin authentication)
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Manual disable for maintenance"
 *                 description: Reason for disabling the bot (for audit trail)
 *     responses:
 *       200:
 *         description: Bot disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Bot disabled successfully"
 *                 data:
 *                   $ref: '#/components/schemas/BotConfig'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to disable bot
 * @route   POST /api/bot/config/disable
 * @desc    Disable bot trading
 * @access  Protected (requires admin)
 */
router.post('/config/disable', async (req, res) => {
    try {
        const config = await BotConfig.getDefault();
        const reason = req.body.reason || 'Manual disable via API';

        await config.disable(reason);

        logger.info('Bot disabled:', reason);

        res.json({
            success: true,
            message: 'Bot disabled successfully',
            data: config,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error disabling bot:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// SAFETY & HEALTH ENDPOINTS
// ============================================================================

/**
 * @swagger
 * /api/bot/safety/status:
 *   get:
 *     summary: Get safety check status
 *     description: Check all safety systems including bot status, balances, daily limits, and error tracking
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Safety status retrieved successfully
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
 *                     safe:
 *                       type: boolean
 *                       description: Overall safety status
 *                       example: true
 *                     checks:
 *                       type: object
 *                       properties:
 *                         botEnabled:
 *                           type: boolean
 *                           example: true
 *                         sufficientBalance:
 *                           type: object
 *                           properties:
 *                             bnb:
 *                               type: boolean
 *                               example: true
 *                             mwt:
 *                               type: boolean
 *                               example: true
 *                         dailyLimits:
 *                           type: object
 *                           properties:
 *                             volumeOk:
 *                               type: boolean
 *                               example: true
 *                             tradesOk:
 *                               type: boolean
 *                               example: true
 *                             volumeUsed:
 *                               type: number
 *                               example: 5.5
 *                             volumeLimit:
 *                               type: number
 *                               example: 10.0
 *       500:
 *         description: Failed to check safety status
 */
router.get('/safety/status', async (req, res) => {
    try {
        const [config, balances, prices, dailyVolume, recentTrades] = await Promise.all([
            BotConfig.getDefault(),
            tradeExecutor.getBalances(),
            priceOracle.getAllPrices(),
            Trade.getDailyVolume(new Date()),
            Trade.getRecent(1, 10)
        ]);

        const checks = {
            botEnabled: config.enabled,
            sufficientBalance: {
                bnb: parseFloat(balances.bnb) >= config.safety.requireMinBalance.bnb,
                mwt: parseFloat(balances.mwt) >= config.safety.requireMinBalance.mwt
            },
            dailyLimits: {
                volumeOk: dailyVolume.volumeBNB < config.limits.maxDailyVolumeBNB,
                tradesOk: dailyVolume.tradeCount < config.limits.maxDailyTrades,
                volumeUsed: dailyVolume.volumeBNB,
                volumeLimit: config.limits.maxDailyVolumeBNB,
                tradesUsed: dailyVolume.tradeCount,
                tradesLimit: config.limits.maxDailyTrades
            },
            liquidity: {
                sufficient: prices.liquidity.totalLiquidityUSD >= config.strategy.minLiquidityUSD,
                current: prices.liquidity.totalLiquidityUSD,
                minimum: config.strategy.minLiquidityUSD
            },
            consecutiveErrors: {
                ok: config.statistics.consecutiveErrors < config.safety.maxConsecutiveErrors,
                current: config.statistics.consecutiveErrors,
                maximum: config.safety.maxConsecutiveErrors
            },
            circuitBreaker: {
                enabled: config.safety.enableCircuitBreaker,
                triggered: false // Implement based on deviation thresholds
            }
        };

        const allChecksPass = checks.botEnabled &&
            checks.sufficientBalance.bnb &&
            checks.sufficientBalance.mwt &&
            checks.dailyLimits.volumeOk &&
            checks.dailyLimits.tradesOk &&
            checks.liquidity.sufficient &&
            checks.consecutiveErrors.ok;

        res.json({
            success: true,
            data: {
                safe: allChecksPass,
                checks,
                recentErrors: recentTrades.filter(t => t.status === 'FAILED').slice(0, 3)
            },
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error checking safety status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * @swagger
 * /api/bot/health:
 *   get:
 *     summary: Health check
 *     description: Check the health status of bot services (price oracle, trade executor, database)
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: All services healthy
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
 *                     status:
 *                       type: string
 *                       enum: [healthy, unhealthy]
 *                       example: healthy
 *                     services:
 *                       type: object
 *                       properties:
 *                         priceOracle:
 *                           type: boolean
 *                           example: true
 *                         tradeExecutor:
 *                           type: boolean
 *                           example: true
 *                         database:
 *                           type: boolean
 *                           example: true
 *       503:
 *         description: Service unavailable - one or more services unhealthy
 */
router.get('/health', async (req, res) => {
    try {
        const [pricesCheck, balancesCheck, configCheck] = await Promise.all([
            priceOracle.getAllPrices().then(() => true).catch(() => false),
            tradeExecutor.getBalances().then(() => true).catch(() => false),
            BotConfig.getDefault().then(() => true).catch(() => false)
        ]);

        const healthy = pricesCheck && balancesCheck && configCheck;

        res.status(healthy ? 200 : 503).json({
            success: healthy,
            data: {
                status: healthy ? 'healthy' : 'unhealthy',
                services: {
                    priceOracle: pricesCheck,
                    tradeExecutor: balancesCheck,
                    database: configCheck
                }
            },
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

/**
 * @swagger
 * /api/bot/emergency/pause:
 *   post:
 *     summary: Emergency pause trading
 *     description: Immediately halt all bot trading operations in emergency situations (requires admin authentication)
 *     tags: [Bot]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 example: "Abnormal price activity detected"
 *                 description: Reason for emergency pause (for audit trail)
 *     responses:
 *       200:
 *         description: Emergency pause activated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Emergency pause activated"
 *                 data:
 *                   $ref: '#/components/schemas/BotConfig'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to activate emergency pause
 * @route   POST /api/bot/emergency/pause
 * @desc    Emergency pause trading
 * @access  Protected (requires admin)
 */
router.post('/emergency/pause', async (req, res) => {
    try {
        const config = await BotConfig.getDefault();
        const reason = req.body.reason || 'EMERGENCY PAUSE';

        await config.disable(reason);

        logger.warn('EMERGENCY PAUSE ACTIVATED:', reason);

        res.json({
            success: true,
            message: 'Emergency pause activated',
            data: config,
            timestamp: new Date()
        });

    } catch (error) {
        logger.error('Error activating emergency pause:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
