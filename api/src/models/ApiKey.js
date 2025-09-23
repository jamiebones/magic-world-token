const mongoose = require('mongoose');
const crypto = require('crypto');

const apiKeySchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    hashedKey: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    permissions: [{
        type: String,
        enum: ['read', 'distribute', 'admin'],
        default: ['read']
    }],
    isActive: {
        type: Boolean,
        default: true,
        index: true
    },
    usageCount: {
        type: Number,
        default: 0,
        min: 0
    },
    lastUsed: {
        type: Date,
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now,
        immutable: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    // Optional metadata
    gameName: {
        type: String,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    rateLimitOverride: {
        type: Number,
        min: 1,
        max: 10000,
        default: null // null means use default rate limit
    }
});

// Indexes for performance
apiKeySchema.index({ createdAt: -1 });
apiKeySchema.index({ isActive: 1, lastUsed: -1 });
apiKeySchema.index({ permissions: 1 });

// Update the updatedAt field before saving
apiKeySchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Instance methods
apiKeySchema.methods = {
    /**
     * Increment usage count and update last used timestamp
     */
    async recordUsage() {
        this.usageCount += 1;
        this.lastUsed = new Date();
        await this.save();
    },

    /**
     * Check if API key has specific permission
     */
    hasPermission(permission) {
        return this.permissions.includes(permission);
    },

    /**
     * Get masked key for logging (shows first 8 and last 4 characters)
     */
    getMaskedKey() {
        // This would need the original key to mask it properly
        // For now, return a placeholder
        return `${this.id.substring(0, 8)}...${this.id.substring(this.id.length - 4)}`;
    },

    /**
     * Soft delete by deactivating
     */
    async deactivate() {
        this.isActive = false;
        this.updatedAt = new Date();
        await this.save();
    },

    /**
     * Reactivate the API key
     */
    async reactivate() {
        this.isActive = true;
        this.updatedAt = new Date();
        await this.save();
    }
};

// Static methods
apiKeySchema.statics = {
    /**
     * Generate a new API key
     */
    generateApiKey(name, permissions = ['read'], metadata = {}) {
        const apiKey = 'mwt_' + crypto.randomBytes(32).toString('hex');
        const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
        const id = crypto.randomUUID();

        return {
            apiKey, // Return the plain key only once
            keyData: {
                id,
                name,
                hashedKey,
                permissions,
                ...metadata
            }
        };
    },

    /**
     * Find API key by hashed key
     */
    async findByHashedKey(hashedKey) {
        return this.findOne({ hashedKey, isActive: true });
    },

    /**
     * Get API key statistics
     */
    async getStats() {
        const stats = await this.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    active: { $sum: { $cond: ['$isActive', 1, 0] } },
                    totalUsage: { $sum: '$usageCount' },
                    avgUsage: { $avg: '$usageCount' }
                }
            }
        ]);

        return stats[0] || { total: 0, active: 0, totalUsage: 0, avgUsage: 0 };
    },

    /**
     * Get recent API key activity
     */
    async getRecentActivity(limit = 10) {
        return this.find({ lastUsed: { $ne: null } })
            .sort({ lastUsed: -1 })
            .limit(limit)
            .select('name lastUsed usageCount permissions')
            .lean();
    }
};

// Virtual for getting the plain API key (not stored in DB)
apiKeySchema.virtual('plainKey').get(function () {
    // This is just for documentation - the actual key is never stored
    return null;
});

// Ensure virtual fields are serialized
apiKeySchema.set('toJSON', { virtuals: true });
apiKeySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('ApiKey', apiKeySchema);