const mongoose = require('mongoose');

/**
 * Schema for tracking distribution finalization attempts
 * Records all auto-finalization and manual finalization actions
 */
const distributionFinalizationSchema = new mongoose.Schema({
    // Distribution identifier
    distributionId: {
        type: Number,
        required: true,
        index: true
    },

    // Finalization details
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'skipped'],
        required: true,
        default: 'pending'
    },

    // Transaction details
    txHash: {
        type: String,
        default: null
    },

    blockNumber: {
        type: Number,
        default: null
    },

    gasUsed: {
        type: String,
        default: null
    },

    // Amounts
    unclaimedAmount: {
        type: String,
        default: '0'
    },

    vaultType: {
        type: Number, // AllocationType enum
        default: null
    },

    // Error tracking
    error: {
        type: String,
        default: null
    },

    errorCount: {
        type: Number,
        default: 0
    },

    lastErrorAt: {
        type: Date,
        default: null
    },

    // Execution metadata
    executionType: {
        type: String,
        enum: ['auto', 'manual'],
        required: true,
        default: 'auto'
    },

    executedBy: {
        type: String, // Wallet address for manual, 'cron' for auto
        default: 'cron'
    },

    // Retry tracking
    retryCount: {
        type: Number,
        default: 0
    },

    nextRetryAt: {
        type: Date,
        default: null
    },

    // Distribution info snapshot (for reference)
    distributionEndTime: {
        type: Date,
        required: true
    },

    totalAllocated: {
        type: String,
        default: '0'
    },

    totalClaimed: {
        type: String,
        default: '0'
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes for efficient queries
distributionFinalizationSchema.index({ status: 1, createdAt: -1 });
distributionFinalizationSchema.index({ executionType: 1, createdAt: -1 });
distributionFinalizationSchema.index({ distributionId: 1, status: 1 });
distributionFinalizationSchema.index({ nextRetryAt: 1 }, { sparse: true });

// Virtual for calculating time since creation
distributionFinalizationSchema.virtual('age').get(function () {
    return Date.now() - this.createdAt.getTime();
});

// Methods
distributionFinalizationSchema.methods.markSuccess = function (txHash, blockNumber, gasUsed, unclaimedAmount, vaultType) {
    this.status = 'success';
    this.txHash = txHash;
    this.blockNumber = blockNumber;
    this.gasUsed = gasUsed;
    this.unclaimedAmount = unclaimedAmount;
    this.vaultType = vaultType;
    this.error = null;
    return this.save();
};

distributionFinalizationSchema.methods.markFailed = function (error) {
    this.status = 'failed';
    this.error = error;
    this.errorCount += 1;
    this.lastErrorAt = new Date();
    return this.save();
};

distributionFinalizationSchema.methods.scheduleRetry = function (retryDelayMs) {
    this.retryCount += 1;
    this.nextRetryAt = new Date(Date.now() + retryDelayMs);
    return this.save();
};

distributionFinalizationSchema.methods.markSkipped = function (reason) {
    this.status = 'skipped';
    this.error = reason;
    return this.save();
};

// Statics for common queries
distributionFinalizationSchema.statics.findPendingRetries = function () {
    return this.find({
        status: 'failed',
        nextRetryAt: { $lte: new Date() },
        retryCount: { $lt: 3 } // Max 3 retries
    });
};

distributionFinalizationSchema.statics.findByDistributionId = function (distributionId) {
    return this.find({ distributionId }).sort({ createdAt: -1 });
};

distributionFinalizationSchema.statics.getSuccessRate = async function (days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);

    const total = stats.reduce((sum, s) => sum + s.count, 0);
    const successful = stats.find(s => s._id === 'success')?.count || 0;

    return {
        total,
        successful,
        failed: stats.find(s => s._id === 'failed')?.count || 0,
        skipped: stats.find(s => s._id === 'skipped')?.count || 0,
        successRate: total > 0 ? (successful / total * 100).toFixed(2) : 0
    };
};

const DistributionFinalization = mongoose.model('DistributionFinalization', distributionFinalizationSchema);

module.exports = DistributionFinalization;
