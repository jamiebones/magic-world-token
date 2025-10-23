const mongoose = require('mongoose');

/**
 * MerkleDistribution Model
 * Tracks Merkle-based token distributions
 * 
 * Syncs with on-chain MagicWorldGame.distributions mapping
 */
const merkleDistributionSchema = new mongoose.Schema(
    {
        // On-chain distribution ID
        distributionId: {
            type: Number,
            required: true,
            unique: true,
            index: true,
        },

        // Merkle tree root hash (from contract)
        merkleRoot: {
            type: String,
            required: true,
            match: /^0x[a-fA-F0-9]{64}$/,
        },

        // Total tokens allocated (from contract)
        totalAllocated: {
            type: String, // Store as string to handle BigNumber
            required: true,
        },

        // Total tokens claimed so far (synced from contract)
        totalClaimed: {
            type: String,
            default: '0',
        },

        // Distribution start time (from contract)
        startTime: {
            type: Date,
            required: true,
        },

        // Distribution end time (from contract)
        endTime: {
            type: Date,
            required: true,
        },

        // Vault type that funded this distribution
        vaultType: {
            type: String,
            enum: ['PLAYER_TASKS', 'SOCIAL_FOLLOWERS', 'SOCIAL_POSTERS', 'ECOSYSTEM_FUND'],
            required: true,
        },

        // Whether distribution is finalized (from contract)
        finalized: {
            type: Boolean,
            default: false,
        },

        // Off-chain metadata
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },

        description: {
            type: String,
            trim: true,
            maxlength: 1000,
        },

        // Number of unique recipients in this distribution
        recipientCount: {
            type: Number,
            required: true,
            min: 1,
        },

        // Transaction hash of creation
        creationTxHash: {
            type: String,
            match: /^0x[a-fA-F0-9]{64}$/,
        },

        // Transaction hash of finalization (if finalized)
        finalizationTxHash: {
            type: String,
            match: /^0x[a-fA-F0-9]{64}$/,
        },

        // Admin who created this distribution
        createdBy: {
            type: String,
            required: true,
            match: /^0x[a-fA-F0-9]{40}$/i,
        },

        // Tags for categorization
        tags: [{
            type: String,
            trim: true,
        }],

        // Status for quick querying
        status: {
            type: String,
            enum: ['pending', 'active', 'expired', 'finalized'],
            default: 'pending',
            index: true,
        },
    },
    {
        timestamps: true, // Adds createdAt and updatedAt
    }
);

// Indexes for efficient querying
merkleDistributionSchema.index({ vaultType: 1, status: 1 });
merkleDistributionSchema.index({ startTime: 1, endTime: 1 });
merkleDistributionSchema.index({ createdBy: 1 });

// Virtual for unclaimed amount
merkleDistributionSchema.virtual('unclaimedAmount').get(function () {
    const total = BigInt(this.totalAllocated);
    const claimed = BigInt(this.totalClaimed);
    return (total - claimed).toString();
});

// Virtual for checking if active
merkleDistributionSchema.virtual('isActive').get(function () {
    const now = new Date();
    return !this.finalized &&
        now >= this.startTime &&
        now < this.endTime;
});

// Virtual for checking if expired
merkleDistributionSchema.virtual('isExpired').get(function () {
    const now = new Date();
    return !this.finalized && now >= this.endTime;
});

// Method to update status based on timestamps
merkleDistributionSchema.methods.updateStatus = function () {
    const now = new Date();

    if (this.finalized) {
        this.status = 'finalized';
    } else if (now >= this.endTime) {
        this.status = 'expired';
    } else if (now >= this.startTime) {
        this.status = 'active';
    } else {
        this.status = 'pending';
    }

    return this.status;
};

// Method to sync from on-chain data
merkleDistributionSchema.methods.syncFromChain = async function (chainData) {
    this.totalClaimed = chainData.totalClaimed.toString();
    this.finalized = chainData.finalized;
    this.updateStatus();
    return this.save();
};

// Static method to find active distributions
merkleDistributionSchema.statics.findActive = function () {
    return this.find({ status: 'active' });
};

// Static method to find expired distributions
merkleDistributionSchema.statics.findExpired = function () {
    return this.find({ status: 'expired' });
};

// Static method to find by vault type
merkleDistributionSchema.statics.findByVaultType = function (vaultType) {
    return this.find({ vaultType });
};

// Pre-save hook to update status
merkleDistributionSchema.pre('save', function (next) {
    this.updateStatus();
    next();
});

// Ensure virtuals are included in JSON
merkleDistributionSchema.set('toJSON', { virtuals: true });
merkleDistributionSchema.set('toObject', { virtuals: true });

const MerkleDistribution = mongoose.model('MerkleDistribution', merkleDistributionSchema);

module.exports = MerkleDistribution;
