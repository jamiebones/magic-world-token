const mongoose = require('mongoose');

const botConfigSchema = new mongoose.Schema({
    // Bot identification
    botId: {
        type: String,
        required: true,
        unique: true,
        index: true,
        default: 'default'
    },

    botName: {
        type: String,
        default: 'Magic World Token Bot'
    },

    botVersion: {
        type: String,
        default: '1.0.0'
    },

    // Bot status
    enabled: {
        type: Boolean,
        default: false,
        index: true
    },

    pausedAt: {
        type: Date,
        default: null
    },

    pauseReason: {
        type: String,
        default: null
    },

    // Target peg configuration
    targetPeg: {
        usd: {
            type: Number,
            required: true,
            default: 0.01 // $0.01
        },
        btc: {
            type: Number,
            default: null // Calculated dynamically
        }
    },

    // Trading thresholds (peg deviation %)
    thresholds: {
        hold: {
            type: Number,
            default: 0.5, // ±0.5% - don't trade
            min: 0,
            max: 10
        },
        tradeLow: {
            type: Number,
            default: 2.0, // ±2% - small trades
            min: 0,
            max: 10
        },
        tradeMedium: {
            type: Number,
            default: 5.0, // ±5% - medium trades
            min: 0,
            max: 20
        },
        tradeHigh: {
            type: Number,
            default: 10.0, // ±10% - large trades
            min: 0,
            max: 50
        },
        emergency: {
            type: Number,
            default: 15.0, // ±15% - pause trading (circuit breaker)
            min: 0,
            max: 100
        }
    },

    // Trade limits
    limits: {
        maxTradeBNB: {
            type: Number,
            default: 1.0, // Max 1 BNB per trade
            min: 0.001,
            max: 100
        },
        maxTradeMWT: {
            type: Number,
            default: 100.0, // Max 100 MWT per trade
            min: 1,
            max: 1000000
        },
        maxDailyVolumeBNB: {
            type: Number,
            default: 10.0, // Max 10 BNB daily
            min: 0.01,
            max: 1000
        },
        maxDailyTrades: {
            type: Number,
            default: 100, // Max 100 trades per day
            min: 1,
            max: 10000
        },
        minTimeBetweenTrades: {
            type: Number,
            default: 60, // Minimum 60 seconds between trades
            min: 0,
            max: 3600
        }
    },

    // Trade size calculation (based on deviation)
    tradeSizing: {
        strategy: {
            type: String,
            enum: ['FIXED', 'PROPORTIONAL', 'DYNAMIC'],
            default: 'PROPORTIONAL'
        },
        fixedAmount: {
            type: Number,
            default: 0.1 // 0.1 BNB for FIXED strategy
        },
        proportionalMultiplier: {
            type: Number,
            default: 0.02, // 2% of deviation for PROPORTIONAL
            min: 0.001,
            max: 1.0
        }
    },

    // Slippage configuration
    slippage: {
        default: {
            type: Number,
            default: 0.02, // 2%
            min: 0.001,
            max: 0.5
        },
        low: {
            type: Number,
            default: 0.01 // 1% for low urgency
        },
        medium: {
            type: Number,
            default: 0.02 // 2% for medium urgency
        },
        high: {
            type: Number,
            default: 0.05 // 5% for high urgency
        },
        emergency: {
            type: Number,
            default: 0.10 // 10% for emergency
        }
    },

    // Gas configuration
    gas: {
        maxGasPriceGwei: {
            type: Number,
            default: 20, // Max 20 Gwei
            min: 1,
            max: 1000
        },
        urgencyMultipliers: {
            low: {
                type: Number,
                default: 1.0
            },
            medium: {
                type: Number,
                default: 1.1
            },
            high: {
                type: Number,
                default: 1.2
            },
            emergency: {
                type: Number,
                default: 1.5
            }
        }
    },

    // Trading strategy
    strategy: {
        mode: {
            type: String,
            enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'],
            default: 'MODERATE'
        },
        autoRebalance: {
            type: Boolean,
            default: true
        },
        minLiquidityUSD: {
            type: Number,
            default: 1000, // Minimum $1000 liquidity to trade
            min: 100,
            max: 1000000
        },
        maxPriceImpact: {
            type: Number,
            default: 3.0, // Max 3% price impact
            min: 0.1,
            max: 50
        }
    },

    // Price monitoring
    monitoring: {
        priceCheckInterval: {
            type: Number,
            default: 60, // Check price every 60 seconds
            min: 10,
            max: 3600
        },
        priceHistoryRetention: {
            type: Number,
            default: 90, // Keep 90 days of price history
            min: 7,
            max: 365
        },
        alertOnAnomalies: {
            type: Boolean,
            default: true
        },
        anomalyThreshold: {
            type: Number,
            default: 10, // Alert on 10%+ sudden change
            min: 1,
            max: 100
        }
    },

    // Safety features
    safety: {
        enableCircuitBreaker: {
            type: Boolean,
            default: true
        },
        enableDailyLimits: {
            type: Boolean,
            default: true
        },
        enableGasLimit: {
            type: Boolean,
            default: true
        },
        requireMinBalance: {
            bnb: {
                type: Number,
                default: 0.1, // Require 0.1 BNB minimum
                min: 0.01,
                max: 100
            },
            mwt: {
                type: Number,
                default: 10, // Require 10 MWT minimum
                min: 0,
                max: 1000000
            }
        },
        autoStopOnErrors: {
            type: Boolean,
            default: true
        },
        maxConsecutiveErrors: {
            type: Number,
            default: 5, // Stop after 5 consecutive errors
            min: 1,
            max: 100
        }
    },

    // Notifications
    notifications: {
        enabled: {
            type: Boolean,
            default: false
        },
        channels: [{
            type: String,
            enum: ['EMAIL', 'TELEGRAM', 'DISCORD', 'SLACK', 'WEBHOOK']
        }],
        events: {
            onTrade: {
                type: Boolean,
                default: true
            },
            onError: {
                type: Boolean,
                default: true
            },
            onPause: {
                type: Boolean,
                default: true
            },
            onResume: {
                type: Boolean,
                default: true
            },
            onCircuitBreaker: {
                type: Boolean,
                default: true
            },
            onDailyLimit: {
                type: Boolean,
                default: true
            }
        }
    },

    // API access
    apiAccess: {
        apiKey: {
            type: String,
            select: false, // Don't return by default
            default: null
        },
        allowedIPs: [{
            type: String
        }],
        rateLimit: {
            requestsPerMinute: {
                type: Number,
                default: 60
            },
            requestsPerHour: {
                type: Number,
                default: 1000
            }
        }
    },

    // Runtime statistics
    statistics: {
        totalTrades: {
            type: Number,
            default: 0
        },
        successfulTrades: {
            type: Number,
            default: 0
        },
        failedTrades: {
            type: Number,
            default: 0
        },
        totalVolumeBNB: {
            type: Number,
            default: 0
        },
        totalVolumeMWT: {
            type: Number,
            default: 0
        },
        totalGasCostBNB: {
            type: Number,
            default: 0
        },
        totalProfitLoss: {
            type: Number,
            default: 0
        },
        lastTradeAt: {
            type: Date,
            default: null
        },
        lastErrorAt: {
            type: Date,
            default: null
        },
        consecutiveErrors: {
            type: Number,
            default: 0
        }
    },

    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    lastModifiedBy: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true,
    collection: 'bot_configs'
});

// Indexes
botConfigSchema.index({ enabled: 1, botId: 1 });

// Static methods
botConfigSchema.statics = {
    /**
     * Get default bot configuration
     */
    async getDefault() {
        let config = await this.findOne({ botId: 'default' });

        if (!config) {
            config = await this.create({ botId: 'default' });
        }

        return config;
    },

    /**
     * Get configuration by bot ID
     */
    async getByBotId(botId) {
        return this.findOne({ botId });
    },

    /**
     * Get all active bot configurations
     */
    async getActive() {
        return this.find({ enabled: true });
    }
};

// Instance methods
botConfigSchema.methods = {
    /**
     * Enable bot
     */
    async enable(reason = 'Manual enable') {
        this.enabled = true;
        this.pausedAt = null;
        this.pauseReason = null;
        this.metadata.lastEnabled = { at: new Date(), reason };
        await this.save();
        return this;
    },

    /**
     * Disable/pause bot
     */
    async disable(reason = 'Manual disable') {
        this.enabled = false;
        this.pausedAt = new Date();
        this.pauseReason = reason;
        this.metadata.lastDisabled = { at: new Date(), reason };
        await this.save();
        return this;
    },

    /**
     * Update trading thresholds
     */
    async updateThresholds(thresholds) {
        Object.assign(this.thresholds, thresholds);
        await this.save();
        return this;
    },

    /**
     * Update trade limits
     */
    async updateLimits(limits) {
        Object.assign(this.limits, limits);
        await this.save();
        return this;
    },

    /**
     * Get trade size for a given deviation
     */
    calculateTradeSize(deviationPercent, currentPrice, bnbBalance, mwtBalance) {
        const absDeviation = Math.abs(deviationPercent);

        // Determine urgency based on thresholds
        let urgency = 'HOLD';
        let maxAmount = 0;

        if (absDeviation < this.thresholds.hold) {
            return { amount: 0, urgency: 'HOLD' };
        } else if (absDeviation < this.thresholds.tradeLow) {
            urgency = 'LOW';
            maxAmount = this.limits.maxTradeBNB * 0.1; // 10% of max
        } else if (absDeviation < this.thresholds.tradeMedium) {
            urgency = 'MEDIUM';
            maxAmount = this.limits.maxTradeBNB * 0.3; // 30% of max
        } else if (absDeviation < this.thresholds.tradeHigh) {
            urgency = 'HIGH';
            maxAmount = this.limits.maxTradeBNB * 0.5; // 50% of max
        } else if (absDeviation < this.thresholds.emergency) {
            urgency = 'EMERGENCY';
            maxAmount = this.limits.maxTradeBNB; // 100% of max
        } else {
            return { amount: 0, urgency: 'CIRCUIT_BREAKER' };
        }

        // Calculate amount based on strategy
        let amount;

        switch (this.tradeSizing.strategy) {
            case 'FIXED':
                amount = this.tradeSizing.fixedAmount;
                break;

            case 'PROPORTIONAL':
                amount = maxAmount * (absDeviation / this.thresholds.tradeHigh);
                break;

            case 'DYNAMIC':
                // Dynamic sizing based on liquidity and deviation
                amount = maxAmount * (absDeviation / this.thresholds.tradeHigh) * 0.8;
                break;

            default:
                amount = maxAmount * 0.5;
        }

        // Cap at max trade size
        amount = Math.min(amount, maxAmount);

        // Check balance constraints
        if (deviationPercent > 0) {
            // Need to SELL MWT
            const requiredMWT = amount / currentPrice;
            amount = Math.min(amount, mwtBalance * currentPrice * 0.8); // Use max 80% of balance
        } else {
            // Need to BUY MWT
            amount = Math.min(amount, bnbBalance * 0.8); // Use max 80% of balance
        }

        return {
            amount: Math.max(amount, 0),
            urgency,
            action: deviationPercent > 0 ? 'SELL' : 'BUY'
        };
    },

    /**
     * Get slippage for urgency level
     */
    getSlippageForUrgency(urgency) {
        const slippageMap = {
            'LOW': this.slippage.low,
            'MEDIUM': this.slippage.medium,
            'HIGH': this.slippage.high,
            'EMERGENCY': this.slippage.emergency
        };

        return slippageMap[urgency] || this.slippage.default;
    },

    /**
     * Check if daily limits exceeded
     */
    async checkDailyLimits(tradeModel) {
        if (!this.safety.enableDailyLimits) return { exceeded: false };

        const today = await tradeModel.getDailyVolume(new Date());

        return {
            exceeded: today.volumeBNB >= this.limits.maxDailyVolumeBNB ||
                today.tradeCount >= this.limits.maxDailyTrades,
            volumeUsed: today.volumeBNB,
            volumeLimit: this.limits.maxDailyVolumeBNB,
            tradesUsed: today.tradeCount,
            tradesLimit: this.limits.maxDailyTrades
        };
    },

    /**
     * Record trade statistics
     */
    async recordTrade(trade) {
        this.statistics.totalTrades++;

        if (trade.status === 'SUCCESS') {
            this.statistics.successfulTrades++;
            this.statistics.consecutiveErrors = 0;

            if (trade.inputToken === 'BNB') {
                this.statistics.totalVolumeBNB += parseFloat(trade.inputAmount);
            } else {
                this.statistics.totalVolumeMWT += parseFloat(trade.inputAmount);
            }

            if (trade.gasCostBNB) {
                this.statistics.totalGasCostBNB += parseFloat(trade.gasCostBNB);
            }

            if (trade.profitLoss) {
                this.statistics.totalProfitLoss += trade.profitLoss;
            }

            this.statistics.lastTradeAt = new Date();
        } else if (trade.status === 'FAILED') {
            this.statistics.failedTrades++;
            this.statistics.consecutiveErrors++;
            this.statistics.lastErrorAt = new Date();

            // Auto-disable if too many errors
            if (this.safety.autoStopOnErrors &&
                this.statistics.consecutiveErrors >= this.safety.maxConsecutiveErrors) {
                await this.disable('Too many consecutive errors');
            }
        }

        await this.save();
        return this;
    },

    /**
     * Reset statistics
     */
    async resetStatistics() {
        this.statistics = {
            totalTrades: 0,
            successfulTrades: 0,
            failedTrades: 0,
            totalVolumeBNB: 0,
            totalVolumeMWT: 0,
            totalGasCostBNB: 0,
            totalProfitLoss: 0,
            lastTradeAt: null,
            lastErrorAt: null,
            consecutiveErrors: 0
        };
        await this.save();
        return this;
    },

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        // Validate thresholds are in ascending order
        if (this.thresholds.hold >= this.thresholds.tradeLow) {
            errors.push('hold threshold must be less than tradeLow');
        }
        if (this.thresholds.tradeLow >= this.thresholds.tradeMedium) {
            errors.push('tradeLow threshold must be less than tradeMedium');
        }
        if (this.thresholds.tradeMedium >= this.thresholds.tradeHigh) {
            errors.push('tradeMedium threshold must be less than tradeHigh');
        }
        if (this.thresholds.tradeHigh >= this.thresholds.emergency) {
            errors.push('tradeHigh threshold must be less than emergency');
        }

        // Validate limits
        if (this.limits.maxTradeBNB <= 0) {
            errors.push('maxTradeBNB must be positive');
        }
        if (this.limits.maxDailyVolumeBNB < this.limits.maxTradeBNB) {
            errors.push('maxDailyVolumeBNB should be >= maxTradeBNB');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
};

// Pre-save middleware
botConfigSchema.pre('save', function (next) {
    // Validate configuration before saving
    const validation = this.validate();
    if (!validation.isValid) {
        return next(new Error(`Invalid configuration: ${validation.errors.join(', ')}`));
    }
    next();
});

const BotConfig = mongoose.model('BotConfig', botConfigSchema);

module.exports = BotConfig;
