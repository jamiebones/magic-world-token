const { Order, OrderFill, Withdrawal } = require('../models');
const logger = require('../utils/logger');

class OrderBookService {
    /**
     * Get active orders with optional filtering
     */
    async getActiveOrders(orderType = null, limit = 50, offset = 0) {
        try {
            const query = { status: { $in: [0, 2] } }; // Active (0) and Partially Filled (2)

            if (orderType !== null && (orderType === 0 || orderType === 1)) {
                query.orderType = orderType;
            }

            const orders = await Order.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset);

            const total = await Order.countDocuments(query);

            return {
                success: true,
                orders,
                total,
                limit,
                offset
            };
        } catch (error) {
            logger.error('[OrderBookService] Error getting active orders:', error);
            throw error;
        }
    }

    /**
     * Get order details by ID with fill history
     */
    async getOrderDetails(orderId) {
        try {
            const order = await Order.findOne({ orderId });

            if (!order) {
                return {
                    success: false,
                    error: 'Order not found'
                };
            }

            // Get fill history for this order
            const fills = await OrderFill.getFillsByOrderId(orderId);

            return {
                success: true,
                order,
                fills
            };
        } catch (error) {
            logger.error(`[OrderBookService] Error getting order #${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Get user's orders with optional status filter
     */
    async getUserOrders(userAddress, status = null, limit = 50, offset = 0) {
        try {
            const query = { user: userAddress.toLowerCase() };

            if (status !== null) {
                query.status = status;
            }

            const orders = await Order.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset);

            const total = await Order.countDocuments(query);

            return {
                success: true,
                orders,
                total,
                limit,
                offset
            };
        } catch (error) {
            logger.error(`[OrderBookService] Error getting orders for ${userAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get fills for a specific order
     */
    async getOrderFills(orderId) {
        try {
            const fills = await OrderFill.getFillsByOrderId(orderId);

            return {
                success: true,
                fills,
                count: fills.length
            };
        } catch (error) {
            logger.error(`[OrderBookService] Error getting fills for order #${orderId}:`, error);
            throw error;
        }
    }

    /**
     * Get recent activity (all event types)
     */
    async getRecentActivity(limit = 20) {
        try {
            // Get recent orders
            const recentOrders = await Order.find({})
                .sort({ createdAt: -1 })
                .limit(limit)
                .select('orderId user orderType mwgAmount bnbAmount pricePerMWG status createdAt txHash');

            // Get recent fills
            const recentFills = await OrderFill.find({})
                .sort({ timestamp: -1 })
                .limit(limit)
                .select('orderId filler orderCreator mwgAmount bnbAmount timestamp txHash');

            // Get recent withdrawals
            const recentWithdrawals = await Withdrawal.find({})
                .sort({ timestamp: -1 })
                .limit(limit)
                .select('user amount amountType timestamp txHash');

            // Combine and format activities
            const activities = [];

            recentOrders.forEach(order => {
                activities.push({
                    type: 'created',
                    timestamp: order.createdAt,
                    data: {
                        orderId: order.orderId,
                        user: order.user,
                        orderType: order.orderType,
                        mwgAmount: order.mwgAmount,
                        bnbAmount: order.bnbAmount,
                        pricePerMWG: order.pricePerMWG,
                        status: order.status,
                        txHash: order.txHash
                    }
                });
            });

            recentFills.forEach(fill => {
                activities.push({
                    type: 'filled',
                    timestamp: fill.timestamp,
                    data: {
                        orderId: fill.orderId,
                        filler: fill.filler,
                        orderCreator: fill.orderCreator,
                        mwgAmount: fill.mwgAmount,
                        bnbAmount: fill.bnbAmount,
                        txHash: fill.txHash
                    }
                });
            });

            recentWithdrawals.forEach(withdrawal => {
                activities.push({
                    type: 'withdrawal',
                    timestamp: withdrawal.timestamp,
                    data: {
                        user: withdrawal.user,
                        amount: withdrawal.amount,
                        amountType: withdrawal.amountType,
                        txHash: withdrawal.txHash
                    }
                });
            });

            // Sort by timestamp descending
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Return only the requested limit
            return {
                success: true,
                activities: activities.slice(0, limit)
            };
        } catch (error) {
            logger.error('[OrderBookService] Error getting recent activity:', error);
            throw error;
        }
    }

    /**
     * Get order book statistics
     */
    async getOrderBookStats() {
        try {
            // Get order statistics
            const orderStats = await Order.getOrderStats();

            // Get fill statistics
            const fillStats = await OrderFill.getFillStats();

            // Get active orders count by type
            const activeBuyOrders = await Order.countDocuments({ orderType: 0, status: 0 });
            const activeSellOrders = await Order.countDocuments({ orderType: 1, status: 0 });

            // Get best prices
            const bestBuy = await Order.getBestBuyPrice();
            const bestSell = await Order.getBestSellPrice();

            // Calculate spread if both prices exist
            let spread = null;
            if (bestBuy && bestSell) {
                const buyPrice = parseFloat(bestBuy.pricePerMWG);
                const sellPrice = parseFloat(bestSell.pricePerMWG);
                spread = ((sellPrice - buyPrice) / buyPrice) * 100;
            }

            return {
                success: true,
                stats: {
                    orders: {
                        total: orderStats.reduce((sum, stat) => sum + stat.count, 0),
                        active: orderStats.find(s => s._id === 0)?.count || 0,
                        filled: orderStats.find(s => s._id === 1)?.count || 0,
                        cancelled: orderStats.find(s => s._id === 2)?.count || 0,
                        expired: orderStats.find(s => s._id === 3)?.count || 0,
                        activeBuy: activeBuyOrders,
                        activeSell: activeSellOrders
                    },
                    fills: {
                        total: fillStats.totalFills || 0,
                        mwgVolume: fillStats.totalMWGVolume || 0,
                        bnbVolume: fillStats.totalBNBVolume || 0,
                        avgPrice: fillStats.avgPrice || 0
                    },
                    prices: {
                        bestBuy: bestBuy?.pricePerMWG || null,
                        bestSell: bestSell?.pricePerMWG || null,
                        spread: spread
                    }
                }
            };
        } catch (error) {
            logger.error('[OrderBookService] Error getting stats:', error);
            throw error;
        }
    }

    /**
     * Get best buy and sell prices
     */
    async getBestPrices() {
        try {
            const bestBuy = await Order.getBestBuyPrice();
            const bestSell = await Order.getBestSellPrice();

            return {
                success: true,
                bestBuy: bestBuy ? {
                    orderId: bestBuy.orderId,
                    price: bestBuy.pricePerMWG,
                    remaining: bestBuy.remaining
                } : null,
                bestSell: bestSell ? {
                    orderId: bestSell.orderId,
                    price: bestSell.pricePerMWG,
                    remaining: bestSell.remaining
                } : null
            };
        } catch (error) {
            logger.error('[OrderBookService] Error getting best prices:', error);
            throw error;
        }
    }

    /**
     * Get fills by filler (user who filled orders)
     */
    async getFillsByFiller(fillerAddress, limit = 50, offset = 0) {
        try {
            const fills = await OrderFill.getFillsByFiller(fillerAddress, limit, offset);
            const total = await OrderFill.countDocuments({ filler: fillerAddress.toLowerCase() });

            return {
                success: true,
                fills,
                total,
                limit,
                offset
            };
        } catch (error) {
            logger.error(`[OrderBookService] Error getting fills for filler ${fillerAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get fills where user's orders were filled
     */
    async getFillsByOrderCreator(creatorAddress, limit = 50, offset = 0) {
        try {
            const fills = await OrderFill.getFillsByOrderCreator(creatorAddress, limit, offset);
            const total = await OrderFill.countDocuments({ orderCreator: creatorAddress.toLowerCase() });

            return {
                success: true,
                fills,
                total,
                limit,
                offset
            };
        } catch (error) {
            logger.error(`[OrderBookService] Error getting fills for creator ${creatorAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get recent fills across platform
     */
    async getRecentFills(limit = 20, offset = 0) {
        try {
            const fills = await OrderFill.getRecentFills(limit, offset);
            const total = await OrderFill.countDocuments({});

            return {
                success: true,
                fills,
                total,
                limit,
                offset
            };
        } catch (error) {
            logger.error('[OrderBookService] Error getting recent fills:', error);
            throw error;
        }
    }

    /**
     * Get user withdrawals
     */
    async getUserWithdrawals(userAddress, amountType = null, limit = 50, offset = 0) {
        try {
            const withdrawals = await Withdrawal.getUserWithdrawals(userAddress, amountType, limit, offset);

            const query = { user: userAddress.toLowerCase() };
            if (amountType) query.amountType = amountType;
            const total = await Withdrawal.countDocuments(query);

            return {
                success: true,
                withdrawals,
                total,
                limit,
                offset
            };
        } catch (error) {
            logger.error(`[OrderBookService] Error getting withdrawals for ${userAddress}:`, error);
            throw error;
        }
    }

    /**
     * Get analytics data for admin dashboard
     */
    async getAnalytics(startDate = null, endDate = null) {
        try {
            // Get fill statistics for date range
            const fillStats = await OrderFill.getFillStats(startDate, endDate);

            // Get volume by order type
            const volumeByType = await OrderFill.getVolumeByType(startDate, endDate);

            // Get withdrawal statistics
            const withdrawalStats = await Withdrawal.getWithdrawalStats(startDate, endDate);

            // Get order counts by status
            const orderStats = await Order.getOrderStats();

            // Get unique users count
            const uniqueCreators = await Order.distinct('user');
            const uniqueFillers = await OrderFill.distinct('filler');
            const allUsers = new Set([...uniqueCreators, ...uniqueFillers]);

            return {
                success: true,
                analytics: {
                    fills: fillStats,
                    volumeByType,
                    withdrawals: withdrawalStats,
                    orders: orderStats,
                    uniqueUsers: allUsers.size
                }
            };
        } catch (error) {
            logger.error('[OrderBookService] Error getting analytics:', error);
            throw error;
        }
    }

    /**
     * Search orders by criteria
     */
    async searchOrders(criteria) {
        try {
            const {
                orderType,
                status,
                user,
                minPrice,
                maxPrice,
                minAmount,
                maxAmount,
                startDate,
                endDate,
                limit = 50,
                offset = 0
            } = criteria;

            const query = {};

            if (orderType !== undefined && orderType !== null) query.orderType = orderType;
            if (status !== undefined && status !== null) query.status = status;
            if (user) query.user = user.toLowerCase();
            if (minPrice || maxPrice) {
                query.pricePerMWG = {};
                if (minPrice) query.pricePerMWG.$gte = minPrice;
                if (maxPrice) query.pricePerMWG.$lte = maxPrice;
            }
            if (minAmount || maxAmount) {
                query.mwgAmount = {};
                if (minAmount) query.mwgAmount.$gte = minAmount;
                if (maxAmount) query.mwgAmount.$lte = maxAmount;
            }
            if (startDate || endDate) {
                query.createdAt = {};
                if (startDate) query.createdAt.$gte = new Date(startDate);
                if (endDate) query.createdAt.$lte = new Date(endDate);
            }

            const orders = await Order.find(query)
                .sort({ createdAt: -1 })
                .limit(limit)
                .skip(offset);

            const total = await Order.countDocuments(query);

            return {
                success: true,
                orders,
                total,
                limit,
                offset
            };
        } catch (error) {
            logger.error('[OrderBookService] Error searching orders:', error);
            throw error;
        }
    }

    /**
     * Update order email for notifications
     */
    async updateOrderEmail(orderId, email, walletAddress) {
        try {
            const order = await Order.findOne({ orderId });

            if (!order) {
                return {
                    success: false,
                    error: 'Order not found'
                };
            }

            // Verify the wallet address matches the order creator
            if (order.user.toLowerCase() !== walletAddress.toLowerCase()) {
                return {
                    success: false,
                    error: 'Not authorized - only order creator can update email'
                };
            }

            // Update email
            order.email = email;
            order.lastUpdated = Date.now();
            await order.save();

            logger.info(`[OrderBookService] Email updated for Order #${orderId}`);

            return {
                success: true,
                message: email ? 'Email notification enabled' : 'Email notification disabled',
                order: {
                    orderId: order.orderId,
                    email: order.email,
                    emailEnabled: !!order.email
                }
            };
        } catch (error) {
            logger.error(`[OrderBookService] Error updating email for Order #${orderId}:`, error);
            throw error;
        }
    }
}

const orderBookService = new OrderBookService();
module.exports = orderBookService;