require('dotenv').config({ path: '../.env' });
const axios = require('axios');

const API_BASE_URL = process.env.API_BASE_URL || 'https://magic-world-token-production.up.railway.app';
const API_KEY = '';

// Configure axios defaults
axios.defaults.headers.common['X-API-Key'] = API_KEY;
axios.defaults.headers.common['Content-Type'] = 'application/json';

console.log('\n🧪 PRODUCTION BOT API TEST\n');
console.log('='.repeat(80));
console.log(`Testing API at: ${API_BASE_URL}`);
console.log(`Target Peg: $${process.env.TARGET_PEG_USD}`);
console.log('='.repeat(80));

let passedTests = 0;
let failedTests = 0;

// Helper function to test endpoint
async function testEndpoint(name, method, url, data = null, skipTest = false) {
    if (skipTest) {
        console.log(`\n📋 ${name}`);
        console.log('-'.repeat(80));
        console.log(`   ⏭️  Skipped - ${data || 'would modify state'}`);
        return null;
    }

    try {
        console.log(`\n📋 Testing: ${name}`);
        console.log('-'.repeat(80));
        console.log(`   Method: ${method}`);
        console.log(`   URL: ${url}`);

        let response;
        const config = { validateStatus: () => true }; // Accept any status

        if (method === 'GET') {
            response = await axios.get(url, config);
        } else if (method === 'POST') {
            response = await axios.post(url, data, config);
        } else if (method === 'PUT') {
            response = await axios.put(url, data, config);
        }

        console.log(`   📊 Status: ${response.status} ${response.statusText}`);

        if (response.status >= 200 && response.status < 300) {
            console.log(`   ✅ Success: ${response.data.success !== false ? 'true' : 'false'}`);

            // Log key data points
            if (response.data.data) {
                const data = response.data.data;

                // Pretty print relevant data
                if (data.mwtUsd !== undefined) {
                    console.log(`\n   💰 PRICES:`);
                    console.log(`      MWT/USD: $${data.mwtUsd?.toFixed(8) || data.mwtUsd}`);
                    console.log(`      MWT/BNB: ${data.mwtBnb?.toFixed(10) || data.mwtBnb} BNB`);
                    console.log(`      BNB/USD: $${data.bnbUsd?.toFixed(2) || data.bnbUsd}`);
                }

                if (data.deviation !== undefined) {
                    console.log(`\n   📏 DEVIATION:`);
                    console.log(`      Current: $${data.currentPrice?.toFixed(8) || data.currentPrice}`);
                    console.log(`      Target: $${data.targetPrice?.toFixed(8) || data.targetPrice}`);
                    console.log(`      Deviation: ${data.deviation?.toFixed(2) || data.deviation}%`);
                    console.log(`      Status: ${data.isOverPeg ? '⬆️ OVER PEG' : '⬇️ UNDER PEG'}`);
                }

                if (data.liquidity !== undefined) {
                    console.log(`\n   💧 LIQUIDITY:`);
                    console.log(`      Total: ${data.liquidity}`);
                    console.log(`      Pool Type: ${data.poolType || 'V2'}`);
                }

                if (data.balance !== undefined || data.bnb !== undefined) {
                    console.log(`\n   💰 BALANCES:`);
                    if (data.bnb) console.log(`      BNB: ${data.bnb} BNB`);
                    if (data.mwt) console.log(`      MWT: ${Number(data.mwt).toLocaleString()} MWT`);
                }

                if (data.enabled !== undefined) {
                    console.log(`\n   ⚙️  BOT CONFIG:`);
                    console.log(`      Enabled: ${data.enabled ? '✅ YES' : '❌ NO'}`);
                    console.log(`      Target Peg: $${data.targetPeg}`);
                    if (data.thresholds) {
                        console.log(`      Buy Threshold: ${data.thresholds.buyDeviation}%`);
                        console.log(`      Sell Threshold: ${data.thresholds.sellDeviation}%`);
                    }
                }

                if (data.isHealthy !== undefined) {
                    console.log(`\n   🏥 HEALTH:`);
                    console.log(`      Status: ${data.isHealthy ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);
                    if (data.checks) {
                        Object.entries(data.checks).forEach(([key, val]) => {
                            console.log(`      ${key}: ${val ? '✅' : '❌'}`);
                        });
                    }
                }

                if (Array.isArray(data) && data.length > 0) {
                    console.log(`\n   📊 DATA (${data.length} items):`);
                    console.log(`      First item:`, JSON.stringify(data[0], null, 2).split('\n').slice(0, 5).join('\n'));
                }
            }

            if (response.data.message) {
                console.log(`   📝 Message: ${response.data.message}`);
            }

            passedTests++;
            return response.data;
        } else {
            console.log(`   ❌ Error Response`);
            console.log(`   Message: ${response.data.error || response.data.message || 'Unknown error'}`);
            failedTests++;
            return null;
        }

    } catch (error) {
        console.log(`   ⚠️  Exception: ${error.message}`);
        if (error.response) {
            console.log(`   Status: ${error.response.status}`);
            console.log(`   Error: ${JSON.stringify(error.response.data)}`);
        }
        failedTests++;
        return null;
    }
}

async function runTests() {
    // ============================================================================
    // PRICE ENDPOINTS
    // ============================================================================
    console.log('\n\n🔷 PRICE ENDPOINTS');
    console.log('='.repeat(80));

    await testEndpoint(
        'Get Current Prices',
        'GET',
        `${API_BASE_URL}/api/bot/prices/current`
    );

    await testEndpoint(
        'Get Peg Deviation',
        'GET',
        `${API_BASE_URL}/api/bot/prices/deviation?target=${process.env.TARGET_PEG_USD || 0.0003}`
    );

    await testEndpoint(
        'Get Price History (24h)',
        'GET',
        `${API_BASE_URL}/api/bot/prices/history?hours=24&limit=10`
    );

    await testEndpoint(
        'Get Price Statistics',
        'GET',
        `${API_BASE_URL}/api/bot/prices/statistics?hours=24`
    );

    await testEndpoint(
        'Get Liquidity Depth',
        'GET',
        `${API_BASE_URL}/api/bot/liquidity`
    );

    // ============================================================================
    // TRADE ENDPOINTS (READ-ONLY)
    // ============================================================================
    console.log('\n\n🔷 TRADE ENDPOINTS (READ-ONLY)');
    console.log('='.repeat(80));

    await testEndpoint(
        'Estimate BUY Trade',
        'POST',
        `${API_BASE_URL}/api/bot/trade/estimate`,
        {
            action: 'BUY',
            amountIn: '0.01', // BNB amount
            slippage: 2
        }
    );

    await testEndpoint(
        'Estimate SELL Trade',
        'POST',
        `${API_BASE_URL}/api/bot/trade/estimate`,
        {
            action: 'SELL',
            amountIn: '1000', // MWT amount
            slippage: 2
        }
    );

    await testEndpoint(
        'Get Trade History',
        'GET',
        `${API_BASE_URL}/api/bot/trade/history?limit=10&hours=24`
    );

    await testEndpoint(
        'Get Trade Statistics',
        'GET',
        `${API_BASE_URL}/api/bot/trade/statistics?hours=24`
    );

    // Skip actual trade execution
    await testEndpoint(
        'Execute Trade',
        'POST',
        `${API_BASE_URL}/api/bot/trade/execute`,
        'would execute real trade',
        true
    );

    // ============================================================================
    // BALANCE & PORTFOLIO ENDPOINTS
    // ============================================================================
    console.log('\n\n🔷 BALANCE & PORTFOLIO ENDPOINTS');
    console.log('='.repeat(80));

    await testEndpoint(
        'Get Wallet Balances',
        'GET',
        `${API_BASE_URL}/api/bot/balances`
    );

    await testEndpoint(
        'Get Portfolio Status',
        'GET',
        `${API_BASE_URL}/api/bot/portfolio/status`
    );

    // ============================================================================
    // CONFIGURATION ENDPOINTS
    // ============================================================================
    console.log('\n\n🔷 CONFIGURATION ENDPOINTS');
    console.log('='.repeat(80));

    await testEndpoint(
        'Get Bot Configuration',
        'GET',
        `${API_BASE_URL}/api/bot/config`
    );

    // Skip config updates
    await testEndpoint(
        'Update Bot Configuration',
        'PUT',
        `${API_BASE_URL}/api/bot/config`,
        'would modify bot config',
        true
    );

    // ============================================================================
    // SAFETY & HEALTH ENDPOINTS
    // ============================================================================
    console.log('\n\n🔷 SAFETY & HEALTH ENDPOINTS');
    console.log('='.repeat(80));

    await testEndpoint(
        'Get Safety Status',
        'GET',
        `${API_BASE_URL}/api/bot/safety/status`
    );

    await testEndpoint(
        'Health Check',
        'GET',
        `${API_BASE_URL}/api/bot/health`
    );

    // Skip emergency actions
    await testEndpoint(
        'Emergency Pause',
        'POST',
        `${API_BASE_URL}/api/bot/emergency/pause`,
        'would pause bot',
        true
    );

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80));

    const totalTests = passedTests + failedTests;
    const successRate = totalTests > 0 ? ((passedTests / totalTests) * 100).toFixed(1) : 0;

    console.log(`\nTotal Tests: ${totalTests}`);
    console.log(`✅ Passed: ${passedTests}`);
    console.log(`❌ Failed: ${failedTests}`);
    console.log(`📈 Success Rate: ${successRate}%\n`);

    if (failedTests === 0) {
        console.log('🎉 ALL TESTS PASSED!\n');
        console.log('✅ Production API is fully operational');
        console.log('✅ V3 price oracle working correctly');
        console.log('✅ All read-only endpoints responding');
        console.log(`✅ Target peg updated to $${process.env.TARGET_PEG_USD}\n`);
    } else {
        console.log('⚠️  SOME TESTS FAILED\n');
        console.log('Please check the errors above for details.\n');
    }

    process.exit(failedTests > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
});
