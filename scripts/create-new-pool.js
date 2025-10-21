/**
 * Create New MWT/BNB Pair on PancakeSwap
 * 
 * This script creates a completely fresh pair and adds initial liquidity
 * at the desired price without any dust interference.
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../api/.env') });

const FACTORY_ABI = [
    'function createPair(address tokenA, address tokenB) external returns (address pair)',
    'function getPair(address tokenA, address tokenB) external view returns (address pair)'
];

const ROUTER_ABI = [
    'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
    'function factory() external pure returns (address)'
];

const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)'
];

async function createNewPool() {
    console.log('\n🆕 Creating Fresh MWT/BNB Pool on PancakeSwap');
    console.log('='.repeat(70));

    const provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);

    const privateKey = process.env.BOT_WALLET_PRIVATE_KEY.startsWith('0x')
        ? process.env.BOT_WALLET_PRIVATE_KEY
        : `0x${process.env.BOT_WALLET_PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(privateKey, provider);

    const routerContract = new ethers.Contract(
        process.env.PANCAKE_ROUTER_ADDRESS,
        ROUTER_ABI,
        wallet
    );

    // Get factory address from router
    const factoryAddress = await routerContract.factory();
    console.log(`\n📍 PancakeSwap Factory: ${factoryAddress}`);

    const factoryContract = new ethers.Contract(
        factoryAddress,
        FACTORY_ABI,
        wallet
    );

    const tokenContract = new ethers.Contract(
        process.env.TOKEN_CONTRACT_ADDRESS,
        ERC20_ABI,
        wallet
    );

    console.log(`📍 MWT Token: ${process.env.TOKEN_CONTRACT_ADDRESS}`);
    console.log(`📍 WBNB: ${process.env.WBNB_ADDRESS}`);
    console.log(`📍 Your Wallet: ${wallet.address}\n`);

    // Check if pair already exists
    const existingPair = await factoryContract.getPair(
        process.env.TOKEN_CONTRACT_ADDRESS,
        process.env.WBNB_ADDRESS
    );

    if (existingPair !== '0x0000000000000000000000000000000000000000') {
        console.log(`⚠️  Pair already exists: ${existingPair}`);
        console.log(`   This is the old pool with dust.\n`);
        console.log(`❌ Cannot create new pair - one already exists!`);
        console.log(`\n💡 Solution: You must use a different approach:`);
        console.log(`   1. Deploy a new version of your token contract`);
        console.log(`   2. Or work with the existing pool`);
        console.log(`   3. Or use a different DEX (Biswap, ApeSwap, etc.)\n`);
        process.exit(1);
    }

    // Parse command line arguments
    const args = process.argv.slice(2);
    let bnbAmount = null;
    let mwtAmount = null;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--bnb' && args[i + 1]) {
            bnbAmount = parseFloat(args[i + 1]);
        }
        if (args[i] === '--mwt' && args[i + 1]) {
            mwtAmount = parseFloat(args[i + 1]);
        }
    }

    if (!bnbAmount || !mwtAmount) {
        console.log('❌ Error: Must specify both --bnb and --mwt amounts');
        console.log('\nUsage:');
        console.log('  node scripts/create-new-pool.js --bnb 0.3 --mwt 3000000\n');
        process.exit(1);
    }

    const targetPegUSD = parseFloat(process.env.TARGET_PEG_USD || '0.0001');

    console.log('📊 POOL CREATION PLAN:');
    console.log('='.repeat(70));
    console.log(`\n   Initial Liquidity:`);
    console.log(`   - BNB: ${bnbAmount} BNB`);
    console.log(`   - MWT: ${mwtAmount.toLocaleString()} MWT`);
    console.log(`\n   Expected Price:`);
    console.log(`   - MWT/BNB: ${(bnbAmount / mwtAmount).toFixed(10)} BNB per MWT`);

    // Get BNB price from Chainlink to estimate USD price
    const CHAINLINK_ABI = [
        'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
        'function decimals() external view returns (uint8)'
    ];

    const chainlinkBNBUSD = new ethers.Contract(
        process.env.CHAINLINK_BNB_USD_FEED,
        CHAINLINK_ABI,
        provider
    );

    const [, answer, , ,] = await chainlinkBNBUSD.latestRoundData();
    const decimals = await chainlinkBNBUSD.decimals();
    const bnbUsdPrice = Number(answer) / Math.pow(10, Number(decimals));

    const mwtBnbPrice = bnbAmount / mwtAmount;
    const mwtUsdPrice = mwtBnbPrice * bnbUsdPrice;

    console.log(`   - MWT/USD: $${mwtUsdPrice.toFixed(6)}`);
    console.log(`   - Target: $${targetPegUSD}`);
    console.log(`   - Deviation: ${(((mwtUsdPrice - targetPegUSD) / targetPegUSD) * 100).toFixed(2)}%\n`);

    console.log(`\n⚠️  WARNING: This will create a NEW pair address!`);
    console.log(`   Update your .env with the new pair address after creation.\n`);

    console.log(`Press Ctrl+C to cancel, or the script will continue in 5 seconds...`);
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Step 1: Create the pair
    console.log('\n🏗️  Step 1: Creating new pair...');
    const createTx = await factoryContract.createPair(
        process.env.TOKEN_CONTRACT_ADDRESS,
        process.env.WBNB_ADDRESS
    );
    console.log(`⏳ Transaction: ${createTx.hash}`);
    await createTx.wait();

    const newPairAddress = await factoryContract.getPair(
        process.env.TOKEN_CONTRACT_ADDRESS,
        process.env.WBNB_ADDRESS
    );

    console.log(`✅ New pair created: ${newPairAddress}\n`);

    // Step 2: Approve tokens
    console.log('🏗️  Step 2: Approving MWT tokens...');
    const mwtAmountWei = ethers.parseUnits(mwtAmount.toFixed(18), 18);

    const allowance = await tokenContract.allowance(wallet.address, process.env.PANCAKE_ROUTER_ADDRESS);

    if (allowance < mwtAmountWei) {
        const approveTx = await tokenContract.approve(
            process.env.PANCAKE_ROUTER_ADDRESS,
            mwtAmountWei
        );
        console.log(`⏳ Approval TX: ${approveTx.hash}`);
        await approveTx.wait();
        console.log(`✅ Tokens approved\n`);
    } else {
        console.log(`✅ Tokens already approved\n`);
    }

    // Step 3: Add liquidity
    console.log('🏗️  Step 3: Adding initial liquidity...');

    const bnbAmountWei = ethers.parseUnits(bnbAmount.toFixed(18), 18);
    const mwtMinWei = ethers.parseUnits((mwtAmount * 0.95).toFixed(18), 18); // 5% slippage
    const bnbMinWei = ethers.parseUnits((bnbAmount * 0.95).toFixed(18), 18);
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    console.log(`   Adding: ${bnbAmount} BNB + ${mwtAmount.toLocaleString()} MWT`);

    const addLiquidityTx = await routerContract.addLiquidityETH(
        process.env.TOKEN_CONTRACT_ADDRESS,
        mwtAmountWei,
        mwtMinWei,
        bnbMinWei,
        wallet.address,
        deadline,
        { value: bnbAmountWei }
    );

    console.log(`⏳ Transaction: ${addLiquidityTx.hash}`);
    console.log(`   View on BSCScan: https://bscscan.com/tx/${addLiquidityTx.hash}`);

    const receipt = await addLiquidityTx.wait();
    console.log(`✅ Liquidity added! Gas used: ${receipt.gasUsed.toString()}\n`);

    // Summary
    console.log('='.repeat(70));
    console.log('✅ NEW POOL CREATED SUCCESSFULLY!');
    console.log('='.repeat(70));
    console.log(`\n📍 New Pair Address: ${newPairAddress}`);
    console.log(`\n🔧 UPDATE YOUR .env FILE:`);
    console.log(`   Change MWT_BNB_PAIR_ADDRESS from:`);
    console.log(`   ${process.env.MWT_BNB_PAIR_ADDRESS}`);
    console.log(`   To:`);
    console.log(`   ${newPairAddress}\n`);
    console.log(`📊 Initial State:`);
    console.log(`   - MWT/USD Price: $${mwtUsdPrice.toFixed(6)}`);
    console.log(`   - Total Liquidity: ~$${(bnbAmount * bnbUsdPrice * 2).toFixed(2)}`);
    console.log(`\n🔗 View Pool:`);
    console.log(`   https://pancakeswap.finance/info/v2/pairs/${newPairAddress}`);
    console.log(`\n✅ You can now use your trading bot with this new pool!\n`);
}

createNewPool().catch(error => {
    console.error('\n❌ Error:', error.message);
    if (error.reason) {
        console.error(`   Reason: ${error.reason}`);
    }
    process.exit(1);
});
