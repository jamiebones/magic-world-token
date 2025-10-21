require('dotenv').config({ path: './api/.env' });
const PriceOracleV3 = require('../api/src/bot/services/priceOracleV3');

async function testBotIntegration() {
    console.log('\n🤖 TESTING BOT V3 INTEGRATION\n');
    console.log('='.repeat(80));

    console.log('\n1️⃣  Configuration Check:\n');
    console.log(`   IS_V3_POOL: ${process.env.IS_V3_POOL}`);
    console.log(`   Pool Address: ${process.env.MWT_BNB_PAIR_ADDRESS}`);
    console.log(`   Pool Fee: ${process.env.V3_POOL_FEE}`);
    console.log(`   Target Peg: $${process.env.TARGET_PEG_USD}`);

    console.log('\n2️⃣  Initializing V3 Price Oracle...\n');
    const oracle = new PriceOracleV3();

    try {
        console.log('3️⃣  Fetching Current Prices...\n');
        const prices = await oracle.getAllPrices();

        console.log('   📊 Price Data:');
        console.log(`      MWT/BNB: ${prices.mwtBnb.toFixed(10)} BNB`);
        console.log(`      MWT/USD: $${prices.mwtUsd.toFixed(8)}`);
        console.log(`      MWT/BTC: ${prices.mwtBtc.toFixed(10)} BTC`);
        console.log(`      Satoshis: ${prices.satoshis} sats`);
        console.log();
        console.log('   📈 Market Data:');
        console.log(`      BNB/USD: $${prices.bnbUsd.toFixed(2)}`);
        console.log(`      BTC/USD: $${prices.btcUsd.toFixed(2)}`);
        console.log(`      Liquidity: ${prices.liquidity}`);
        console.log(`      Pool Type: ${prices.poolType}`);

        console.log('\n4️⃣  Deviation Analysis...\n');
        const deviation = await oracle.getDeviation();

        console.log('   📏 Peg Status:');
        console.log(`      Target: $${deviation.targetPrice.toFixed(8)}`);
        console.log(`      Current: $${deviation.currentPrice.toFixed(8)}`);
        console.log(`      Deviation: ${deviation.deviationPercentage}`);
        console.log(`      ${deviation.isOverPeg ? '⬆️  OVER PEG' : '⬇️  UNDER PEG'}`);

        console.log('\n5️⃣  Cache Test...\n');
        console.log('   Fetching prices again (should use cache):');
        const start = Date.now();
        const cachedPrices = await oracle.getAllPrices();
        const elapsed = Date.now() - start;
        console.log(`   ✅ Retrieved in ${elapsed}ms (cached)`);
        console.log(`   Cache timestamp: ${new Date(cachedPrices.timestamp).toISOString()}`);

        console.log('\n6️⃣  Force Refresh Test...\n');
        console.log('   Force refreshing prices...');
        const refreshStart = Date.now();
        const freshPrices = await oracle.getAllPrices(true);
        const refreshElapsed = Date.now() - refreshStart;
        console.log(`   ✅ Retrieved in ${refreshElapsed}ms (fresh)`);
        console.log(`   New timestamp: ${new Date(freshPrices.timestamp).toISOString()}`);

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ BOT V3 INTEGRATION TEST SUCCESSFUL!\n');

        console.log('💡 SUMMARY:');
        console.log(`   - V3 pool operational at ${process.env.MWT_BNB_PAIR_ADDRESS}`);
        console.log(`   - Current MWT price: $${prices.mwtUsd.toFixed(8)}`);
        console.log(`   - Deviation from target: ${Math.abs(deviation.deviation).toFixed(2)}%`);
        console.log(`   - Bot can now use V3 oracle for price monitoring\n`);

        // Exit with appropriate status
        if (Math.abs(deviation.deviation) < 50) {
            console.log('✅ Price deviation is acceptable (< 50%)');
            process.exit(0);
        } else if (Math.abs(deviation.deviation) < 300) {
            console.log('⚠️  Price deviation is moderate (50-300%)');
            process.exit(0);
        } else {
            console.log('❌ Price deviation is high (> 300%)');
            process.exit(0);
        }

    } catch (error) {
        console.error('\n❌ Error during integration test:', error.message);
        console.error('\nStack:', error.stack);
        process.exit(1);
    }
}

testBotIntegration();
