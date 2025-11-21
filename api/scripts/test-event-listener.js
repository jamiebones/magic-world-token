require('dotenv').config();
const { OrderBookEventListener } = require('../src/services');

console.log('🧪 Testing OrderBook Event Listener Initialization\n');

const testConfig = {
    contractAddress: process.env.ORDERBOOK_CONTRACT_ADDRESS_TESTNET || '0xe9Cd180b882830f9cbc9200eb40Ee2a5844649a6',
    network: 'bscTestnet',
    rpcUrl: process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    startBlock: 0,
    pollInterval: 15000
};

console.log('📋 Configuration:');
console.log('   Contract:', testConfig.contractAddress);
console.log('   Network:', testConfig.network);
console.log('   RPC URL:', testConfig.rpcUrl);
console.log('   Start Block:', testConfig.startBlock);
console.log('');

async function test() {
    try {
        console.log('⏳ Creating event listener instance...');
        const listener = OrderBookEventListener.getInstance(testConfig);
        console.log('✅ Event listener instance created');

        console.log('');
        console.log('⏳ Initializing event listener...');
        await listener.initialize();
        console.log('✅ Event listener initialized successfully');

        console.log('');
        console.log('⏳ Starting event listener...');
        await listener.start();
        console.log('✅ Event listener started successfully');

        console.log('');
        console.log('📊 Listener Status:');
        console.log('   Running:', listener.isRunning);
        console.log('   Contract:', listener.contractAddress);
        console.log('   Network:', listener.network);

        // Stop after 5 seconds
        console.log('');
        console.log('⏳ Listener will run for 5 seconds...');
        setTimeout(async () => {
            console.log('');
            console.log('⏳ Stopping event listener...');
            await listener.stop();
            console.log('✅ Event listener stopped successfully');
            process.exit(0);
        }, 5000);

    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('');
        console.error('Stack:', error.stack);
        process.exit(1);
    }
}

test();
