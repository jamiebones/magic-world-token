const mongoose = require('mongoose');

/**
 * MerkleLeaf Model
 * Stores individual leaves of Merkle trees for proof generation
 * 
 * Each leaf represents one user's allocation in a distribution
 * Leaf format: keccak256(abi.encodePacked(userAddress, totalAmount))
 */
const merkleLeafSchema = new mongoose.Schema(
    {
        // Reference to the distribution
        distributionId: {
            type: Number,
            required: true,
            index: true,
        },

        // User's wallet address
        userAddress: {
            type: String,
            required: true,
            match: /^0x[a-fA-F0-9]{40}$/i,
            lowercase: true, // Store in lowercase for consistency
            index: true,
        },

        // User's total allocation in this distribution
        allocatedAmount: {
            type: String, // Store as string to handle BigNumber
            required: true,
        },

        // Pre-computed leaf hash
        leafHash: {
            type: String,
            required: true,
            match: /^0x[a-fA-F0-9]{64}$/,
        },

        // Position in the Merkle tree (for optimization)
        leafIndex: {
            type: Number,
            required: true,
        },

        // Whether this allocation has been fully claimed
        fullyClaimed: {
            type: Boolean,
            default: false,
            index: true,
        },

        // Amount claimed so far (synced from contract)
        claimedAmount: {
            type: String,
            default: '0',
        },

        // Last claim timestamp
        lastClaimTime: {
            type: Date,
        },

        // Transaction hash of last claim
        lastClaimTxHash: {
            type: String,
            match: /^0x[a-fA-F0-9]{64}$/,
        },

        // Number of times user has claimed from this distribution
        claimCount: {
            type: Number,
            default: 0,
        },

        // Optional metadata about the allocation
        metadata: {
            reason: String, // e.g., "Community reward Q4 2024"
            category: String, // e.g., "top_player", "social_media"
            customData: mongoose.Schema.Types.Mixed,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for fast lookups
merkleLeafSchema.index({ distributionId: 1, userAddress: 1 }, { unique: true });
merkleLeafSchema.index({ distributionId: 1, fullyClaimed: 1 });

// Virtual for unclaimed amount
merkleLeafSchema.virtual('unclaimedAmount').get(function () {
    const allocated = BigInt(this.allocatedAmount);
    const claimed = BigInt(this.claimedAmount);
    return (allocated - claimed).toString();
});

// Virtual for claim percentage
merkleLeafSchema.virtual('claimPercentage').get(function () {
    const allocated = BigInt(this.allocatedAmount);
    const claimed = BigInt(this.claimedAmount);

    if (allocated === 0n) return 0;

    return Number((claimed * 100n) / allocated);
});

// Method to check if user has unclaimed tokens
merkleLeafSchema.methods.hasUnclaimedTokens = function () {
    const allocated = BigInt(this.allocatedAmount);
    const claimed = BigInt(this.claimedAmount);
    return claimed < allocated;
};

// Method to update claim status
merkleLeafSchema.methods.updateClaimStatus = async function (claimedAmount, txHash) {
    this.claimedAmount = claimedAmount.toString();
    this.claimCount += 1;
    this.lastClaimTime = new Date();
    this.lastClaimTxHash = txHash;

    // Check if fully claimed
    const allocated = BigInt(this.allocatedAmount);
    const claimed = BigInt(claimedAmount);
    this.fullyClaimed = claimed >= allocated;

    return this.save();
};

// Static method to find leaves for a distribution
merkleLeafSchema.statics.findByDistribution = function (distributionId) {
    return this.find({ distributionId }).sort({ leafIndex: 1 });
};

// Static method to find user's leaf in a distribution
merkleLeafSchema.statics.findUserLeaf = function (distributionId, userAddress) {
    return this.findOne({
        distributionId,
        userAddress: userAddress.toLowerCase()
    });
};

// Static method to find all distributions for a user
merkleLeafSchema.statics.findUserDistributions = function (userAddress) {
    return this.find({
        userAddress: userAddress.toLowerCase()
    }).sort({ createdAt: -1 });
};

// Static method to find unclaimed leaves for a distribution
merkleLeafSchema.statics.findUnclaimed = function (distributionId) {
    return this.find({
        distributionId,
        fullyClaimed: false
    });
};

// Static method to get distribution statistics
merkleLeafSchema.statics.getDistributionStats = async function (distributionId) {
    const stats = await this.aggregate([
        { $match: { distributionId } },
        {
            $group: {
                _id: null,
                totalRecipients: { $sum: 1 },
                claimedCount: {
                    $sum: { $cond: [{ $gt: ['$claimCount', 0] }, 1, 0] }
                },
                fullyClaimedCount: {
                    $sum: { $cond: ['$fullyClaimed', 1, 0] }
                },
                totalClaims: { $sum: '$claimCount' },
            }
        }
    ]);

    return stats[0] || {
        totalRecipients: 0,
        claimedCount: 0,
        fullyClaimedCount: 0,
        totalClaims: 0,
    };
};

// Ensure virtuals are included in JSON
merkleLeafSchema.set('toJSON', { virtuals: true });
merkleLeafSchema.set('toObject', { virtuals: true });

const MerkleLeaf = mongoose.model('MerkleLeaf', merkleLeafSchema);

module.exports = MerkleLeaf;
