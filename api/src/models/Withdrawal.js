const mongoose = require('mongoose');

const withdrawalSchema = new mongoose.Schema({
  withdrawalId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  amount: {
    type: String,
    required: true
  },
  amountType: {
    type: String,
    required: true,
    enum: ['BNB', 'MWG'],
    index: true
  },
  txHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
withdrawalSchema.index({ user: 1, timestamp: -1 });
withdrawalSchema.index({ user: 1, amountType: 1 });
withdrawalSchema.index({ timestamp: -1 });

// Static method to get user withdrawals
withdrawalSchema.statics.getUserWithdrawals = function(userAddress, amountType = null, limit = 50, offset = 0) {
  const query = { user: userAddress.toLowerCase() };
  
  if (amountType) {
    query.amountType = amountType;
  }
  
  return this.find(query)
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get recent withdrawals
withdrawalSchema.statics.getRecentWithdrawals = function(limit = 20, offset = 0) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get withdrawal statistics
withdrawalSchema.statics.getWithdrawalStats = async function(startDate = null, endDate = null) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate);
  }
  
  const stats = await this.aggregate([
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    {
      $group: {
        _id: '$amountType',
        totalWithdrawals: { $sum: 1 },
        totalAmount: { $sum: { $toDouble: '$amount' } }
      }
    }
  ]);
  
  return stats;
};

// Static method to get user's total withdrawn amount by type
withdrawalSchema.statics.getUserTotalWithdrawn = async function(userAddress) {
  const stats = await this.aggregate([
    { $match: { user: userAddress.toLowerCase() } },
    {
      $group: {
        _id: '$amountType',
        totalAmount: { $sum: { $toDouble: '$amount' } },
        count: { $sum: 1 }
      }
    }
  ]);
  
  const result = {
    BNB: { amount: '0', count: 0 },
    MWG: { amount: '0', count: 0 }
  };
  
  stats.forEach(stat => {
    result[stat._id] = {
      amount: stat.totalAmount.toString(),
      count: stat.count
    };
  });
  
  return result;
};

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

module.exports = Withdrawal;
