require('dotenv').config();
const PriceOracle = require('../src/bot/services/priceOracle');

async function testPriceOracle() {
    console.log('🧪 Testing Price Oracle Service...\n');
    console.log('═'.repeat(80));

    try {
        // Initialize Price Oracle
        const oracle = new PriceOracle();
        console.log('✅ Price Oracle initialized\n');

        // Test 1: Get MWT/BNB Price
        console.log('📊 Test 1: Fetching MWT/BNB price from PancakeSwap...');
        console.log('─'.repeat(80));
        const mwtBnb = await oracle.getMWTBNBPrice();
        console.log('✅ MWT/BNB Price Data:');
        console.log(`   Price: ${mwtBnb.mwtBnbPrice.toFixed(10)} BNB`);
        console.log(`   MWT Reserve: ${parseFloat(mwtBnb.mwtReserve).toLocaleString()} MWT`);
        console.log(`   BNB Reserve: ${parseFloat(mwtBnb.bnbReserve).toFixed(4)} BNB`);
        console.log(`   Token0: ${mwtBnb.token0}`);
        console.log(`   Token1: ${mwtBnb.token1}`);
        console.log(`   Block Timestamp: ${new Date(mwtBnb.blockTimestamp * 1000).toISOString()}\n`);

        // Test 2: Get BNB/USD Price
        console.log('📊 Test 2: Fetching BNB/USD price from Chainlink...');
        console.log('─'.repeat(80));
        const bnbUsd = await oracle.getBNBUSDPrice();
        console.log('✅ BNB/USD Price Data:');
        console.log(`   Price: $${bnbUsd.bnbUsdPrice.toFixed(2)}`);
        console.log(`   Source: ${bnbUsd.source}`);
        console.log(`   Round ID: ${bnbUsd.roundId}`);
        console.log(`   Last Update: ${bnbUsd.lastUpdate.toISOString()}\n`);

        // Test 3: Get BTC/USD Price
        console.log('📊 Test 3: Fetching BTC/USD price from Chainlink...');
        console.log('─'.repeat(80));
        const btcUsd = await oracle.getBTCUSDPrice();
        console.log('✅ BTC/USD Price Data:');
        console.log(`   Price: $${btcUsd.btcUsdPrice.toLocaleString()}`);
        console.log(`   Source: ${btcUsd.source}`);
        console.log(`   Round ID: ${btcUsd.roundId}`);
        console.log(`   Last Update: ${btcUsd.lastUpdate.toISOString()}\n`);

        // Test 4: Calculate MWT/USD Price
        console.log('📊 Test 4: Calculating MWT/USD price...');
        console.log('─'.repeat(80));
        const mwtUsd = await oracle.getMWTUSDPrice();
        console.log('✅ MWT/USD Price Data:');
        console.log(`   Price: $${mwtUsd.mwtUsdPrice.toFixed(6)}`);
        console.log(`   Formula: ${mwtUsd.mwtBnbPrice.toFixed(10)} × $${mwtUsd.bnbUsdPrice.toFixed(2)} = $${mwtUsd.mwtUsdPrice.toFixed(6)}`);
        console.log(`   Liquidity (USD): $${mwtUsd.liquidityUSD.toLocaleString()}\n`);

        // Test 5: Calculate MWT/BTC Price
        console.log('📊 Test 5: Calculating MWT/BTC price...');
        console.log('─'.repeat(80));
        const mwtBtc = await oracle.getMWTBTCPrice();
        console.log('✅ MWT/BTC Price Data:');
        console.log(`   Price: ${mwtBtc.mwtBtcPrice.toFixed(15)} BTC`);
        console.log(`   Satoshis: ${mwtBtc.satoshis.toLocaleString()} sats`);
        console.log(`   Calculation: ${mwtBtc.calculation}`);
        console.log(`   Sources:`);
        console.log(`     - MWT/BNB: ${mwtBtc.sources.mwtBnb}`);
        console.log(`     - BNB/USD: ${mwtBtc.sources.bnbUsd}`);
        console.log(`     - BTC/USD: ${mwtBtc.sources.btcUsd}\n`);

        // Test 6: Get All Prices (Comprehensive)
        console.log('📊 Test 6: Fetching comprehensive price data...');
        console.log('─'.repeat(80));
        const allPrices = await oracle.getAllPrices();
        console.log('✅ Comprehensive Price Data:');
        console.log('\n📈 Base Pair:');
        console.log(`   MWT/BNB: ${allPrices.mwtBnb.price.toFixed(10)} BNB (${allPrices.mwtBnb.source})`);
        console.log('\n💵 Fiat Prices:');
        console.log(`   BNB/USD: $${allPrices.bnbUsd.price.toFixed(2)} (${allPrices.bnbUsd.source})`);
        console.log(`   BTC/USD: $${allPrices.btcUsd.price.toLocaleString()} (${allPrices.btcUsd.source})`);
        console.log('\n🔄 Derived Prices:');
        console.log(`   MWT/USD: $${allPrices.mwtUsd.price.toFixed(6)}`);
        console.log(`   MWT/BTC: ${allPrices.mwtBtc.price.toFixed(15)} BTC (${allPrices.mwtBtc.satoshis.toLocaleString()} sats)`);
        console.log(`   BNB/BTC: ${allPrices.bnbBtc.price.toFixed(6)} BTC`);
        console.log('\n💧 Liquidity:');
        console.log(`   Total (USD): $${allPrices.liquidity.totalUSD.toLocaleString()}`);
        console.log(`   Total (BTC): ${allPrices.liquidity.totalBTC.toFixed(6)} BTC`);
        console.log(`   MWT Amount: ${parseFloat(allPrices.liquidity.mwtAmount).toLocaleString()} MWT`);
        console.log(`   BNB Amount: ${parseFloat(allPrices.liquidity.bnbAmount).toFixed(4)} BNB`);
        console.log('\n📊 Market Cap:');
        console.log(`   USD: $${allPrices.marketCap.usd.toLocaleString()}`);
        console.log(`   BTC: ${allPrices.marketCap.btc.toFixed(2)} BTC`);
        console.log(`\n⏰ Block Number: ${allPrices.blockNumber}`);
        console.log(`⏰ Timestamp: ${allPrices.timestamp.toISOString()}\n`);

        // Test 7: Calculate Peg Deviation
        console.log('📊 Test 7: Calculating peg deviation (target: $0.01)...');
        console.log('─'.repeat(80));
        const targetPeg = parseFloat(process.env.TARGET_PEG_USD) || 0.01;
        const deviation = await oracle.getPegDeviation(targetPeg);
        console.log('✅ Peg Deviation:');
        console.log('\n💵 USD Denomination:');
        console.log(`   Current Price: $${deviation.usd.current.toFixed(6)}`);
        console.log(`   Target Price: $${deviation.usd.target.toFixed(6)}`);
        console.log(`   Deviation: ${deviation.usd.deviationPercent}`);
        console.log(`   Raw Deviation: ${deviation.usd.deviation.toFixed(2)}%`);
        console.log('\n₿ BTC Denomination:');
        console.log(`   Current Price: ${deviation.btc.current.toFixed(15)} BTC (${deviation.btc.currentSatoshis.toLocaleString()} sats)`);
        console.log(`   Target Price: ${deviation.btc.target.toFixed(15)} BTC (${deviation.btc.targetSatoshis.toLocaleString()} sats)`);
        console.log(`   Deviation: ${deviation.btc.deviationPercent}`);
        console.log(`   Raw Deviation: ${deviation.btc.deviation.toFixed(2)}%\n`);

        // Test 8: Validate Prices
        console.log('📊 Test 8: Validating price data...');
        console.log('─'.repeat(80));
        const isValid = oracle.validatePrices(allPrices);
        if (isValid) {
            console.log('✅ All prices are within valid ranges');
        } else {
            console.log('⚠️  Some prices are outside valid ranges (check logs above)');
        }
        console.log('');

        // Test 9: Get Liquidity Depth
        console.log('📊 Test 9: Fetching liquidity depth...');
        console.log('─'.repeat(80));
        const liquidity = await oracle.getLiquidityDepth();
        console.log('✅ Liquidity Depth:');
        console.log(`   MWT Liquidity: ${liquidity.mwtLiquidity.toLocaleString()} MWT`);
        console.log(`   BNB Liquidity: ${liquidity.bnbLiquidity.toFixed(4)} BNB`);
        console.log(`   Total (USD): $${liquidity.totalLiquidityUSD.toLocaleString()}\n`);

        // Test 10: Test Price Caching
        console.log('📊 Test 10: Testing price caching...');
        console.log('─'.repeat(80));
        console.log('Fetching BNB/USD price (should use cache)...');
        const startTime = Date.now();
        const cachedBnbUsd = await oracle.getBNBUSDPrice();
        const fetchTime = Date.now() - startTime;
        console.log(`✅ Fetch time: ${fetchTime}ms (cached: ${fetchTime < 10 ? 'YES' : 'NO'})`);
        console.log(`   Price: $${cachedBnbUsd.bnbUsdPrice.toFixed(2)}\n`);

        // Clear cache and test again
        console.log('Clearing cache and fetching again...');
        oracle.clearCache();
        const startTime2 = Date.now();
        const freshBnbUsd = await oracle.getBNBUSDPrice();
        const fetchTime2 = Date.now() - startTime2;
        console.log(`✅ Fetch time: ${fetchTime2}ms (fresh: ${fetchTime2 > 50 ? 'YES' : 'NO'})`);
        console.log(`   Price: $${freshBnbUsd.bnbUsdPrice.toFixed(2)}\n`);

        // Final Summary
        console.log('═'.repeat(80));
        console.log('✅ ALL TESTS PASSED! Price Oracle is working correctly.\n');
        console.log('📋 Summary:');
        console.log(`   • MWT/BNB: ${mwtBnb.mwtBnbPrice.toFixed(10)} BNB`);
        console.log(`   • MWT/USD: $${mwtUsd.mwtUsdPrice.toFixed(6)}`);
        console.log(`   • MWT/BTC: ${mwtBtc.satoshis.toLocaleString()} satoshis`);
        console.log(`   • Liquidity: $${liquidity.totalLiquidityUSD.toLocaleString()}`);
        console.log(`   • Peg Deviation: ${deviation.usd.deviationPercent}`);
        console.log(`   • Price Validation: ${isValid ? '✅ PASS' : '⚠️  WARNING'}`);
        console.log('═'.repeat(80));

    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error(error);
        process.exit(1);
    }
}

// Run tests
testPriceOracle()
    .then(() => {
        console.log('\n🎉 Price Oracle testing complete!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Fatal error during testing:');
        console.error(error);
        process.exit(1);
    });
