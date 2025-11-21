const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  txHash: {
    type: String,
    required: true,
    index: true
  },
  user: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  orderType: {
    type: Number,
    required: true,
    enum: [0, 1], // 0 = Buy, 1 = Sell
    index: true
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
  filled: {
    type: String,
    default: '0'
  },
  remaining: {
    type: String,
    required: true
  },
  status: {
    type: Number,
    required: true,
    enum: [0, 1, 2, 3], // 0 = Active, 1 = Filled, 2 = Cancelled, 3 = Expired
    index: true,
    default: 0
  },
  createdAt: {
    type: Date,
    required: true,
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  feeAtCreation: {
    type: String,
    required: true
  },
  blockNumber: {
    type: Number,
    required: true,
    index: true
  },
  // Metadata
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ orderType: 1, status: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderType: 1, status: 1, pricePerMWG: 1 });

// Virtual for determining if order is expired
orderSchema.virtual('isExpired').get(function() {
  return this.status === 0 && new Date() > this.expiresAt;
});

// Method to update order status
orderSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.lastUpdated = Date.now();
  return this.save();
};

// Method to update filled amount
orderSchema.methods.updateFilled = function(filledAmount, remainingAmount) {
  this.filled = filledAmount;
  this.remaining = remainingAmount;
  this.lastUpdated = Date.now();
  
  // Auto-update status if fully filled
  if (remainingAmount === '0') {
    this.status = 1; // Filled
  }
  
  return this.save();
};

// Static method to get active orders
orderSchema.statics.getActiveOrders = function(orderType = null, limit = 50, offset = 0) {
  const query = { status: 0 }; // Active only
  
  if (orderType !== null) {
    query.orderType = orderType;
  }
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(offset);
};

// Static method to get user orders
orderSchema.statics.getUserOrders = function(userAddress, status = null) {
  const query = { user: userAddress.toLowerCase() };
  
  if (status !== null) {
    query.status = status;
  }
  
  return this.find(query).sort({ createdAt: -1 });
};

// Static method to get best buy price (highest bid)
orderSchema.statics.getBestBuyPrice = function() {
  return this.findOne({ orderType: 0, status: 0 })
    .sort({ pricePerMWG: -1 }); // Highest price first
};

// Static method to get best sell price (lowest ask)
orderSchema.statics.getBestSellPrice = function() {
  return this.findOne({ orderType: 1, status: 0 })
    .sort({ pricePerMWG: 1 }); // Lowest price first
};

// Static method to count orders by status
orderSchema.statics.getOrderStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalMWG: { $sum: { $toDouble: '$mwgAmount' } },
        totalBNB: { $sum: { $toDouble: '$bnbAmount' } }
      }
    }
  ]);
  
  return stats;
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
