const mongoose = require('mongoose');

const priceHistorySchema = new mongoose.Schema({
    // Price data sources
    mwtBnbPrice: {
        type: String, // MWT price in BNB (from PancakeSwap)
        required: true
    },

    bnbUsdPrice: {
        type: Number, // BNB price in USD (from Chainlink)
        required: true
    },

    btcUsdPrice: {
        type: Number, // BTC price in USD (from Chainlink)
        required: true
    },

    // Derived prices
    mwtUsdPrice: {
        type: Number, // Calculated: MWT/BNB × BNB/USD
        required: true,
        index: true
    },

    mwtBtcPrice: {
        type: Number, // MWT price in BTC
        required: true
    },

    mwtSatoshis: {
        type: Number, // MWT price in satoshis
        required: true
    },

    bnbBtcPrice: {
        type: Number, // BNB price in BTC
        default: null
    },

    // Peg deviation
    targetPegUSD: {
        type: Number,
        default: 0.01 // Default $0.01
    },

    deviationUSD: {
        type: Number, // Deviation in USD
        required: true
    },

    deviationPercentUSD: {
        type: Number, // Deviation percentage in USD
        required: true,
        index: true
    },

    deviationBTC: {
        type: Number, // Deviation in BTC
        default: null
    },

    deviationPercentBTC: {
        type: Number, // Deviation percentage in BTC
        default: null
    },

    // Liquidity information
    liquidity: {
        mwtReserve: {
            type: String,
            required: true
        },
        bnbReserve: {
            type: String,
            required: true
        },
        totalUSD: {
            type: Number,
            required: true
        },
        totalBTC: {
            type: Number,
            default: null
        }
    },

    // Market data
    marketCap: {
        usd: Number,
        btc: Number
    },

    volume24h: {
        usd: Number,
        bnb: Number,
        mwt: Number
    },

    // Blockchain data
    blockNumber: {
        type: Number,
        required: true
    },

    blockTimestamp: {
        type: Date,
        required: true
    },

    // Data sources metadata
    sources: {
        pancakeSwap: {
            lastUpdate: Date,
            pairAddress: String
        },
        chainlinkBnbUsd: {
            lastUpdate: Date,
            roundId: String,
            feedAddress: String
        },
        chainlinkBtcUsd: {
            lastUpdate: Date,
            roundId: String,
            feedAddress: String
        }
    },

    // Price validation
    isValid: {
        type: Boolean,
        default: true
    },

    validationWarnings: [{
        type: String
    }],

    // Metadata
    recordedAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    dataQuality: {
        type: String,
        enum: ['HIGH', 'MEDIUM', 'LOW'],
        default: 'HIGH'
    }
}, {
    timestamps: true,
    collection: 'price_history'
});

// Indexes for efficient time-series queries
priceHistorySchema.index({ recordedAt: -1 });
priceHistorySchema.index({ recordedAt: -1, mwtUsdPrice: 1 });
priceHistorySchema.index({ recordedAt: -1, deviationPercentUSD: 1 });
priceHistorySchema.index({ blockNumber: -1 });

// Virtual for age of record
priceHistorySchema.virtual('age').get(function () {
    return Date.now() - this.recordedAt.getTime();
});

// Static methods
priceHistorySchema.statics = {
    /**
     * Get latest price record
     */
    async getLatest() {
        return this.findOne()
            .sort({ recordedAt: -1 });
    },

    /**
     * Get price history for a time range
     */
    async getHistory(startDate, endDate, limit = 1000) {
        const query = {
            recordedAt: {}
        };

        if (startDate) query.recordedAt.$gte = startDate;
        if (endDate) query.recordedAt.$lte = endDate;

        return this.find(query)
            .sort({ recordedAt: -1 })
            .limit(limit);
    },

    /**
     * Get recent price history (hours)
     */
    async getRecent(hours = 24, limit = 1000) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.find({ recordedAt: { $gte: since } })
            .sort({ recordedAt: -1 })
            .limit(limit);
    },

    /**
     * Get price at specific time (closest match)
     */
    async getPriceAt(targetDate) {
        // Find closest record before the target date
        const before = await this.findOne({
            recordedAt: { $lte: targetDate }
        }).sort({ recordedAt: -1 });

        // Find closest record after the target date
        const after = await this.findOne({
            recordedAt: { $gte: targetDate }
        }).sort({ recordedAt: 1 });

        if (!before) return after;
        if (!after) return before;

        // Return the closest one
        const beforeDiff = Math.abs(targetDate - before.recordedAt);
        const afterDiff = Math.abs(targetDate - after.recordedAt);

        return beforeDiff < afterDiff ? before : after;
    },

    /**
     * Calculate price statistics for a period
     */
    async getStatistics(startDate, endDate) {
        const prices = await this.getHistory(startDate, endDate);

        if (prices.length === 0) return null;

        const mwtUsdPrices = prices.map(p => p.mwtUsdPrice);
        const deviations = prices.map(p => p.deviationPercentUSD);

        return {
            count: prices.length,
            period: {
                start: prices[prices.length - 1].recordedAt,
                end: prices[0].recordedAt
            },
            mwtUsd: {
                current: prices[0].mwtUsdPrice,
                min: Math.min(...mwtUsdPrices),
                max: Math.max(...mwtUsdPrices),
                avg: mwtUsdPrices.reduce((a, b) => a + b, 0) / mwtUsdPrices.length,
                median: this._median(mwtUsdPrices)
            },
            deviation: {
                current: prices[0].deviationPercentUSD,
                min: Math.min(...deviations),
                max: Math.max(...deviations),
                avg: deviations.reduce((a, b) => a + b, 0) / deviations.length,
                median: this._median(deviations)
            },
            liquidity: {
                current: prices[0].liquidity.totalUSD,
                min: Math.min(...prices.map(p => p.liquidity.totalUSD)),
                max: Math.max(...prices.map(p => p.liquidity.totalUSD)),
                avg: prices.reduce((sum, p) => sum + p.liquidity.totalUSD, 0) / prices.length
            }
        };
    },

    /**
     * Get price trend (increasing, decreasing, stable)
     */
    async getTrend(hours = 1) {
        const prices = await this.getRecent(hours, 100);

        if (prices.length < 2) return 'UNKNOWN';

        const recentPrice = prices[0].mwtUsdPrice;
        const olderPrice = prices[prices.length - 1].mwtUsdPrice;

        const change = ((recentPrice - olderPrice) / olderPrice) * 100;

        if (change > 1) return 'INCREASING';
        if (change < -1) return 'DECREASING';
        return 'STABLE';
    },

    /**
     * Detect price anomalies
     */
    async detectAnomalies(hours = 24, threshold = 10) {
        const prices = await this.getRecent(hours);
        const anomalies = [];

        for (let i = 1; i < prices.length; i++) {
            const current = prices[i - 1];
            const previous = prices[i];

            const priceChange = Math.abs(
                ((current.mwtUsdPrice - previous.mwtUsdPrice) / previous.mwtUsdPrice) * 100
            );

            if (priceChange > threshold) {
                anomalies.push({
                    timestamp: current.recordedAt,
                    priceChange,
                    from: previous.mwtUsdPrice,
                    to: current.mwtUsdPrice,
                    type: current.mwtUsdPrice > previous.mwtUsdPrice ? 'SPIKE' : 'DROP'
                });
            }
        }

        return anomalies;
    },

    /**
     * Helper: Calculate median
     */
    _median(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    },

    /**
     * Clean old records (keep only last N days)
     */
    async cleanOldRecords(daysToKeep = 90) {
        const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
        const result = await this.deleteMany({ recordedAt: { $lt: cutoffDate } });
        return result.deletedCount;
    },

    /**
     * Get average price for a period (useful for TWAP)
     */
    async getAveragePrice(startDate, endDate) {
        const prices = await this.getHistory(startDate, endDate);

        if (prices.length === 0) return null;

        const totalPrice = prices.reduce((sum, p) => sum + p.mwtUsdPrice, 0);
        return totalPrice / prices.length;
    }
};

// Instance methods
priceHistorySchema.methods = {
    /**
     * Check if price is within acceptable range
     */
    isWithinRange(minPrice, maxPrice) {
        return this.mwtUsdPrice >= minPrice && this.mwtUsdPrice <= maxPrice;
    },

    /**
     * Get formatted price data
     */
    getFormatted() {
        return {
            mwtBnb: parseFloat(this.mwtBnbPrice),
            mwtUsd: this.mwtUsdPrice,
            mwtBtc: this.mwtBtcPrice,
            satoshis: this.mwtSatoshis,
            bnbUsd: this.bnbUsdPrice,
            btcUsd: this.btcUsdPrice,
            deviation: {
                usd: this.deviationPercentUSD,
                btc: this.deviationPercentBTC
            },
            liquidity: this.liquidity.totalUSD,
            timestamp: this.recordedAt
        };
    },

    /**
     * Compare with another price record
     */
    compareWith(otherRecord) {
        return {
            timeDiff: this.recordedAt - otherRecord.recordedAt,
            priceChange: this.mwtUsdPrice - otherRecord.mwtUsdPrice,
            priceChangePercent: ((this.mwtUsdPrice - otherRecord.mwtUsdPrice) / otherRecord.mwtUsdPrice) * 100,
            deviationChange: this.deviationPercentUSD - otherRecord.deviationPercentUSD,
            liquidityChange: this.liquidity.totalUSD - otherRecord.liquidity.totalUSD
        };
    }
};

// Pre-save middleware
priceHistorySchema.pre('save', function (next) {
    // Ensure all required derived prices are calculated
    if (!this.mwtUsdPrice && this.mwtBnbPrice && this.bnbUsdPrice) {
        this.mwtUsdPrice = parseFloat(this.mwtBnbPrice) * this.bnbUsdPrice;
    }

    if (!this.mwtBtcPrice && this.mwtUsdPrice && this.btcUsdPrice) {
        this.mwtBtcPrice = this.mwtUsdPrice / this.btcUsdPrice;
    }

    if (!this.mwtSatoshis && this.mwtBtcPrice) {
        this.mwtSatoshis = this.mwtBtcPrice * 100000000;
    }

    // Calculate deviations if not set
    if (this.deviationPercentUSD === undefined && this.mwtUsdPrice && this.targetPegUSD) {
        this.deviationUSD = this.mwtUsdPrice - this.targetPegUSD;
        this.deviationPercentUSD = (this.deviationUSD / this.targetPegUSD) * 100;
    }

    next();
});

const PriceHistory = mongoose.model('PriceHistory', priceHistorySchema);

module.exports = PriceHistory;
