/**
 * Test Trade Execution Endpoint Locally
 * Tests the validation and database persistence for trade execution
 */

require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.BOT_API_KEY;

if (!API_KEY) {
    console.error('❌ BOT_API_KEY not found in environment variables');
    process.exit(1);
}

// Create axios instance with API key
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
    }
});

async function testTradeExecution() {
    console.log('\n🧪 Testing Trade Execution Endpoint (Local)\n');
    console.log('='.repeat(70));
    console.log(`API Base URL: ${API_BASE_URL}`);
    console.log('='.repeat(70));

    try {
        // Step 1: Check bot configuration
        console.log('\n📋 Step 1: Checking Bot Configuration');
        console.log('-'.repeat(70));
        const configRes = await api.get('/api/bot/config');
        console.log(`   Bot Enabled: ${configRes.data.data.enabled}`);
        console.log(`   Target Peg USD: $${configRes.data.data.targetPeg.usd}`);
        console.log(`   Max Trade BNB: ${configRes.data.data.limits.maxTradeBNB}`);

        // Step 2: Get current prices
        console.log('\n📋 Step 2: Getting Current Prices');
        console.log('-'.repeat(70));
        const pricesRes = await api.get('/api/bot/prices/current');
        const prices = pricesRes.data.data;
        console.log(`   MWT/BNB: ${prices.mwtBnb}`);
        console.log(`   MWT/USD: $${prices.mwtUsd}`);
        console.log(`   Deviation: ${prices.deviation}%`);

        // Step 3: Get wallet balances
        console.log('\n📋 Step 3: Checking Wallet Balances');
        console.log('-'.repeat(70));
        const balancesRes = await api.get('/api/bot/balances');
        const balances = balancesRes.data.data;
        console.log(`   Wallet: ${balances.address}`);
        console.log(`   BNB: ${balances.bnb}`);
        console.log(`   MWT: ${balances.mwt}`);

        // Step 4: Estimate trade
        console.log('\n📋 Step 4: Estimating Trade');
        console.log('-'.repeat(70));
        const tradeAmount = 0.001; // Very small amount for testing
        const estimateRes = await api.post('/api/bot/trade/estimate', {
            action: 'BUY',
            amount: tradeAmount
        });
        const estimate = estimateRes.data.data;
        console.log(`   Input: ${estimate.amountIn} BNB`);
        console.log(`   Estimated Output: ${estimate.amountOut} MWT`);
        console.log(`   Price Impact: ${estimate.priceImpact}%`);

        // Step 5: Execute trade (THIS WILL ATTEMPT A REAL TRANSACTION)
        console.log('\n📋 Step 5: Executing Trade');
        console.log('-'.repeat(70));
        console.log(`   ⚠️  Attempting to execute BUY of ${tradeAmount} BNB`);
        console.log(`   This will spend real funds if bot wallet has balance!`);

        const executeRes = await api.post('/api/bot/trade/execute', {
            action: 'BUY',
            amount: tradeAmount,
            slippage: 0.05, // 5% slippage tolerance
            urgency: 'LOW'
        });

        console.log('\n✅ TRADE EXECUTION RESPONSE:');
        console.log('-'.repeat(70));
        console.log(JSON.stringify(executeRes.data, null, 2));

        if (executeRes.data.success) {
            const trade = executeRes.data.data.trade;
            console.log('\n📊 Trade Record Created:');
            console.log(`   Trade ID: ${trade.tradeId}`);
            console.log(`   TX Hash: ${trade.txHash}`);
            console.log(`   Block Number: ${trade.blockNumber}`);
            console.log(`   Status: ${trade.status}`);
            console.log(`   Input Amount: ${trade.inputAmount} ${trade.inputToken}`);
            console.log(`   Output Amount: ${trade.outputAmount || 'N/A'} ${trade.outputToken}`);
            console.log(`   Peg Deviation: ${trade.pegDeviation}%`);
            console.log(`   Market Price: ${trade.marketPriceAtExecution}`);

            if (trade.liquidity) {
                console.log(`   Liquidity USD: $${trade.liquidity.totalUSD || 'N/A'}`);
            }
        } else {
            console.log('\n❌ Trade Execution Failed:');
            console.log(`   Error: ${executeRes.data.error}`);
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED:');
        console.error('-'.repeat(70));

        if (error.response) {
            console.error(`   Status: ${error.response.status}`);
            console.error(`   Error: ${JSON.stringify(error.response.data, null, 2)}`);
        } else if (error.request) {
            console.error(`   No response received from server`);
            console.error(`   Is the server running at ${API_BASE_URL}?`);
        } else {
            console.error(`   Error: ${error.message}`);
        }

        process.exit(1);
    }

    console.log('\n='.repeat(70));
    console.log('✨ Test Complete!');
    console.log('='.repeat(70));
}

// Run the test
testTradeExecution();
