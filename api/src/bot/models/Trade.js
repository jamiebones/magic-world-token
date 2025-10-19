const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
    // Trade identification
    tradeId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Transaction details
    txHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    blockNumber: {
        type: Number,
        required: true
    },

    // Trade action
    action: {
        type: String,
        enum: ['BUY', 'SELL'],
        required: true,
        index: true
    },

    // Trade amounts
    inputAmount: {
        type: String, // Store as string to preserve precision
        required: true
    },

    inputToken: {
        type: String,
        enum: ['BNB', 'MWT'],
        required: true
    },

    outputAmount: {
        type: String, // Actual received amount (after execution)
        default: null
    },

    outputToken: {
        type: String,
        enum: ['BNB', 'MWT'],
        required: true
    },

    minOutputAmount: {
        type: String, // Minimum expected with slippage
        required: true
    },

    // Price information
    executionPrice: {
        type: String, // Price at execution (BNB per MWT)
        default: null
    },

    marketPriceAtExecution: {
        type: String, // Market price when trade was executed
        default: null
    },

    priceImpact: {
        type: Number, // Price impact percentage
        default: null
    },

    // Trade configuration
    slippage: {
        type: Number, // Slippage tolerance used
        required: true
    },

    urgency: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'EMERGENCY'],
        default: 'MEDIUM'
    },

    // Gas details
    gasUsed: {
        type: String,
        default: null
    },

    gasPrice: {
        type: String,
        default: null
    },

    gasCostBNB: {
        type: String, // Gas cost in BNB
        default: null
    },

    gasCostUSD: {
        type: Number, // Gas cost in USD (for analytics)
        default: null
    },

    // Swap path
    path: [{
        type: String // Array of token addresses in swap path
    }],

    // Trade status
    status: {
        type: String,
        enum: ['PENDING', 'SUCCESS', 'FAILED', 'REVERTED'],
        default: 'PENDING',
        index: true
    },

    // Error information (if failed)
    error: {
        type: String,
        default: null
    },

    errorCode: {
        type: String,
        default: null
    },

    // Profit/Loss calculation
    profitLoss: {
        type: Number, // Net profit/loss in USD
        default: null
    },

    profitLossPercentage: {
        type: Number, // Profit/loss as percentage
        default: null
    },

    // Bot information
    botId: {
        type: String,
        index: true,
        default: 'default'
    },

    botStrategy: {
        type: String,
        default: 'peg-maintenance'
    },

    // Execution context
    pegDeviation: {
        type: Number, // Peg deviation at time of trade (%)
        default: null
    },

    liquidity: {
        totalUSD: Number,
        mwtReserve: String,
        bnbReserve: String
    },

    // Timestamps
    initiatedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    executedAt: {
        type: Date,
        default: null
    },

    confirmedAt: {
        type: Date,
        default: null
    },

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true, // Adds createdAt and updatedAt
    collection: 'trades'
});

// Indexes for efficient queries
tradeSchema.index({ action: 1, status: 1 });
tradeSchema.index({ initiatedAt: -1 });
tradeSchema.index({ botId: 1, initiatedAt: -1 });
tradeSchema.index({ status: 1, initiatedAt: -1 });

// Virtual for trade duration
tradeSchema.virtual('duration').get(function () {
    if (this.executedAt && this.initiatedAt) {
        return this.executedAt - this.initiatedAt;
    }
    return null;
});

// Static methods
tradeSchema.statics = {
    /**
     * Get trades by status
     */
    async getByStatus(status, limit = 50) {
        return this.find({ status })
            .sort({ initiatedAt: -1 })
            .limit(limit);
    },

    /**
     * Get recent trades
     */
    async getRecent(hours = 24, limit = 100) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.find({ initiatedAt: { $gte: since } })
            .sort({ initiatedAt: -1 })
            .limit(limit);
    },

    /**
     * Get trades by bot
     */
    async getByBot(botId, limit = 50) {
        return this.find({ botId })
            .sort({ initiatedAt: -1 })
            .limit(limit);
    },

    /**
     * Get trade statistics
     */
    async getStatistics(startDate, endDate) {
        const query = {};
        if (startDate) query.initiatedAt = { $gte: startDate };
        if (endDate) query.initiatedAt = { ...query.initiatedAt, $lte: endDate };

        const trades = await this.find(query);

        return {
            total: trades.length,
            successful: trades.filter(t => t.status === 'SUCCESS').length,
            failed: trades.filter(t => t.status === 'FAILED').length,
            pending: trades.filter(t => t.status === 'PENDING').length,
            totalVolumeBNB: trades
                .filter(t => t.status === 'SUCCESS' && t.inputToken === 'BNB')
                .reduce((sum, t) => sum + parseFloat(t.inputAmount), 0),
            totalVolumeMWT: trades
                .filter(t => t.status === 'SUCCESS' && t.inputToken === 'MWT')
                .reduce((sum, t) => sum + parseFloat(t.inputAmount), 0),
            totalGasCostBNB: trades
                .filter(t => t.gasCostBNB)
                .reduce((sum, t) => sum + parseFloat(t.gasCostBNB), 0),
            totalProfitLoss: trades
                .filter(t => t.profitLoss !== null)
                .reduce((sum, t) => sum + t.profitLoss, 0),
            buyCount: trades.filter(t => t.action === 'BUY').length,
            sellCount: trades.filter(t => t.action === 'SELL').length
        };
    },

    /**
     * Calculate daily volume
     */
    async getDailyVolume(date = new Date()) {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const trades = await this.find({
            status: 'SUCCESS',
            initiatedAt: { $gte: startOfDay, $lte: endOfDay }
        });

        return {
            date: startOfDay,
            tradeCount: trades.length,
            volumeBNB: trades
                .filter(t => t.inputToken === 'BNB')
                .reduce((sum, t) => sum + parseFloat(t.inputAmount), 0),
            volumeMWT: trades
                .filter(t => t.inputToken === 'MWT')
                .reduce((sum, t) => sum + parseFloat(t.inputAmount), 0),
            gasCost: trades
                .filter(t => t.gasCostBNB)
                .reduce((sum, t) => sum + parseFloat(t.gasCostBNB), 0)
        };
    }
};

// Instance methods
tradeSchema.methods = {
    /**
     * Mark trade as successful
     */
    async markSuccess(executionData) {
        this.status = 'SUCCESS';
        this.executedAt = new Date();
        this.confirmedAt = new Date();

        if (executionData.outputAmount) this.outputAmount = executionData.outputAmount;
        if (executionData.executionPrice) this.executionPrice = executionData.executionPrice;
        if (executionData.gasUsed) this.gasUsed = executionData.gasUsed;
        if (executionData.gasPrice) this.gasPrice = executionData.gasPrice;
        if (executionData.gasCostBNB) this.gasCostBNB = executionData.gasCostBNB;
        if (executionData.priceImpact) this.priceImpact = executionData.priceImpact;

        await this.save();
        return this;
    },

    /**
     * Mark trade as failed
     */
    async markFailed(error, errorCode = null) {
        this.status = 'FAILED';
        this.executedAt = new Date();
        this.error = error;
        this.errorCode = errorCode;

        await this.save();
        return this;
    },

    /**
     * Calculate profit/loss
     */
    calculateProfitLoss(marketPrice, bnbUsdPrice) {
        if (this.status !== 'SUCCESS' || !this.outputAmount) return null;

        // Simple P&L calculation based on execution vs market price
        const inputValue = parseFloat(this.inputAmount);
        const outputValue = parseFloat(this.outputAmount);
        const gasCost = this.gasCostBNB ? parseFloat(this.gasCostBNB) : 0;

        // Calculate in USD
        if (this.action === 'BUY') {
            const costUSD = (inputValue + gasCost) * bnbUsdPrice;
            const valueUSD = outputValue * marketPrice * bnbUsdPrice;
            this.profitLoss = valueUSD - costUSD;
        } else { // SELL
            const costUSD = (inputValue * marketPrice * bnbUsdPrice) + (gasCost * bnbUsdPrice);
            const valueUSD = outputValue * bnbUsdPrice;
            this.profitLoss = valueUSD - costUSD;
        }

        this.profitLossPercentage = (this.profitLoss / (parseFloat(this.inputAmount) * bnbUsdPrice)) * 100;

        return this.profitLoss;
    }
};

// Pre-save middleware
tradeSchema.pre('save', function (next) {
    // Generate tradeId if not exists
    if (!this.tradeId) {
        this.tradeId = `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    next();
});

const Trade = mongoose.model('Trade', tradeSchema);

module.exports = Trade;
