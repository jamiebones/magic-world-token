/**
 * Check the most recent trade record in MongoDB
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Trade = require('../src/bot/models/Trade');

async function checkTradeRecord() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URL;
        await mongoose.connect(mongoUri);
        console.log('✅ Connected to MongoDB\n');

        // Get the most recent trade
        const trade = await Trade.findOne().sort({ createdAt: -1 });

        if (!trade) {
            console.log('❌ No trade records found in database');
            process.exit(0);
        }

        console.log('📊 Most Recent Trade Record:');
        console.log('='.repeat(70));
        console.log(`Trade ID: ${trade.tradeId}`);
        console.log(`TX Hash: ${trade.txHash}`);
        console.log(`Block Number: ${trade.blockNumber}`);
        console.log(`Status: ${trade.status}`);
        console.log(`Action: ${trade.action}`);
        console.log(`Input Amount: ${trade.inputAmount} ${trade.inputToken}`);
        console.log(`Output Amount: ${trade.outputAmount || 'N/A'} ${trade.outputToken}`);
        console.log(`Min Output: ${trade.minOutputAmount}`);
        console.log(`Slippage: ${trade.slippage}`);
        console.log(`Urgency: ${trade.urgency}`);
        console.log(`\nPricing:`);
        console.log(`  Market Price: ${trade.marketPriceAtExecution}`);
        console.log(`  Execution Price: ${trade.executionPrice || 'N/A'}`);
        console.log(`  Peg Deviation: ${trade.pegDeviation}%`);
        console.log(`\nLiquidity:`);
        console.log(`  Total USD: $${trade.liquidity?.totalUSD || 'N/A'}`);
        console.log(`  MWT Reserve: ${trade.liquidity?.mwtReserve || 'N/A'}`);
        console.log(`  BNB Reserve: ${trade.liquidity?.bnbReserve || 'N/A'}`);
        console.log(`\nTimestamps:`);
        console.log(`  Initiated: ${trade.initiatedAt}`);
        console.log(`  Created: ${trade.createdAt}`);
        console.log(`  Executed: ${trade.executedAt || 'N/A'}`);
        console.log(`  Updated: ${trade.updatedAt}`);

        if (trade.error) {
            console.log(`\n❌ Error: ${trade.error}`);
        }

        console.log('='.repeat(70));

        // Validation checks
        console.log('\n✅ Validation Checks:');
        console.log('-'.repeat(70));
        console.log(`✓ tradeId is present: ${!!trade.tradeId}`);
        console.log(`✓ txHash is present: ${!!trade.txHash}`);
        console.log(`✓ blockNumber is present: ${trade.blockNumber !== undefined}`);
        console.log(`✓ pegDeviation is numeric: ${typeof trade.pegDeviation === 'number'}`);
        console.log(`✓ liquidity is object: ${typeof trade.liquidity === 'object'}`);
        console.log(`✓ status is valid: ${['PENDING', 'SUCCESS', 'FAILED'].includes(trade.status)}`);

        // Check for placeholder values
        console.log('\n📋 Placeholder Values (expected for failed trade):');
        console.log('-'.repeat(70));
        console.log(`  txHash starts with 'pending_': ${trade.txHash.startsWith('pending_')}`);
        console.log(`  blockNumber is 0: ${trade.blockNumber === 0}`);

        await mongoose.disconnect();
        console.log('\n✅ MongoDB disconnected');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

checkTradeRecord();
