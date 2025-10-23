require('dotenv').config({ path: './api/.env' });
const PriceOracleV3 = require('../api/src/bot/services/priceOracleV3');

async function main() {
    console.log('\n🔍 TESTING V3 PRICE ORACLE\n');
    console.log('='.repeat(80));

    // Update pool address to V3
    process.env.MWT_BNB_PAIR_ADDRESS = '0x88AEBA95750Aa6aEF25CD3B696B0BDa53DabE2d8';
    process.env.MWT_TOKEN_ADDRESS = '0x73331cb65cfb32b609178B75F70e00216b788401';

    console.log('\n📍 Configuration:');
    console.log(`   V3 Pool: ${process.env.MWT_BNB_PAIR_ADDRESS}`);
    console.log(`   MWG Token: ${process.env.MWT_TOKEN_ADDRESS}`);
    console.log(`   Target Peg: $${process.env.TARGET_PEG_USD}`);

    const oracle = new PriceOracleV3();

    try {
        console.log('\n\n1️⃣  Fetching MWG/BNB price from V3 pool...\n');
        const mwtBnbPrice = await oracle.getMWTBNBPrice();
        console.log(`   ✅ MWG/BNB: ${mwtBnbPrice.toFixed(10)} BNB per MWG`);

        console.log('\n2️⃣  Fetching BNB/USD from Chainlink...\n');
        const bnbUsdPrice = await oracle.getBNBUSDPrice();
        console.log(`   ✅ BNB/USD: $${bnbUsdPrice.toFixed(2)}`);

        console.log('\n3️⃣  Fetching BTC/USD from Chainlink...\n');
        const btcUsdPrice = await oracle.getBTCUSDPrice();
        console.log(`   ✅ BTC/USD: $${btcUsdPrice.toFixed(2)}`);

        console.log('\n4️⃣  Calculating derived prices...\n');
        const mwtUsdPrice = mwtBnbPrice * bnbUsdPrice;
        const mwtBtcPrice = mwtUsdPrice / btcUsdPrice;
        const satoshis = Math.round(mwtBtcPrice * 100000000);

        console.log(`   ✅ MWG/USD: $${mwtUsdPrice.toFixed(8)}`);
        console.log(`   ✅ MWG/BTC: ${mwtBtcPrice.toFixed(10)} BTC`);
        console.log(`   ✅ Satoshis: ${satoshis.toLocaleString()} sats`);

        console.log('\n5️⃣  Checking pool liquidity...\n');
        const liquidity = await oracle.getLiquidity();
        console.log(`   ✅ Liquidity: ${liquidity}`);

        console.log('\n6️⃣  Getting all prices (cached)...\n');
        const allPrices = await oracle.getAllPrices();

        console.log('   📊 Complete Price Data:');
        console.log(`      MWG/BNB: ${allPrices.mwtBnb.toFixed(10)}`);
        console.log(`      BNB/USD: $${allPrices.bnbUsd.toFixed(2)}`);
        console.log(`      BTC/USD: $${allPrices.btcUsd.toFixed(2)}`);
        console.log(`      MWG/USD: $${allPrices.mwtUsd.toFixed(8)}`);
        console.log(`      MWG/BTC: ${allPrices.mwtBtc.toFixed(10)}`);
        console.log(`      Satoshis: ${allPrices.satoshis.toLocaleString()}`);
        console.log(`      Liquidity: ${allPrices.liquidity}`);
        console.log(`      Pool Type: ${allPrices.poolType}`);

        console.log('\n7️⃣  Calculating deviation from target peg...\n');
        const deviation = await oracle.getDeviation();

        console.log('   📈 Deviation Analysis:');
        console.log(`      Current Price: $${deviation.currentPrice.toFixed(8)}`);
        console.log(`      Target Price: $${deviation.targetPrice.toFixed(8)}`);
        console.log(`      Deviation: ${deviation.deviationPercentage}`);
        console.log(`      Over Peg: ${deviation.isOverPeg ? 'YES ⬆️' : 'NO'}`);
        console.log(`      Under Peg: ${deviation.isUnderPeg ? 'YES ⬇️' : 'NO'}`);

        console.log('\n' + '='.repeat(80));
        console.log('\n✅ V3 PRICE ORACLE TEST COMPLETE!\n');

        // Compare to expected values
        const targetPeg = parseFloat(process.env.TARGET_PEG_USD);
        const deviationPercent = Math.abs(deviation.deviation);

        console.log('💡 RESULTS:');
        if (deviationPercent < 10) {
            console.log(`   ✅ Deviation is ${deviationPercent.toFixed(2)}% - Within acceptable range!`);
        } else if (deviationPercent < 50) {
            console.log(`   ⚠️  Deviation is ${deviationPercent.toFixed(2)}% - Slightly off target`);
        } else {
            console.log(`   ❌ Deviation is ${deviationPercent.toFixed(2)}% - Needs adjustment`);
        }

        console.log(`\n   Your MWG is currently priced at $${deviation.currentPrice.toFixed(8)}`);
        console.log(`   Target is $${targetPeg.toFixed(8)}`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        console.error('\nStack:', error.stack);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Fatal error:', error);
        process.exit(1);
    });
