const hre = require("hardhat");

async function main() {
    const POOL_ADDRESS = "0x63D85c8580d9d5e676F7Efd4d95A6a55326f174F";
    
    console.log("🔍 Checking PancakeSwap V3 Pool Liquidity...\n");
    console.log("Pool Address:", POOL_ADDRESS);
    console.log();
    
    // Get pool contract
    const poolAbi = [
        "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
        "function liquidity() external view returns (uint128)",
        "function token0() external view returns (address)",
        "function token1() external view returns (address)",
        "function fee() external view returns (uint24)",
        "function tickSpacing() external view returns (int24)"
    ];
    
    const pool = await hre.ethers.getContractAt(poolAbi, POOL_ADDRESS);
    
    try {
        // Get pool info
        const slot0 = await pool.slot0();
        const liquidity = await pool.liquidity();
        const token0 = await pool.token0();
        const token1 = await pool.token1();
        const fee = await pool.fee();
        const tickSpacing = await pool.tickSpacing();
        
        console.log("📊 Pool Configuration:");
        console.log("Token 0:", token0);
        console.log("Token 1:", token1);
        console.log("Fee Tier:", fee.toString(), "(", Number(fee) / 10000, "%)");
        console.log("Tick Spacing:", tickSpacing.toString());
        console.log();
        
        console.log("💧 Liquidity Status:");
        console.log("Current Liquidity:", liquidity.toString());
        console.log("Has Liquidity:", liquidity > BigInt(0));
        console.log();
        
        console.log("💰 Price Information:");
        console.log("sqrtPriceX96:", slot0.sqrtPriceX96.toString());
        console.log("Current Tick:", slot0.tick.toString());
        console.log("Observation Index:", slot0.observationIndex);
        console.log("Unlocked:", slot0.unlocked);
        console.log();
        
        if (slot0.sqrtPriceX96 === BigInt(0)) {
            console.log("⚠️  WARNING: sqrtPriceX96 is 0!");
            console.log("   This pool may not be initialized or has no price data");
        } else {
            console.log("✅ Pool has valid price data");
            
            // Calculate price from sqrtPriceX96
            const sqrtPrice = Number(slot0.sqrtPriceX96) / (2 ** 96);
            const price = sqrtPrice * sqrtPrice;
            console.log("\n📈 Calculated Price:");
            console.log("Price (token1/token0):", price.toExponential(6));
        }
        
        if (liquidity === BigInt(0)) {
            console.log("\n⚠️  WARNING: Pool has NO liquidity!");
            console.log("   Add liquidity to this pool before staking positions");
        } else {
            console.log("\n✅ Pool has liquidity - farming can proceed");
        }
        
    } catch (error) {
        console.error("❌ Error reading pool data:");
        console.error(error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
