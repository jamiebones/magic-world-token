const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Create PancakeSwap V3 Pool with Correct Initial Price
 * 
 * This script creates a new V3 pool with the correct initial price
 * for the MWG/WBNB pair.
 * 
 * Usage:
 * npx hardhat run scripts/create-pool-v3.js --network bscTestnet
 */

// PancakeSwap V3 Addresses (BSC Testnet)
const PANCAKE_V3_POSITION_MANAGER = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364";
const WBNB_ADDRESS = "0xae13d989dac2f0debff460ac112a837c89baa7cd";

// Configuration
const CONFIG = {
    // Fee tier: 500 = 0.05% (using different tier since 0.25% pool exists with wrong price)
    FEE_TIER: 500,

    // Target price: $0.0003 per MWG
    TARGET_PRICE_USD: 0.0003,

    // BNB price in USD
    BNB_PRICE_USD: 1110, // Update this to current BNB price
};

// ABIs
const POSITION_MANAGER_ABI = [
    "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)"
];

const FACTORY_ABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const ERC20_ABI = [
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)"
];

/**
 * Calculate sqrtPriceX96 from USD price
 */
function calculateSqrtPriceX96(mwgPriceUSD, bnbPriceUSD, token0IsMWG) {
    // Calculate BNB per MWG
    const bnbPerMWG = mwgPriceUSD / bnbPriceUSD;

    console.log("\n📊 Price Calculation:");
    console.log(`  MWG Price: $${mwgPriceUSD}`);
    console.log(`  BNB Price: $${bnbPriceUSD}`);
    console.log(`  BNB per MWG: ${bnbPerMWG}`);
    console.log(`  MWG per BNB: ${1 / bnbPerMWG}`);

    // In V3, sqrtPriceX96 = sqrt(token1/token0) * 2^96
    // If token0 is MWG and token1 is WBNB: price = WBNB/MWG = bnbPerMWG
    // If token0 is WBNB and token1 is MWG: price = MWG/WBNB = 1/bnbPerMWG
    const priceT1perT0 = token0IsMWG ? bnbPerMWG : (1 / bnbPerMWG);

    const sqrtPrice = Math.sqrt(priceT1perT0);
    const Q96 = BigInt(2) ** BigInt(96);
    const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));

    // Calculate corresponding tick
    const tick = Math.floor(Math.log(priceT1perT0) / Math.log(1.0001));

    console.log(`\n🎯 V3 Pool Parameters:`);
    console.log(`  token0 is MWG: ${token0IsMWG}`);
    console.log(`  Price (token1/token0): ${priceT1perT0}`);
    console.log(`  sqrtPrice: ${sqrtPrice}`);
    console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}`);
    console.log(`  Equivalent tick: ~${tick}`);

    return sqrtPriceX96;
}

/**
 * Get token order (token0 < token1 by address)
 */
function getTokenOrder(tokenA, tokenB) {
    const token0 = tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenA : tokenB;
    const token1 = tokenA.toLowerCase() < tokenB.toLowerCase() ? tokenB : tokenA;
    return { token0, token1, token0IsMWG: token0.toLowerCase() === tokenA.toLowerCase() };
}

async function main() {
    console.log("🏊 Creating PancakeSwap V3 Pool with Correct Price...\n");

    // Get network
    const network = await ethers.provider.getNetwork();
    console.log(`📡 Network: ${network.name} (chainId: ${network.chainId})`);

    if (network.chainId !== 97n && network.chainId !== 56n) {
        throw new Error("This script is for BSC Testnet (97) or BSC Mainnet (56)");
    }

    // Get signer
    const [deployer] = await ethers.getSigners();
    console.log(`👛 Deployer: ${deployer.address}`);

    // Get MWG token address from deployments
    const fs = require('fs');
    const path = require('path');
    const deploymentFile = network.chainId === 97n ? 'bscTestnet.json' : 'bsc.json';
    const deploymentPath = path.join(__dirname, '..', 'deployments', deploymentFile);

    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`Deployment file not found: ${deploymentPath}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    const MWG_ADDRESS = deployment.contracts.token.address;

    console.log(`\n📋 Contract Addresses:`);
    console.log(`  MWG Token: ${MWG_ADDRESS}`);
    console.log(`  WBNB: ${WBNB_ADDRESS}`);
    console.log(`  Position Manager: ${PANCAKE_V3_POSITION_MANAGER}`);
    console.log(`  Fee Tier: ${CONFIG.FEE_TIER / 10000}%`);

    // Get token symbols
    const mwgToken = new ethers.Contract(MWG_ADDRESS, ERC20_ABI, deployer);
    const wbnbToken = new ethers.Contract(WBNB_ADDRESS, ERC20_ABI, deployer);
    const mwgSymbol = await mwgToken.symbol();
    const wbnbSymbol = await wbnbToken.symbol();

    console.log(`\n🪙 Token Pair: ${mwgSymbol}/${wbnbSymbol}`);

    // Determine token order
    const { token0, token1, token0IsMWG } = getTokenOrder(MWG_ADDRESS, WBNB_ADDRESS);
    console.log(`\n📊 Token Order (sorted by address):`);
    console.log(`  token0: ${token0} (${token0IsMWG ? mwgSymbol : wbnbSymbol})`);
    console.log(`  token1: ${token1} (${token0IsMWG ? wbnbSymbol : mwgSymbol})`);

    // Calculate sqrtPriceX96
    const sqrtPriceX96 = calculateSqrtPriceX96(
        CONFIG.TARGET_PRICE_USD,
        CONFIG.BNB_PRICE_USD,
        token0IsMWG
    );

    // Connect to Position Manager
    const positionManager = new ethers.Contract(
        PANCAKE_V3_POSITION_MANAGER,
        POSITION_MANAGER_ABI,
        deployer
    );

    // Check if pool already exists
    const FACTORY_ADDRESS = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
    const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, deployer);
    const existingPool = await factory.getPool(token0, token1, CONFIG.FEE_TIER);

    console.log(`\n🔍 Checking for existing pool...`);
    console.log(`  Existing pool address: ${existingPool}`);

    if (existingPool !== ethers.ZeroAddress) {
        console.log(`\n⚠️  WARNING: A pool already exists at ${existingPool}`);
        console.log(`\n❓ Do you want to:`);
        console.log(`  1. Continue and try to initialize it (if not initialized)`);
        console.log(`  2. Cancel and check the existing pool first`);
        console.log(`\n💡 Note: If the pool is already initialized, this transaction will revert.`);
        console.log(`         The old pool at 0xbF2D99D14770022245c6AB5B23E9AA90AB8534B8 will remain.`);
        console.log(`\n⏸️  Script paused. Please verify the existing pool and decide:`);
        console.log(`  - If you want a fresh pool, you may need to use a different fee tier`);
        console.log(`  - Or check if the existing pool is the one you want to fix`);
        return;
    }

    console.log(`\n✅ No existing pool found. Safe to create new pool.`);

    // Create and initialize pool
    console.log(`\n🚀 Creating and initializing pool...`);
    console.log(`\n⚠️  IMPORTANT: Please verify these parameters before confirming:`);
    console.log(`  token0: ${token0}`);
    console.log(`  token1: ${token1}`);
    console.log(`  fee: ${CONFIG.FEE_TIER}`);
    console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}`);
    console.log(`  Initial Price: $${CONFIG.TARGET_PRICE_USD} per MWG`);

    const tx = await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        CONFIG.FEE_TIER,
        sqrtPriceX96,
        { gasLimit: 5000000 }
    );

    console.log(`\n⏳ Transaction submitted: ${tx.hash}`);
    console.log(`   Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`\n✅ Transaction confirmed!`);
    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

    // Get the pool address
    const poolAddress = await factory.getPool(token0, token1, CONFIG.FEE_TIER);
    console.log(`\n🎉 Pool Created Successfully!`);
    console.log(`   Pool Address: ${poolAddress}`);
    console.log(`   Fee Tier: ${CONFIG.FEE_TIER / 10000}%`);
    console.log(`   Initial Price: $${CONFIG.TARGET_PRICE_USD} per MWG`);

    console.log(`\n📝 Next Steps:`);
    console.log(`   1. Update your frontend to use the new pool address: ${poolAddress}`);
    console.log(`   2. Add liquidity using the liquidity page`);
    console.log(`   3. The old pool (0xbF2D99D14770022245c6AB5B23E9AA90AB8534B8) can be ignored`);

    // Save pool address
    const poolInfo = {
        network: network.name,
        chainId: network.chainId.toString(),
        poolAddress,
        token0,
        token1,
        feeTier: CONFIG.FEE_TIER,
        initialPriceUSD: CONFIG.TARGET_PRICE_USD,
        bnbPriceUSD: CONFIG.BNB_PRICE_USD,
        sqrtPriceX96: sqrtPriceX96.toString(),
        timestamp: new Date().toISOString(),
        txHash: tx.hash
    };

    const outputPath = path.join(__dirname, '..', 'deployments', `pool-${network.chainId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(poolInfo, null, 2));
    console.log(`\n💾 Pool info saved to: ${outputPath}`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error);
        process.exit(1);
    });
