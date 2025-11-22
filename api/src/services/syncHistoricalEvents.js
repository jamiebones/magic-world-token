const { ethers } = require('ethers');
const { Order, OrderFill, Withdrawal, SyncCheckpoint } = require('../models');
const MWGOrderBookArtifact = require('../../contracts/abis/MWGOrderBook.json');
const logger = require('../utils/logger');

/**
 * Sync historical events from blockchain to database
 * This is a one-time operation to backfill historical data
 */
async function syncHistoricalEvents(config) {
    const {
        contractAddress,
        network,
        rpcUrl,
        fromBlock,
        toBlock,
        batchSize = 1000
    } = config;

    logger.info('[OrderBook Sync] Starting historical sync', {
        contractAddress,
        network,
        fromBlock,
        toBlock,
        batchSize
    });

    try {
        // Initialize provider and contract
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const abi = MWGOrderBookArtifact.abi;
        const contract = new ethers.Contract(contractAddress, abi, provider);

        // Get or create sync checkpoint
        let checkpoint = await SyncCheckpoint.findOne({ contractAddress, network });
        if (!checkpoint) {
            checkpoint = new SyncCheckpoint({
                contractAddress,
                network,
                lastSyncedBlock: fromBlock - 1,
                status: 'syncing'
            });
            await checkpoint.save();
        }

        const startBlock = Math.max(checkpoint.lastSyncedBlock + 1, fromBlock);
        const endBlock = toBlock === 'latest' ? await provider.getBlockNumber() : toBlock;

        logger.info(`[OrderBook Sync] Syncing from block ${startBlock} to ${endBlock}`);

        let currentBlock = startBlock;
        let totalOrdersCreated = 0;
        let totalOrdersFilled = 0;
        let totalOrdersCancelled = 0;
        let totalWithdrawals = 0;

        while (currentBlock <= endBlock) {
            const batchEnd = Math.min(currentBlock + batchSize - 1, endBlock);

            logger.info(`[OrderBook Sync] Processing blocks ${currentBlock} to ${batchEnd}`);

            // Fetch all events for this batch
            const [orderCreatedEvents, orderFilledEvents, orderCancelledEvents, withdrawalEvents] = await Promise.all([
                contract.queryFilter('OrderCreated', currentBlock, batchEnd),
                contract.queryFilter('OrderFilled', currentBlock, batchEnd),
                contract.queryFilter('OrderCancelled', currentBlock, batchEnd),
                contract.queryFilter('WithdrawalClaimed', currentBlock, batchEnd)
            ]);

            // Process OrderCreated events
            for (const event of orderCreatedEvents) {
                try {
                    const { orderId, user, orderType, mwgAmount, bnbAmount, price, expiresAt } = event.args;

                    // Get block timestamp
                    const block = await provider.getBlock(event.blockNumber);

                    // Check if order already exists
                    const existingOrder = await Order.findOne({ orderId: orderId.toString() });
                    if (existingOrder) {
                        logger.debug(`[OrderBook Sync] Order ${orderId} already exists, skipping`);
                        continue;
                    }

                    // Get on-chain order details for feeAtCreation
                    const orderDetails = await contract.orders(orderId);

                    const order = new Order({
                        orderId: orderId.toString(),
                        txHash: event.transactionHash,
                        user: user.toLowerCase(),
                        orderType: Number(orderType),
                        mwgAmount: mwgAmount.toString(),
                        bnbAmount: bnbAmount.toString(),
                        pricePerMWG: price.toString(),
                        filled: '0',
                        remaining: mwgAmount.toString(),
                        status: 0, // Active
                        createdAt: new Date(block.timestamp * 1000),
                        expiresAt: new Date(Number(expiresAt) * 1000),
                        feeAtCreation: orderDetails.feeAtCreation.toString(),
                        blockNumber: event.blockNumber
                    });

                    await order.save();
                    totalOrdersCreated++;
                    logger.debug(`[OrderBook Sync] Saved order ${orderId}`);
                } catch (error) {
                    logger.error(`[OrderBook Sync] Error processing OrderCreated event:`, error);
                }
            }

            // Process OrderFilled events
            for (const event of orderFilledEvents) {
                try {
                    const { orderId, fillId, filler, mwgAmount, bnbAmount, newStatus } = event.args;

                    // Get block timestamp
                    const block = await provider.getBlock(event.blockNumber);

                    // Update order
                    const order = await Order.findOne({ orderId: orderId.toString() });
                    if (!order) {
                        logger.warn(`[OrderBook Sync] Order ${orderId} not found for fill event`);
                        continue;
                    }

                    const previousFilled = BigInt(order.filled);
                    const filledAmount = BigInt(mwgAmount.toString());
                    const totalFilled = (previousFilled + filledAmount).toString();
                    const totalAmount = BigInt(order.mwgAmount);
                    const remaining = (totalAmount - BigInt(totalFilled)).toString();

                    await order.updateFilled(totalFilled, remaining);
                    await order.updateStatus(Number(newStatus));

                    // Create fill record
                    const fillRecordId = `${orderId}-${fillId}`;
                    const existingFill = await OrderFill.findOne({ fillId: fillRecordId });

                    if (!existingFill) {
                        const fill = new OrderFill({
                            fillId: fillRecordId,
                            orderId: orderId.toString(),
                            filler: filler.toLowerCase(),
                            orderCreator: order.user,
                            orderType: order.orderType,
                            mwgAmount: mwgAmount.toString(),
                            bnbAmount: bnbAmount.toString(),
                            pricePerMWG: order.pricePerMWG,
                            fee: '0',
                            txHash: event.transactionHash,
                            blockNumber: event.blockNumber,
                            timestamp: new Date(block.timestamp * 1000)
                        });

                        await fill.save();
                        totalOrdersFilled++;
                        logger.debug(`[OrderBook Sync] Saved fill for order ${orderId}`);
                    }
                } catch (error) {
                    logger.error(`[OrderBook Sync] Error processing OrderFilled event:`, error);
                }
            }

            // Process OrderCancelled events
            for (const event of orderCancelledEvents) {
                try {
                    const { orderId } = event.args;

                    const order = await Order.findOne({ orderId: orderId.toString() });
                    if (order) {
                        await order.updateStatus(2); // Cancelled
                        totalOrdersCancelled++;
                        logger.debug(`[OrderBook Sync] Cancelled order ${orderId}`);
                    }
                } catch (error) {
                    logger.error(`[OrderBook Sync] Error processing OrderCancelled event:`, error);
                }
            }

            // Process WithdrawalClaimed events
            for (const event of withdrawalEvents) {
                try {
                    const { user, amount } = event.args;

                    const block = await provider.getBlock(event.blockNumber);
                    const withdrawalId = `${user}-${event.transactionHash}`;

                    const existingWithdrawal = await Withdrawal.findOne({ withdrawalId });

                    if (!existingWithdrawal) {
                        const withdrawal = new Withdrawal({
                            withdrawalId,
                            user: user.toLowerCase(),
                            amount: amount.toString(),
                            amountType: 'BNB',
                            txHash: event.transactionHash,
                            blockNumber: event.blockNumber,
                            timestamp: new Date(block.timestamp * 1000)
                        });

                        await withdrawal.save();
                        totalWithdrawals++;
                        logger.debug(`[OrderBook Sync] Saved withdrawal for ${user}`);
                    }
                } catch (error) {
                    logger.error(`[OrderBook Sync] Error processing WithdrawalClaimed event:`, error);
                }
            }

            // Update checkpoint
            checkpoint.lastSyncedBlock = batchEnd;
            checkpoint.lastSyncedAt = new Date();
            await checkpoint.save();

            currentBlock = batchEnd + 1;
        }

        // Mark sync as complete
        checkpoint.status = 'completed';
        checkpoint.lastSyncedAt = new Date();
        await checkpoint.save();

        const summary = {
            success: true,
            blocksProcessed: endBlock - startBlock + 1,
            ordersCreated: totalOrdersCreated,
            ordersFilled: totalOrdersFilled,
            ordersCancelled: totalOrdersCancelled,
            withdrawals: totalWithdrawals,
            startBlock,
            endBlock
        };

        logger.info('[OrderBook Sync] Historical sync completed', summary);
        return summary;

    } catch (error) {
        logger.error('[OrderBook Sync] Historical sync failed:', error);

        // Update checkpoint status
        try {
            const checkpoint = await SyncCheckpoint.findOne({ contractAddress, network });
            if (checkpoint) {
                checkpoint.status = 'failed';
                checkpoint.error = error.message;
                await checkpoint.save();
            }
        } catch (checkpointError) {
            logger.error('[OrderBook Sync] Failed to update checkpoint:', checkpointError);
        }

        throw error;
    }
}

module.exports = syncHistoricalEvents;
