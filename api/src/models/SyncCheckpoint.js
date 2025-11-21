const mongoose = require('mongoose');

const syncCheckpointSchema = new mongoose.Schema({
  contractAddress: {
    type: String,
    required: true,
    lowercase: true,
    unique: true,
    index: true
  },
  network: {
    type: String,
    required: true,
    enum: ['bscTestnet', 'bsc'],
    default: 'bscTestnet'
  },
  lastSyncedBlock: {
    type: Number,
    required: true,
    default: 0
  },
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  syncStatus: {
    type: String,
    enum: ['syncing', 'synced', 'error'],
    default: 'synced'
  },
  errorMessage: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Method to update checkpoint
syncCheckpointSchema.methods.updateCheckpoint = function(blockNumber, status = 'synced', errorMsg = null) {
  this.lastSyncedBlock = blockNumber;
  this.lastSyncedAt = Date.now();
  this.syncStatus = status;
  this.errorMessage = errorMsg;
  return this.save();
};

// Static method to get or create checkpoint
syncCheckpointSchema.statics.getCheckpoint = async function(contractAddress, network = 'bscTestnet') {
  let checkpoint = await this.findOne({
    contractAddress: contractAddress.toLowerCase(),
    network
  });
  
  if (!checkpoint) {
    checkpoint = await this.create({
      contractAddress: contractAddress.toLowerCase(),
      network,
      lastSyncedBlock: 0
    });
  }
  
  return checkpoint;
};

const SyncCheckpoint = mongoose.model('SyncCheckpoint', syncCheckpointSchema);

module.exports = SyncCheckpoint;
