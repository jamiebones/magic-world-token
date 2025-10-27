const mongoose = require('mongoose');

/**
 * Schema for tracking wallet balance alerts
 * Prevents duplicate alerts and provides audit trail
 */
const WalletBalanceAlertSchema = new mongoose.Schema({
    walletAddress: {
        type: String,
        required: true,
        index: true,
        lowercase: true,
    },
    walletName: {
        type: String,
        required: true,
    },
    balance: {
        type: String,
        required: true,
    },
    balanceNumber: {
        type: Number,
        required: true,
    },
    threshold: {
        type: String,
        required: true,
    },
    thresholdNumber: {
        type: Number,
        required: true,
    },
    network: {
        type: String,
        default: 'BSC Mainnet',
    },
    chainId: {
        type: Number,
        default: 56,
    },
    alertSentAt: {
        type: Date,
        default: Date.now,
    },
    emailSent: {
        type: Boolean,
        default: false,
    },
    emailRecipients: [String],
    emailError: String,
    resolved: {
        type: Boolean,
        default: false,
    },
    resolvedAt: Date,
    notes: String,
}, {
    timestamps: true,
});

// Indexes for efficient queries
WalletBalanceAlertSchema.index({ walletAddress: 1, alertSentAt: -1 });
WalletBalanceAlertSchema.index({ resolved: 1, alertSentAt: -1 });
WalletBalanceAlertSchema.index({ createdAt: -1 });

// Virtual for age
WalletBalanceAlertSchema.virtual('age').get(function () {
    return Date.now() - this.alertSentAt.getTime();
});

/**
 * Get last alert for a specific wallet
 */
WalletBalanceAlertSchema.statics.getLastAlert = async function (walletAddress) {
    return this.findOne({
        walletAddress: walletAddress.toLowerCase(),
        resolved: false
    })
        .sort({ alertSentAt: -1 });
};

/**
 * Get unresolved alerts
 */
WalletBalanceAlertSchema.statics.getUnresolvedAlerts = async function (limit = 50) {
    return this.find({ resolved: false })
        .sort({ alertSentAt: -1 })
        .limit(limit);
};

/**
 * Mark alert as resolved
 */
WalletBalanceAlertSchema.statics.resolveAlert = async function (alertId, notes) {
    return this.findByIdAndUpdate(
        alertId,
        {
            resolved: true,
            resolvedAt: new Date(),
            notes: notes || 'Wallet topped up',
        },
        { new: true }
    );
};

/**
 * Get alert statistics
 */
WalletBalanceAlertSchema.statics.getStatistics = async function (days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalAlerts, unresolvedAlerts, walletBreakdown] = await Promise.all([
        this.countDocuments({ createdAt: { $gte: startDate } }),
        this.countDocuments({ resolved: false }),
        this.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: '$walletAddress',
                    walletName: { $first: '$walletName' },
                    alertCount: { $sum: 1 },
                    lastAlert: { $max: '$alertSentAt' },
                },
            },
            { $sort: { alertCount: -1 } },
        ]),
    ]);

    return {
        period: `${days} days`,
        totalAlerts,
        unresolvedAlerts,
        resolvedAlerts: totalAlerts - unresolvedAlerts,
        walletBreakdown,
    };
};

/**
 * Check if alert should be sent (throttle to once per 24 hours per wallet)
 */
WalletBalanceAlertSchema.statics.shouldSendAlert = async function (walletAddress) {
    const lastAlert = await this.getLastAlert(walletAddress);

    if (!lastAlert) {
        return true; // No previous alert, send one
    }

    // Check if last alert was more than 24 hours ago
    const hoursSinceLastAlert = (Date.now() - lastAlert.alertSentAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastAlert >= 24;
};

/**
 * Create alert record
 */
WalletBalanceAlertSchema.statics.createAlert = async function (alertData) {
    const alert = new this({
        walletAddress: alertData.walletAddress.toLowerCase(),
        walletName: alertData.walletName,
        balance: alertData.balance,
        balanceNumber: alertData.balanceNumber,
        threshold: alertData.threshold,
        thresholdNumber: alertData.thresholdNumber,
        network: alertData.network || 'BSC Mainnet',
        chainId: alertData.chainId || 56,
        emailSent: alertData.emailSent || false,
        emailRecipients: alertData.emailRecipients || [],
        emailError: alertData.emailError,
    });

    return alert.save();
};

const WalletBalanceAlert = mongoose.model('WalletBalanceAlert', WalletBalanceAlertSchema);

module.exports = WalletBalanceAlert;
