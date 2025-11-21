const mongoose = require('mongoose');

const orderFillSchema = new mongoose.Schema({
  fillId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    index: true
  },
  filler: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  orderCreator: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  orderType: {
    type: Number,
    required: true,
    enum: [0, 1] // 0 = Buy order filled, 1 = Sell order filled
  },
  mwgAmount: {
    type: String,
    required: true
  },
  bnbAmount: {
    type: String,
    required: true
  },
  pricePerMWG: {
    type: String,
    required: true
  },
  fee: {
    type: String,
    default: '0'
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
orderFillSchema.index({ orderId: 1, timestamp: -1 });
orderFillSchema.index({ filler: 1, timestamp: -1 });
orderFillSchema.index({ orderCreator: 1, timestamp: -1 });
orderFillSchema.index({ timestamp: -1 });
orderFillSchema.index({ orderType: 1, timestamp: -1 });

// Static method to get fills for a specific order
orderFillSchema.statics.getFillsByOrderId = function(orderId) {
  return this.find({ orderId }).sort({ timestamp: -1 });
};

// Static method to get fills by filler (user who filled the order)
orderFillSchema.statics.getFillsByFiller = function(fillerAddress, limit = 50, offset = 0) {
  return this.find({ filler: fillerAddress.toLowerCase() })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get fills where user's orders were filled
orderFillSchema.statics.getFillsByOrderCreator = function(creatorAddress, limit = 50, offset = 0) {
  return this.find({ orderCreator: creatorAddress.toLowerCase() })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get recent fills across platform
orderFillSchema.statics.getRecentFills = function(limit = 20, offset = 0) {
  return this.find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get fill statistics
orderFillSchema.statics.getFillStats = async function(startDate = null, endDate = null) {
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
        _id: null,
        totalFills: { $sum: 1 },
        totalMWGVolume: { $sum: { $toDouble: '$mwgAmount' } },
        totalBNBVolume: { $sum: { $toDouble: '$bnbAmount' } },
        totalFees: { $sum: { $toDouble: '$fee' } },
        avgPrice: { $avg: { $toDouble: '$pricePerMWG' } }
      }
    }
  ]);
  
  return stats.length > 0 ? stats[0] : {
    totalFills: 0,
    totalMWGVolume: 0,
    totalBNBVolume: 0,
    totalFees: 0,
    avgPrice: 0
  };
};

// Static method to get fills by date range
orderFillSchema.statics.getFillsByDateRange = function(startDate, endDate, limit = 100, offset = 0) {
  return this.find({
    timestamp: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  })
    .sort({ timestamp: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get volume by order type
orderFillSchema.statics.getVolumeByType = async function(startDate = null, endDate = null) {
  const matchStage = {};
  
  if (startDate || endDate) {
    matchStage.timestamp = {};
    if (startDate) matchStage.timestamp.$gte = new Date(startDate);
    if (endDate) matchStage.timestamp.$lte = new Date(endDate);
  }
  
  const volumeStats = await this.aggregate([
    ...(Object.keys(matchStage).length > 0 ? [{ $match: matchStage }] : []),
    {
      $group: {
        _id: '$orderType',
        count: { $sum: 1 },
        mwgVolume: { $sum: { $toDouble: '$mwgAmount' } },
        bnbVolume: { $sum: { $toDouble: '$bnbAmount' } }
      }
    }
  ]);
  
  return volumeStats;
};

const OrderFill = mongoose.model('OrderFill', orderFillSchema);

module.exports = OrderFill;
