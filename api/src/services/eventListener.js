const { ethers } = require('ethers');
const { Order, OrderFill, Withdrawal, SyncCheckpoint } = require('../models');
const MWGOrderBookArtifact = require('../../contracts/abis/MWGOrderBook.json');
const logger = require('../utils/logger');

class OrderBookEventListener {
  static instance = null;

  constructor(config) {
    if (!config) {
      throw new Error('OrderBookEventListener: config is required');
    }
    if (!config.contractAddress || config.contractAddress.trim() === '') {
      throw new Error('OrderBookEventListener: contractAddress is required and cannot be empty');
    }
    if (!config.rpcUrl || config.rpcUrl.trim() === '') {
      throw new Error('OrderBookEventListener: rpcUrl is required and cannot be empty');
    }

    this.contractAddress = config.contractAddress.trim();
    this.network = config.network || 'bscTestnet';
    this.rpcUrl = config.rpcUrl.trim();
    this.startBlock = config.startBlock || 0;
    this.pollInterval = config.pollInterval || 15000; // 15 seconds default

    // Initialize provider and contract
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    // Extract ABI from Hardhat artifact
    const abi = MWGOrderBookArtifact.abi;
    this.contract = new ethers.Contract(
      this.contractAddress,
      abi,
      this.provider
    );

    this.isRunning = false;
    this.checkpoint = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000; // 5 seconds
    this.pollingIntervalId = null; // Store interval ID for cleanup
    this.reconnectTimeoutId = null; // Store timeout ID for cleanup
  }

  /**
   * Initialize the event listener
   */
  async initialize() {
    try {
      logger.info(`[OrderBook Initializing for ${this.network}...`);
      logger.info(`[OrderBook Contract: ${this.contractAddress}`);

      // Get or create sync checkpoint
      this.checkpoint = await SyncCheckpoint.getCheckpoint(
        this.contractAddress,
        this.network
      );

      logger.info(`[OrderBook Last synced block: ${this.checkpoint.lastSyncedBlock}`);

      // Verify contract connection
      const code = await this.provider.getCode(this.contractAddress);
      if (code === '0x') {
        throw new Error('Contract not found at address');
      }

      logger.info('[OrderBook Initialized successfully');
      return true;
    } catch (error) {
      logger.error('[OrderBook Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start listening to events
   */
  async start() {
    if (this.isRunning) {
      logger.info('[OrderBook Already running');
      return;
    }

    this.isRunning = true;
    logger.info('[OrderBook Starting event listener...');

    try {
      // Set up event listeners
      this.setupEventListeners();

      // Start polling for new blocks
      this.startBlockPolling();

      logger.info('[OrderBook Event listener started successfully');
    } catch (error) {
      logger.error('[OrderBook Failed to start:', error);
      this.isRunning = false;
      throw error;
    }
  }

  /**
   * Stop listening to events
   */
  async stop() {
    logger.info('[OrderBook Stopping event listener...');
    this.isRunning = false;

    // Remove all listeners
    this.contract.removeAllListeners();

    // Clear polling interval
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
      this.pollingIntervalId = null;
    }

    // Clear reconnect timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    logger.info('[OrderBook Event listener stopped');
  }  /**
   * Set up event listeners for contract events
   */
  setupEventListeners() {
    // OrderCreated event
    this.contract.on('OrderCreated', async (orderId, user, orderType, mwgAmount, bnbAmount, pricePerMWG, expiresAt, event) => {
      try {
        await this.handleOrderCreatedEvent({
          orderId: orderId.toString(),
          user,
          orderType: Number(orderType),
          mwgAmount: mwgAmount.toString(),
          bnbAmount: bnbAmount.toString(),
          pricePerMWG: pricePerMWG.toString(),
          expiresAt: Number(expiresAt),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      } catch (error) {
        logger.error('[OrderBook Error handling OrderCreated:', error);
      }
    });

    // OrderFilled event
    this.contract.on('OrderFilled', async (orderId, fillId, filler, mwgAmount, bnbAmount, newStatus, event) => {
      try {
        await this.handleOrderFilledEvent({
          orderId: orderId.toString(),
          fillId: fillId.toString(),
          filler,
          mwgAmount: mwgAmount.toString(),
          bnbAmount: bnbAmount.toString(),
          newStatus: Number(newStatus),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      } catch (error) {
        logger.error('[OrderBook Error handling OrderFilled:', error);
      }
    });

    // OrderCancelled event
    this.contract.on('OrderCancelled', async (orderId, user, bnbRefund, mwgRefund, event) => {
      try {
        await this.handleOrderCancelledEvent({
          orderId: orderId.toString(),
          user,
          bnbRefund: bnbRefund.toString(),
          mwgRefund: mwgRefund.toString(),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      } catch (error) {
        logger.error('[OrderBook Error handling OrderCancelled:', error);
      }
    });

    // WithdrawalClaimed event
    this.contract.on('WithdrawalClaimed', async (user, amount, event) => {
      try {
        await this.handleWithdrawalClaimedEvent({
          user,
          amount: amount.toString(),
          txHash: event.log.transactionHash,
          blockNumber: event.log.blockNumber
        });
      } catch (error) {
        logger.error('[OrderBook Error handling WithdrawalClaimed:', error);
      }
    });

    logger.info('[OrderBook Event listeners set up');
  }

  /**
   * Start polling for new blocks to update checkpoint
   */
  startBlockPolling() {
    // Clear any existing interval first to prevent duplicates
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }

    this.pollingIntervalId = setInterval(async () => {
      try {
        const currentBlock = await this.provider.getBlockNumber();

        if (currentBlock > this.checkpoint.lastSyncedBlock) {
          await this.checkpoint.updateCheckpoint(currentBlock, 'synced');
        }
      } catch (error) {
        logger.error('[OrderBook Block polling error:', error);
      }
    }, this.pollInterval);
  }

  /**
   * Handle OrderCreated event
   */
  async handleOrderCreatedEvent(eventData) {
    logger.info(`[OrderBook OrderCreated: Order #${eventData.orderId}`);

    try {
      // Get fee at creation from contract
      const orderDetails = await this.contract.orders(eventData.orderId);

      // Check if order already exists
      const existingOrder = await Order.findOne({ orderId: eventData.orderId });
      if (existingOrder) {
        logger.info(`[OrderBook Order #${eventData.orderId} already exists, skipping`);
        return;
      }

      // Create new order in database
      const order = new Order({
        orderId: eventData.orderId,
        txHash: eventData.txHash,
        user: eventData.user.toLowerCase(),
        orderType: eventData.orderType,
        mwgAmount: eventData.mwgAmount,
        bnbAmount: eventData.bnbAmount,
        pricePerMWG: eventData.pricePerMWG,
        filled: '0',
        remaining: eventData.mwgAmount,
        status: 0, // Active
        createdAt: new Date(),
        expiresAt: new Date(eventData.expiresAt * 1000),
        feeAtCreation: orderDetails.feeAtCreation.toString(),
        blockNumber: eventData.blockNumber
      });

      await order.save();
      logger.info(`[OrderBook Order #${eventData.orderId} saved to database`);
    } catch (error) {
      logger.error(`[OrderBook Error saving OrderCreated #${eventData.orderId}:`, error);
      throw error;
    }
  }

  /**
   * Handle OrderFilled event
   */
  async handleOrderFilledEvent(eventData) {
    logger.info(`[OrderBook OrderFilled: Order #${eventData.orderId}`);

    try {
      // Find the order
      const order = await Order.findOne({ orderId: eventData.orderId });
      if (!order) {
        logger.error(`[OrderBook Order #${eventData.orderId} not found in database`);
        return;
      }

      // Get block timestamp
      const block = await this.provider.getBlock(eventData.blockNumber);
      const timestamp = new Date(block.timestamp * 1000);

      // Calculate filled and remaining amounts
      const previousFilled = BigInt(order.filled);
      const filledAmount = BigInt(eventData.mwgAmount);
      const totalFilled = (previousFilled + filledAmount).toString();
      const totalAmount = BigInt(order.mwgAmount);
      const remaining = (totalAmount - BigInt(totalFilled)).toString();

      // Update order
      await order.updateFilled(totalFilled, remaining);

      // Create fill record
      const fillId = `${eventData.orderId}-${eventData.fillId}`;
      const existingFill = await OrderFill.findOne({ fillId });

      if (!existingFill) {
        const fill = new OrderFill({
          fillId,
          orderId: eventData.orderId,
          filler: eventData.filler.toLowerCase(),
          orderCreator: order.user,
          orderType: order.orderType,
          mwgAmount: eventData.mwgAmount,
          bnbAmount: eventData.bnbAmount,
          pricePerMWG: order.pricePerMWG,
          fee: '0', // Fee is burned, not tracked in event
          txHash: eventData.txHash,
          blockNumber: eventData.blockNumber,
          timestamp
        });

        await fill.save();
        logger.info(`[OrderBook Fill record saved for Order #${eventData.orderId}`);
      }

      // Update order status based on event's newStatus
      await order.updateStatus(eventData.newStatus);
      logger.info(`[OrderBook] Order #${eventData.orderId} status updated to ${eventData.newStatus}`);

      // Send email notification if email is provided
      if (order.email) {
        try {
          const emailService = require('./emailService');
          const isFullyFilled = remaining === '0';

          await emailService.sendOrderFilledEmail({
            email: order.email,
            orderId: order.orderId,
            orderType: order.orderType,
            mwgAmount: order.mwgAmount,
            pricePerMWG: order.pricePerMWG,
            totalBNB: order.bnbAmount,
            filledAmount: eventData.mwgAmount,
            remainingAmount: remaining,
            isFullyFilled,
            fillerAddress: eventData.filler,
            txHash: eventData.txHash,
            network: 'BSC Mainnet'
          });

          logger.info(`[OrderBook] Email notification sent for Order #${eventData.orderId}`);
        } catch (emailError) {
          logger.error(`[OrderBook] Failed to send email for Order #${eventData.orderId}:`, emailError.message);
          // Don't throw - email failure shouldn't stop order processing
        }
      }
    } catch (error) {
      logger.error(`[OrderBook Error saving OrderFilled #${eventData.orderId}:`, error);
      throw error;
    }
  }

  /**
   * Handle OrderCancelled event
   */
  async handleOrderCancelledEvent(eventData) {
    logger.info(`[OrderBook OrderCancelled: Order #${eventData.orderId}`);

    try {
      // Find and update order
      const order = await Order.findOne({ orderId: eventData.orderId });
      if (!order) {
        logger.error(`[OrderBook Order #${eventData.orderId} not found in database`);
        return;
      }

      await order.updateStatus(2); // Cancelled
      logger.info(`[OrderBook Order #${eventData.orderId} marked as cancelled`);
    } catch (error) {
      logger.error(`[OrderBook Error saving OrderCancelled #${eventData.orderId}:`, error);
      throw error;
    }
  }

  /**
   * Handle WithdrawalClaimed event
   */
  async handleWithdrawalClaimedEvent(eventData) {
    logger.info(`[OrderBook WithdrawalClaimed: ${eventData.user}`);

    try {
      // Get block timestamp
      const block = await this.provider.getBlock(eventData.blockNumber);
      const timestamp = new Date(block.timestamp * 1000);

      // WithdrawalClaimed only emits for BNB withdrawals (contract uses pull-over-push pattern)
      const amountType = 'BNB';

      // Create withdrawal record
      const withdrawalId = `${eventData.user}-${eventData.txHash}`;
      const existingWithdrawal = await Withdrawal.findOne({ withdrawalId });

      if (!existingWithdrawal) {
        const withdrawal = new Withdrawal({
          withdrawalId,
          user: eventData.user.toLowerCase(),
          amount: eventData.amount,
          amountType,
          txHash: eventData.txHash,
          blockNumber: eventData.blockNumber,
          timestamp
        });

        await withdrawal.save();
        logger.info(`[OrderBook Withdrawal saved for ${eventData.user}`);
      }
    } catch (error) {
      logger.error(`[OrderBook Error saving Withdrawal for ${eventData.user}:`, error);
      throw error;
    }
  }

  /**
   * Reconnect on provider error
   */
  async reconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[OrderBook Max reconnect attempts reached');
      await this.stop();
      return;
    }

    this.reconnectAttempts++;
    logger.info(`[OrderBook Reconnecting... Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    await this.stop();

    // Clear any existing timeout before creating new one
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    this.reconnectTimeoutId = setTimeout(async () => {
      try {
        await this.initialize();
        await this.start();
        this.reconnectAttempts = 0;
        this.reconnectTimeoutId = null; // Clear after successful reconnect
        logger.info('[OrderBook Reconnected successfully');
      } catch (error) {
        logger.error('[OrderBook Reconnection failed:', error);
        await this.reconnect();
      }
    }, this.reconnectDelay);
  }

  /**
   * Get singleton instance
   * @param {Object} config - Configuration object (required for first call)
   * @returns {OrderBookEventListener} Singleton instance
   */
  static getInstance(config) {
    if (!OrderBookEventListener.instance) {
      if (!config) {
        throw new Error('OrderBookEventListener: config is required for first getInstance() call');
      }
      OrderBookEventListener.instance = new OrderBookEventListener(config);
    }
    return OrderBookEventListener.instance;
  }
}

module.exports = OrderBookEventListener;


