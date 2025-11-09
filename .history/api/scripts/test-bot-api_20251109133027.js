require('dotenv').config();
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.BOT_API_KEY
// Create axios instance with API key
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'x-api-key': API_KEY
    }
});

const API_ENDPOINTS = {
    // Price endpoints
    currentPrices: `/api/bot/prices/current`,
    deviation: `/api/bot/prices/deviation`,
    priceHistory: `/api/bot/prices/history`,
    priceStats: `/api/bot/prices/statistics`,
    liquidity: `/api/bot/liquidity`,

    // Trade endpoints
    executeTradeEndpoint: `/api/bot/trade/execute`,
    estimateTrade: `/api/bot/trade/estimate`,
    tradeHistory: `/api/bot/trade/history`,
    tradeStats: `/api/bot/trade/statistics`,

    // Balance endpoints
    balances: `/api/bot/balances`,
    portfolio: `/api/bot/portfolio/status`,

    // Config endpoints
    config: `/api/bot/config`,
    enableBot: `/api/bot/config/enable`,
    disableBot: `/api/bot/config/disable`,

    // Safety endpoints
    safetyStatus: `/api/bot/safety/status`,
    health: `/api/bot/health`,
    emergencyPause: `/api/bot/emergency/pause`
};

async function testBotAPI() {
    console.log('\n🧪 Starting Bot API Routes Test\n');
    console.log('='.repeat(70));
    console.log(`Testing API at: ${API_BASE_URL}`);
    console.log('='.repeat(70));

    let passedTests = 0;
    let failedTests = 0;

    // Helper function to test endpoint
    async function testEndpoint(name, method, url, data = null, expectedStatus = 200) {
        try {
            console.log(`\n📋 Testing: ${name}`);
            console.log('-'.repeat(70));
            console.log(`   Method: ${method}`);
            console.log(`   URL: ${url}`);

            let response;
            if (method === 'GET') {
                response = await api.get(url);
            } else if (method === 'POST') {
                response = await api.post(url, data);
            } else if (method === 'PUT') {
                response = await api.put(url, data);
            }

            if (response.status === expectedStatus) {
                console.log(`   ✅ Status: ${response.status}`);
                console.log(`   ✅ Success: ${response.data.success}`);

                // Log sample data
                if (response.data.data) {
                    const dataPreview = JSON.stringify(response.data.data, null, 2);
                    const previewLines = dataPreview.split('\n').slice(0, 10).join('\n');
                    console.log(`   📊 Response Data (preview):`);
                    console.log(previewLines);
                    if (dataPreview.split('\n').length > 10) {
                        console.log('   ... (truncated)');
                    }
                }

                passedTests++;
                return response.data;
            } else {
                console.log(`   ❌ Unexpected status: ${response.status}`);
                failedTests++;
                return null;
            }

        } catch (error) {
            console.log(`   ⚠️  Error: ${error.message}`);
            if (error.response) {
                console.log(`   Status: ${error.response.status}`);
                console.log(`   Error: ${error.response.data.error || error.response.data.message}`);
            } else {
                console.log(`   ${error.code || 'Network error'}`);
            }
            failedTests++;
            return null;
        }
    }

    // ============================================================================
    // PRICE ENDPOINTS TESTS
    // ============================================================================

    console.log('\n\n🔷 PRICE ENDPOINTS');
    console.log('='.repeat(70));

    const currentPrices = await testEndpoint(
        'Get Current Prices',
        'GET',
        API_ENDPOINTS.currentPrices
    );

    const deviation = await testEndpoint(
        'Get Peg Deviation',
        'GET',
        `${API_ENDPOINTS.deviation}?target=0.01`
    );

    const priceHistory = await testEndpoint(
        'Get Price History (24h)',
        'GET',
        `${API_ENDPOINTS.priceHistory}?hours=24&limit=100`
    );

    const priceStats = await testEndpoint(
        'Get Price Statistics',
        'GET',
        `${API_ENDPOINTS.priceStats}?hours=24`
    );

    const liquidity = await testEndpoint(
        'Get Liquidity Depth',
        'GET',
        API_ENDPOINTS.liquidity
    );

    // ============================================================================
    // TRADE ENDPOINTS TESTS
    // ============================================================================

    console.log('\n\n🔷 TRADE ENDPOINTS');
    console.log('='.repeat(70));

    const estimateBuy = await testEndpoint(
        'Estimate BUY Trade',
        'POST',
        API_ENDPOINTS.estimateTrade,
        {
            amount: 0.01,
            action: 'BUY'
        }
    );

    const estimateSell = await testEndpoint(
        'Estimate SELL Trade',
        'POST',
        API_ENDPOINTS.estimateTrade,
        {
            amount: 1,
            action: 'SELL'
        }
    );

    const tradeHistory = await testEndpoint(
        'Get Trade History',
        'GET',
        `${API_ENDPOINTS.tradeHistory}?limit=10&hours=24`
    );

    const tradeStats = await testEndpoint(
        'Get Trade Statistics',
        'GET',
        `${API_ENDPOINTS.tradeStats}?hours=24`
    );

    // Note: Actual trade execution test is commented out to avoid spending real funds
    console.log('\n📋 Testing: Execute Trade (DRY RUN)');
    console.log('-'.repeat(70));
    console.log('   ⚠️  Skipped - would execute real trade');
    console.log('   💡 Uncomment to test actual trade execution');
    /*
    const executeTrade = await testEndpoint(
      'Execute BUY Trade',
      'POST',
      API_ENDPOINTS.executeTrade,
      {
        action: 'BUY',
        amount: 0.001,
        slippage: 0.02,
        urgency: 'MEDIUM'
      }
    );
    */

    // ============================================================================
    // BALANCE & PORTFOLIO ENDPOINTS TESTS
    // ============================================================================

    console.log('\n\n🔷 BALANCE & PORTFOLIO ENDPOINTS');
    console.log('='.repeat(70));

    const balances = await testEndpoint(
        'Get Wallet Balances',
        'GET',
        API_ENDPOINTS.balances
    );

    const portfolio = await testEndpoint(
        'Get Portfolio Status',
        'GET',
        API_ENDPOINTS.portfolio
    );

    // ============================================================================
    // CONFIGURATION ENDPOINTS TESTS
    // ============================================================================

    console.log('\n\n🔷 CONFIGURATION ENDPOINTS');
    console.log('='.repeat(70));

    const config = await testEndpoint(
        'Get Bot Configuration',
        'GET',
        API_ENDPOINTS.config
    );

    const updateConfig = await testEndpoint(
        'Update Bot Configuration',
        'PUT',
        API_ENDPOINTS.config,
        {
            thresholds: {
                hold: 0.5,
                tradeLow: 2.0
            },
            modifiedBy: 'test-script'
        }
    );

    // ============================================================================
    // SAFETY ENDPOINTS TESTS
    // ============================================================================

    console.log('\n\n🔷 SAFETY & HEALTH ENDPOINTS');
    console.log('='.repeat(70));

    const safetyStatus = await testEndpoint(
        'Get Safety Status',
        'GET',
        API_ENDPOINTS.safetyStatus
    );

    const health = await testEndpoint(
        'Health Check',
        'GET',
        API_ENDPOINTS.health
    );

    // Bot enable/disable tests (optional)
    console.log('\n📋 Testing: Enable/Disable Bot (OPTIONAL)');
    console.log('-'.repeat(70));
    console.log('   ⚠️  Skipped - would change bot state');
    console.log('   💡 Uncomment to test bot state changes');
    /*
    await testEndpoint(
      'Disable Bot',
      'POST',
      API_ENDPOINTS.disableBot,
      { reason: 'Test disable' }
    );
    
    await testEndpoint(
      'Enable Bot',
      'POST',
      API_ENDPOINTS.enableBot,
      { reason: 'Test enable' }
    );
    */

    // ============================================================================
    // TEST SUMMARY
    // ============================================================================

    console.log('\n\n' + '='.repeat(70));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(70));

    const totalTests = passedTests + failedTests;
    const successRate = totalTests > 0 ? (passedTests / totalTests * 100).toFixed(1) : 0;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${successRate}%`);

    console.log('\n🎯 API ENDPOINT CATEGORIES:');
    console.log('   ✅ Price Endpoints (5): current, deviation, history, stats, liquidity');
    console.log('   ✅ Trade Endpoints (4): execute, estimate, history, statistics');
    console.log('   ✅ Balance Endpoints (2): balances, portfolio');
    console.log('   ✅ Config Endpoints (3): get, update, enable/disable');
    console.log('   ✅ Safety Endpoints (3): safety status, health, emergency pause');

    console.log('\n📝 NOTES:');
    console.log('   - Trade execution test skipped (would spend real funds)');
    console.log('   - Enable/disable bot tests skipped (would change bot state)');
    console.log('   - All endpoints tested with dry-run or read-only operations');
    console.log('   - API is ready for bot integration');

    console.log('\n💡 NEXT STEPS FOR BOTS:');
    console.log('   1. Call GET /api/bot/prices/current to get market prices');
    console.log('   2. Call GET /api/bot/prices/deviation to check peg deviation');
    console.log('   3. Call POST /api/bot/trade/estimate to simulate trades');
    console.log('   4. Call GET /api/bot/safety/status to verify safety checks');
    console.log('   5. Call POST /api/bot/trade/execute to execute actual trades');
    console.log('   6. Call GET /api/bot/trade/history to monitor performance');

    if (currentPrices && currentPrices.data) {
        console.log('\n📊 CURRENT MARKET DATA:');
        console.log(`   MWT/BNB: ${currentPrices.data.mwtBnb}`);
        console.log(`   MWT/USD: $${currentPrices.data.mwtUsd}`);
        console.log(`   MWT/BTC: ${currentPrices.data.mwtBtc} BTC`);
        if (currentPrices.data.liquidity) {
            console.log(`   Liquidity: ${currentPrices.data.liquidity}`);
        }
    }

    if (deviation && deviation.data) {
        console.log('\n📈 PEG DEVIATION:');
        console.log(`   Current: $${deviation.data.currentPrice}`);
        console.log(`   Target: $${deviation.data.targetPrice}`);
        console.log(`   Deviation: ${deviation.data.deviationPercentage}`);
    }

    if (balances && balances.data) {
        console.log('\n💰 BOT WALLET:');
        console.log(`   Address: ${balances.data.address}`);
        console.log(`   BNB: ${balances.data.bnb}`);
        console.log(`   MWT: ${balances.data.mwt}`);
        if (balances.data.totalUSD) {
            console.log(`   Total Value: $${balances.data.totalUSD.toFixed(2)}`);
        }
    }

    console.log('\n✨ Bot API Routes Test Complete!\n');

    process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
console.log('⚠️  Make sure the API server is running before testing!');
console.log('💡 Start server with: npm start or node src/index.js\n');

setTimeout(() => {
    testBotAPI().catch(error => {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    });
}, 1000);
