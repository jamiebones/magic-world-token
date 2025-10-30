const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
require("dotenv").config();

/**
 * PancakeSwap V3 Liquidity Calculator & Addition Script
 * 
 * Part 1: Calculate required MWG and BNB amounts for a target price
 * Part 2: Add liquidity to PancakeSwap V3
 * 
 * IMPORTANT:
 * - V3 uses concentrated liquidity with tick ranges
 * - Price is determined by the ratio of tokens
 * - Test calculations first before adding liquidity
 * 
 * Usage:
 * - Calculate: node scripts/add-liquidity-v3.js --calculate --price 0.0003
 * - Add liquidity: npx hardhat run scripts/add-liquidity-v3.js --network bsc
 */

// PancakeSwap V3 Addresses (BSC Mainnet)
const PANCAKE_V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const PANCAKE_V3_POSITION_MANAGER = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364";
const PANCAKE_V3_ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";
const WBNB_ADDRESS = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

// Fee tiers available in V3 (in hundredths of a bip, i.e., 1e-6)
const FEE_TIERS = {
    LOWEST: 100,    // 0.01%
    LOW: 500,       // 0.05%
    MEDIUM: 2500,   // 0.25%
    HIGH: 10000     // 1%
};

// ABIs
const POSITION_MANAGER_ABI = [
    "function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)",
    "function mint((address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
    "function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)"
];

const FACTORY_ABI = [
    "function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"
];

const POOL_ABI = [
    "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    "function liquidity() external view returns (uint128)",
    "function token0() external view returns (address)",
    "function token1() external view returns (address)"
];

const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
    "function symbol() external view returns (string)"
];

/**
 * Configuration
 */
const CONFIG = {
    // Target price: 1 MWG = X BNB
    TARGET_PRICE_IN_BNB: 0.00000027075812274368, // 1 MWG = 0.0003 BNB

    // Total liquidity budget in USD (optional, for planning)
    TOTAL_LIQUIDITY_USD: 1000, // $1000 worth of liquidity

    // BNB price in USD (update this based on current market)
    BNB_PRICE_USD: 1108, // $1108 per BNB

    // Fee tier to use (LOWEST, LOW, MEDIUM, HIGH)
    FEE_TIER: FEE_TIERS.MEDIUM, // 0.25%

    // Price range for concentrated liquidity (% above/below target)
    PRICE_RANGE_PERCENT: 50, // ±50% range (target ± 50%)

    // Slippage tolerance
    SLIPPAGE_TOLERANCE: 0.01, // 1%
};

/**
 * ═══════════════════════════════════════════════════════════
 * PART 1: PRICE CALCULATION FUNCTIONS
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Calculate sqrtPriceX96 from price
 * Formula: sqrtPriceX96 = sqrt(price) * 2^96
 * 
 * For MWG/WBNB pair:
 * - If MWG is token0: price = amountBNB / amountMWG
 * - If MWG is token1: price = amountMWG / amountBNB
 */
function calculateSqrtPriceX96(price, token0IsMWG) {
    // V3 price is always token1/token0
    // If MWG is token0: we want BNB/MWG ratio
    // If MWG is token1: we want MWG/BNB ratio (inverse)

    const actualPrice = token0IsMWG ? (1 / price) : price;
    const sqrtPrice = Math.sqrt(actualPrice);
    const Q96 = 2n ** 96n;
    const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));

    return sqrtPriceX96;
}

/**
 * Calculate price from sqrtPriceX96
 */
function calculatePriceFromSqrtPriceX96(sqrtPriceX96, token0IsMWG) {
    const Q96 = 2n ** 96n;
    const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
    const price = sqrtPrice ** 2;

    // If MWG is token0, price is BNB/MWG, so MWG/BNB = 1/price
    return token0IsMWG ? (1 / price) : price;
}

/**
 * Calculate tick from price
 * Formula: tick = floor(log_1.0001(price))
 */
function calculateTick(price, token0IsMWG) {
    const actualPrice = token0IsMWG ? (1 / price) : price;
    const tick = Math.floor(Math.log(actualPrice) / Math.log(1.0001));
    return tick;
}

/**
 * Round tick to nearest valid tick spacing
 * Different fee tiers have different tick spacings:
 * - 100 (0.01%): spacing = 1
 * - 500 (0.05%): spacing = 10
 * - 2500 (0.25%): spacing = 50
 * - 10000 (1%): spacing = 200
 */
function roundToTickSpacing(tick, feeTier) {
    const spacings = {
        100: 1,
        500: 10,
        2500: 50,
        10000: 200
    };

    const spacing = spacings[feeTier] || 50;
    return Math.floor(tick / spacing) * spacing;
}

/**
 * Calculate required token amounts for target price
 * 
 * @param {number} targetPrice - Target price (1 MWG = X BNB)
 * @param {number} totalLiquidityUSD - Total liquidity in USD
 * @param {number} bnbPriceUSD - BNB price in USD
 * @returns {object} - Required amounts and ratios
 */
function calculateRequiredAmounts(targetPrice, totalLiquidityUSD, bnbPriceUSD) {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║          LIQUIDITY CALCULATION (V3)                   ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    console.log("📊 Input Parameters:");
    console.log(`  Target Price: 1 MWG = ${targetPrice} BNB`);
    console.log(`  Target Price: 1 MWG = $${(targetPrice * bnbPriceUSD).toFixed(6)} USD`);
    console.log(`  Total Liquidity: $${totalLiquidityUSD} USD`);
    console.log(`  BNB Price: $${bnbPriceUSD} USD`);
    console.log("");

    // For concentrated liquidity, we typically split 50/50 in value
    const liquidityPerSide = totalLiquidityUSD / 2;

    // Calculate BNB amount
    const bnbAmount = liquidityPerSide / bnbPriceUSD;

    // Calculate MWG amount based on target price
    // Price = BNB / MWG, so MWG = BNB / Price
    const mwgAmount = bnbAmount / targetPrice;

    console.log("💰 Required Amounts (50/50 split by value):");
    console.log(`  BNB: ${bnbAmount.toFixed(6)} BNB ($${liquidityPerSide.toFixed(2)})`);
    console.log(`  MWG: ${mwgAmount.toFixed(0)} MWG ($${liquidityPerSide.toFixed(2)})`);
    console.log("");
    console.log("📐 Ratio Verification:");
    console.log(`  MWG per BNB: ${(mwgAmount / bnbAmount).toFixed(2)} MWG/BNB`);
    console.log(`  BNB per MWG: ${(bnbAmount / mwgAmount).toFixed(8)} BNB/MWG`);
    console.log(`  Expected: ${targetPrice} BNB/MWG`);
    console.log(`  Match: ${Math.abs((bnbAmount / mwgAmount) - targetPrice) < 0.00001 ? '✅' : '❌'}`);
    console.log("");

    // Calculate tick range
    const token0IsMWG = true; // Assume MWG < WBNB alphabetically
    const currentTick = calculateTick(targetPrice, token0IsMWG);
    const tickSpacing = CONFIG.FEE_TIER === 100 ? 1 : CONFIG.FEE_TIER === 500 ? 10 : CONFIG.FEE_TIER === 2500 ? 50 : 200;

    // Calculate price range (±50%)
    const lowerPrice = targetPrice * (1 - CONFIG.PRICE_RANGE_PERCENT / 100);
    const upperPrice = targetPrice * (1 + CONFIG.PRICE_RANGE_PERCENT / 100);

    const tickLower = roundToTickSpacing(calculateTick(lowerPrice, token0IsMWG), CONFIG.FEE_TIER);
    const tickUpper = roundToTickSpacing(calculateTick(upperPrice, token0IsMWG), CONFIG.FEE_TIER);

    console.log("📍 Tick Range (Concentrated Liquidity):");
    console.log(`  Current Tick: ${currentTick}`);
    console.log(`  Tick Spacing: ${tickSpacing}`);
    console.log(`  Lower Tick: ${tickLower} (price: ${lowerPrice.toFixed(8)} BNB)`);
    console.log(`  Upper Tick: ${tickUpper} (price: ${upperPrice.toFixed(8)} BNB)`);
    console.log(`  Range: ${CONFIG.PRICE_RANGE_PERCENT}% below to ${CONFIG.PRICE_RANGE_PERCENT}% above`);
    console.log("");

    // Calculate sqrtPriceX96
    const sqrtPriceX96 = calculateSqrtPriceX96(targetPrice, token0IsMWG);

    console.log("🔢 Technical Details:");
    console.log(`  sqrtPriceX96: ${sqrtPriceX96.toString()}`);
    console.log(`  Fee Tier: ${CONFIG.FEE_TIER / 10000}%`);
    console.log(`  Token0 (MWG): Assumed`);
    console.log(`  Token1 (WBNB): ${WBNB_ADDRESS}`);
    console.log("");

    return {
        bnbAmount,
        mwgAmount,
        bnbAmountWei: ethers.parseEther(bnbAmount.toFixed(18)),
        mwgAmountWei: ethers.parseEther(Math.floor(mwgAmount).toString()),
        targetPrice,
        lowerPrice,
        upperPrice,
        currentTick,
        tickLower,
        tickUpper,
        sqrtPriceX96,
        feeTier: CONFIG.FEE_TIER
    };
}

/**
 * ═══════════════════════════════════════════════════════════
 * PART 2: LIQUIDITY ADDITION FUNCTIONS
 * ═══════════════════════════════════════════════════════════
 */

/**
 * Load deployment info
 */
function loadDeployment(network) {
    const deploymentPath = path.join(__dirname, '..', 'deployments', `${network}.json`);

    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`Deployment file not found for network: ${network}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    return deployment;
}

/**
 * Check if pool exists
 */
async function checkPoolExists(factory, token0, token1, feeTier) {
    const poolAddress = await factory.getPool(token0, token1, feeTier);
    return poolAddress !== ethers.ZeroAddress ? poolAddress : null;
}

/**
 * Create and initialize pool
 */
async function createAndInitializePool(positionManager, token0, token1, feeTier, sqrtPriceX96, signer) {
    console.log("\n🏊 Creating and initializing pool...");
    console.log(`  Token0: ${token0}`);
    console.log(`  Token1: ${token1}`);
    console.log(`  Fee: ${feeTier / 10000}%`);
    console.log(`  Initial sqrtPriceX96: ${sqrtPriceX96.toString()}`);

    const tx = await positionManager.createAndInitializePoolIfNecessary(
        token0,
        token1,
        feeTier,
        sqrtPriceX96
    );

    console.log(`  Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ Pool created in block ${receipt.blockNumber}`);

    return receipt;
}

/**
 * Add liquidity to V3 pool
 */
async function addLiquidityV3(params) {
    const {
        positionManager,
        token0,
        token1,
        feeTier,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        recipient,
        deadline,
        signer
    } = params;

    console.log("\n💧 Adding liquidity to V3 pool...");
    console.log(`  Amount0 (Token0): ${ethers.formatEther(amount0Desired)}`);
    console.log(`  Amount1 (Token1): ${ethers.formatEther(amount1Desired)}`);
    console.log(`  Tick Range: [${tickLower}, ${tickUpper}]`);

    // Calculate minimum amounts (with slippage)
    const amount0Min = amount0Desired * BigInt(Math.floor((1 - CONFIG.SLIPPAGE_TOLERANCE) * 10000)) / 10000n;
    const amount1Min = amount1Desired * BigInt(Math.floor((1 - CONFIG.SLIPPAGE_TOLERANCE) * 10000)) / 10000n;

    const mintParams = {
        token0,
        token1,
        fee: feeTier,
        tickLower,
        tickUpper,
        amount0Desired,
        amount1Desired,
        amount0Min,
        amount1Min,
        recipient,
        deadline
    };

    // Determine if we need to send BNB
    const isToken0BNB = token0.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const isToken1BNB = token1.toLowerCase() === WBNB_ADDRESS.toLowerCase();
    const bnbValue = isToken0BNB ? amount0Desired : isToken1BNB ? amount1Desired : 0n;

    const tx = await positionManager.mint(mintParams, { value: bnbValue });

    console.log(`  Transaction: ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`  ✅ Liquidity added in block ${receipt.blockNumber}`);
    console.log(`  Gas used: ${receipt.gasUsed.toString()}`);

    return receipt;
}

/**
 * Main function
 */
async function main() {
    // Check if we're in calculation mode
    const args = process.argv.slice(2);
    const isCalculateMode = args.includes('--calculate');
    const priceArg = args.find(arg => arg.startsWith('--price='));
    const customPriceUSD = priceArg ? parseFloat(priceArg.split('=')[1]) : null;

    if (isCalculateMode || customPriceUSD) {
        // PART 1: CALCULATION MODE
        // Convert USD price to BNB price
        let targetPrice;
        if (customPriceUSD) {
            targetPrice = customPriceUSD / CONFIG.BNB_PRICE_USD;
            console.log("\n💵 Price Conversion:");
            console.log(`  Input: 1 MWG = $${customPriceUSD} USD`);
            console.log(`  BNB Price: $${CONFIG.BNB_PRICE_USD} USD`);
            console.log(`  Converted: 1 MWG = ${targetPrice} BNB`);
            console.log("");
        } else {
            targetPrice = CONFIG.TARGET_PRICE_IN_BNB;
        }

        const result = calculateRequiredAmounts(
            targetPrice,
            CONFIG.TOTAL_LIQUIDITY_USD,
            CONFIG.BNB_PRICE_USD
        );

        console.log("═══════════════════════════════════════════════════════");
        console.log("✅ Calculation Complete!");
        console.log("═══════════════════════════════════════════════════════\n");

        console.log("📝 Summary for Adding Liquidity:");
        console.log(`  You need: ${result.bnbAmount.toFixed(6)} BNB`);
        console.log(`  You need: ${Math.floor(result.mwgAmount).toLocaleString()} MWG`);
        console.log(`  This will set price: 1 MWG = ${targetPrice} BNB`);
        console.log(`  Or: 1 MWG = $${(targetPrice * CONFIG.BNB_PRICE_USD).toFixed(6)} USD`);
        console.log("");

        console.log("🎯 To add liquidity with these amounts:");
        console.log("  1. Update CONFIG in this script:");
        console.log(`     TARGET_PRICE_IN_BNB: ${targetPrice}`);
        console.log(`     TOTAL_LIQUIDITY_USD: ${CONFIG.TOTAL_LIQUIDITY_USD}`);
        console.log("  2. Run: npx hardhat run scripts/add-liquidity-v3.js --network bsc");
        console.log("");

        return;
    }

    // PART 2: LIQUIDITY ADDITION MODE
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║     PancakeSwap V3 Liquidity Addition                ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // Get network info
    const network = await ethers.provider.getNetwork();
    const networkName = network.chainId === 56n ? 'bsc' : network.chainId === 97n ? 'bscTestnet' : 'unknown';

    if (networkName === 'unknown') {
        throw new Error(`Unsupported network. Chain ID: ${network.chainId}`);
    }

    console.log("📡 Network Information:");
    console.log(`  Network: ${networkName}`);
    console.log(`  Chain ID: ${network.chainId}`);
    console.log("");

    // Load deployment
    console.log("📂 Loading deployment information...");
    const deployment = loadDeployment(networkName);
    const MWG_TOKEN_ADDRESS = deployment.contracts.token.address;
    console.log(`  MWG Token: ${MWG_TOKEN_ADDRESS}`);
    console.log("");

    // Get signer
    const [signer] = await ethers.getSigners();
    const signerAddress = await signer.getAddress();
    console.log("👤 Signer Information:");
    console.log(`  Address: ${signerAddress}`);

    const signerBalance = await ethers.provider.getBalance(signerAddress);
    console.log(`  BNB Balance: ${ethers.formatEther(signerBalance)} BNB`);
    console.log("");

    // Calculate required amounts
    const amounts = calculateRequiredAmounts(
        CONFIG.TARGET_PRICE_IN_BNB,
        CONFIG.TOTAL_LIQUIDITY_USD,
        CONFIG.BNB_PRICE_USD
    );

    // Initialize contracts
    const mwgToken = new ethers.Contract(MWG_TOKEN_ADDRESS, ERC20_ABI, signer);
    const positionManager = new ethers.Contract(PANCAKE_V3_POSITION_MANAGER, POSITION_MANAGER_ABI, signer);
    const factory = new ethers.Contract(PANCAKE_V3_FACTORY, FACTORY_ABI, signer);

    // Check MWG balance
    const mwgBalance = await mwgToken.balanceOf(signerAddress);
    console.log("💰 Token Balances:");
    console.log(`  MWG Balance: ${ethers.formatEther(mwgBalance)} MWG`);
    console.log(`  Required MWG: ${ethers.formatEther(amounts.mwgAmountWei)} MWG`);
    console.log(`  Sufficient: ${mwgBalance >= amounts.mwgAmountWei ? '✅' : '❌'}`);
    console.log("");

    // Validate balances
    if (mwgBalance < amounts.mwgAmountWei) {
        throw new Error(`Insufficient MWG balance`);
    }

    const requiredBNB = amounts.bnbAmountWei + ethers.parseEther("0.05"); // Extra for gas
    if (signerBalance < requiredBNB) {
        throw new Error(`Insufficient BNB balance. Need ~${ethers.formatEther(requiredBNB)} BNB`);
    }

    // Determine token order (token0 < token1 by address)
    const token0 = MWG_TOKEN_ADDRESS.toLowerCase() < WBNB_ADDRESS.toLowerCase() ? MWG_TOKEN_ADDRESS : WBNB_ADDRESS;
    const token1 = MWG_TOKEN_ADDRESS.toLowerCase() < WBNB_ADDRESS.toLowerCase() ? WBNB_ADDRESS : MWG_TOKEN_ADDRESS;
    const token0IsMWG = token0 === MWG_TOKEN_ADDRESS;

    console.log("🔍 Token Order:");
    console.log(`  Token0: ${token0} ${token0IsMWG ? '(MWG)' : '(WBNB)'}`);
    console.log(`  Token1: ${token1} ${token0IsMWG ? '(WBNB)' : '(MWG)'}`);
    console.log("");

    // Check if pool exists
    const poolAddress = await checkPoolExists(factory, token0, token1, CONFIG.FEE_TIER);

    if (!poolAddress) {
        console.log("⚠️  Pool does not exist. Creating...");
        await createAndInitializePool(
            positionManager,
            token0,
            token1,
            CONFIG.FEE_TIER,
            amounts.sqrtPriceX96,
            signer
        );
    } else {
        console.log(`✅ Pool exists: ${poolAddress}`);
    }
    console.log("");

    // Approve tokens
    console.log("🔐 Approving tokens...");
    const approveTx = await mwgToken.approve(PANCAKE_V3_POSITION_MANAGER, amounts.mwgAmountWei);
    console.log(`  Transaction: ${approveTx.hash}`);
    await approveTx.wait();
    console.log("  ✅ Approval confirmed");
    console.log("");

    // Prepare amounts based on token order
    const amount0Desired = token0IsMWG ? amounts.mwgAmountWei : amounts.bnbAmountWei;
    const amount1Desired = token0IsMWG ? amounts.bnbAmountWei : amounts.mwgAmountWei;

    // Calculate deadline
    const deadline = Math.floor(Date.now() / 1000) + (20 * 60); // 20 minutes

    // Add liquidity
    await addLiquidityV3({
        positionManager,
        token0,
        token1,
        feeTier: CONFIG.FEE_TIER,
        tickLower: amounts.tickLower,
        tickUpper: amounts.tickUpper,
        amount0Desired,
        amount1Desired,
        recipient: signerAddress,
        deadline,
        signer
    });

    console.log("\n═══════════════════════════════════════════════════════");
    console.log("✅ Liquidity Addition Complete!");
    console.log("═══════════════════════════════════════════════════════\n");

    console.log("🎯 Next Steps:");
    console.log("  1. Check pool on PancakeSwap V3");
    console.log("  2. Verify your position in Position Manager");
    console.log("  3. Monitor price and liquidity depth");
    console.log("");
}

// Execute
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error("\n❌ Error:", error);
            process.exit(1);
        });
}

module.exports = { calculateRequiredAmounts, calculateSqrtPriceX96, calculateTick };
