require('dotenv').config({ path: './api/.env' });
const { ethers } = require('ethers');

// PancakeSwap V3 addresses on BSC
const V3_FACTORY_ADDRESS = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
const V3_POSITION_MANAGER_ADDRESS = '0x46A15B0b27311cedF172AB29E4f4766fbE7F4364';

// ABIs
const V3_FACTORY_ABI = [
    'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'
];

const V3_POOL_ABI = [
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'function fee() external view returns (uint24)',
    'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
    'function liquidity() external view returns (uint128)',
    'function tickSpacing() external view returns (int24)'
];

const V3_POSITION_MANAGER_ABI = [
    'function balanceOf(address owner) external view returns (uint256)',
    'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
    'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

const ERC20_ABI = [
    'function decimals() external view returns (uint8)',
    'function symbol() external view returns (string)'
];

async function main() {
    const provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);
    const botWallet = process.env.BOT_WALLET_ADDRESS;
    const mwtAddress = process.env.MWT_TOKEN_ADDRESS || '0x73331cb65cfb32b609178B75F70e00216b788401';
    const wbnbAddress = process.env.WBNB_ADDRESS;

    console.log('\n🔍 SEARCHING FOR V3 POOL...\n');
    console.log('='.repeat(80));

    // Connect to factory
    const factory = new ethers.Contract(V3_FACTORY_ADDRESS, V3_FACTORY_ABI, provider);

    // V3 has multiple fee tiers: 0.01% (100), 0.05% (500), 0.25% (2500), 1% (10000)
    const feeTiers = [100, 500, 2500, 10000];
    const pools = [];

    console.log('\n1️⃣  Checking all fee tiers for MWT/BNB pools...\n');

    for (const fee of feeTiers) {
        try {
            const poolAddress = await factory.getPool(mwtAddress, wbnbAddress, fee);

            if (poolAddress !== ethers.ZeroAddress) {
                console.log(`   ✅ Found pool at fee tier ${fee / 10000}%: ${poolAddress}`);
                pools.push({ fee, address: poolAddress });
            } else {
                console.log(`   ❌ No pool at fee tier ${fee / 10000}%`);
            }
        } catch (error) {
            console.log(`   ⚠️  Error checking fee tier ${fee / 10000}%:`, error.message);
        }
    }

    if (pools.length === 0) {
        console.log('\n❌ No V3 pools found for MWT/BNB!');
        console.log('   This means the transaction may have created a pool that needs time to propagate.');
        return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n2️⃣  Analyzing pool details...\n');

    for (const { fee, address } of pools) {
        console.log(`\n📊 Pool at ${fee / 10000}% fee tier:`);
        console.log(`   Address: ${address}\n`);

        try {
            const pool = new ethers.Contract(address, V3_POOL_ABI, provider);

            const token0 = await pool.token0();
            const token1 = await pool.token1();
            const liquidity = await pool.liquidity();
            const slot0 = await pool.slot0();

            // Get token symbols
            const token0Contract = new ethers.Contract(token0, ERC20_ABI, provider);
            const token1Contract = new ethers.Contract(token1, ERC20_ABI, provider);
            const symbol0 = await token0Contract.symbol();
            const symbol1 = await token1Contract.symbol();
            const decimals0 = await token0Contract.decimals();
            const decimals1 = await token1Contract.decimals();

            console.log(`   Token0: ${symbol0} (${token0})`);
            console.log(`   Token1: ${symbol1} (${token1})`);
            console.log(`   Liquidity: ${liquidity.toString()}`);
            console.log(`   Current Tick: ${slot0.tick}`);
            console.log(`   sqrtPriceX96: ${slot0.sqrtPriceX96.toString()}`);

            // Calculate price from sqrtPriceX96
            // price = (sqrtPriceX96 / 2^96)^2
            const sqrtPriceX96 = BigInt(slot0.sqrtPriceX96.toString());
            const Q96 = BigInt(2) ** BigInt(96);
            const price = Number(sqrtPriceX96 * sqrtPriceX96 * BigInt(10 ** 18)) / Number(Q96 * Q96);

            // Adjust for decimals
            const priceAdjusted = price / (10 ** (Number(decimals1) - Number(decimals0)));

            console.log(`\n   💰 Current Price:`);
            if (symbol0 === 'MWT') {
                console.log(`      1 ${symbol0} = ${priceAdjusted.toFixed(10)} ${symbol1}`);
                console.log(`      1 ${symbol0} = $${(priceAdjusted * 1066).toFixed(6)} USD (assuming BNB = $1066)`);
            } else {
                const invertedPrice = 1 / priceAdjusted;
                console.log(`      1 MWT = ${invertedPrice.toFixed(10)} ${symbol1}`);
                console.log(`      1 MWT = $${(invertedPrice * 1066).toFixed(6)} USD (assuming BNB = $1066)`);
            }

            if (liquidity > 0) {
                console.log(`\n   ✅ This pool has liquidity!`);
            } else {
                console.log(`\n   ⚠️  This pool has no liquidity`);
            }

        } catch (error) {
            console.log(`   ❌ Error reading pool: ${error.message}`);
        }
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n3️⃣  Checking your V3 positions...\n');

    try {
        const positionManager = new ethers.Contract(
            V3_POSITION_MANAGER_ADDRESS,
            V3_POSITION_MANAGER_ABI,
            provider
        );

        const balance = await positionManager.balanceOf(botWallet);
        console.log(`   You have ${balance} V3 position NFT(s)\n`);

        if (balance > 0) {
            for (let i = 0; i < balance; i++) {
                const tokenId = await positionManager.tokenOfOwnerByIndex(botWallet, i);
                console.log(`   📍 Position #${i + 1} (NFT ID: ${tokenId}):`);

                const position = await positionManager.positions(tokenId);

                // Get token symbols
                const token0Contract = new ethers.Contract(position.token0, ERC20_ABI, provider);
                const token1Contract = new ethers.Contract(position.token1, ERC20_ABI, provider);
                const symbol0 = await token0Contract.symbol();
                const symbol1 = await token1Contract.symbol();

                console.log(`      Pair: ${symbol0}/${symbol1}`);
                console.log(`      Fee: ${position.fee / 10000}%`);
                console.log(`      Tick Range: [${position.tickLower}, ${position.tickUpper}]`);
                console.log(`      Liquidity: ${position.liquidity.toString()}`);
                console.log(`      Fees Owed: ${ethers.formatEther(position.tokensOwed0)} ${symbol0}, ${ethers.formatEther(position.tokensOwed1)} ${symbol1}`);
                console.log();
            }
        }

    } catch (error) {
        console.log(`   ❌ Error checking positions: ${error.message}`);
    }

    console.log('='.repeat(80));
    console.log('\n✅ SEARCH COMPLETE!\n');

    if (pools.length > 0) {
        console.log('💡 RECOMMENDATION:');
        console.log(`   Update your .env file with the pool that has liquidity:`);
        console.log(`   MWT_BNB_PAIR_ADDRESS=${pools[0].address}`);
        console.log(`   V3_POOL_FEE=${pools[0].fee}`);
        console.log(`   IS_V3_POOL=true\n`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('\n❌ Error:', error);
        process.exit(1);
    });
