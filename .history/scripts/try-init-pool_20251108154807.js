const hre = require("hardhat");

async function main() {
    const FARMING_POOL_ADDRESS = "0x887e01110E803BeBa521Da99d528532C2648d90f";
    
    console.log("🔄 Calling initializePoolInfo() with higher gas limit...\n");
    
    const [signer] = await hre.ethers.getSigners();
    console.log("Caller:", signer.address);
    console.log();
    
    const farmingPool = await hre.ethers.getContractAt("MWGFarmingPool", FARMING_POOL_ADDRESS);
    
    // Check current pool info
    const poolInfoBefore = await farmingPool.poolInfo();
    console.log("📊 Pool Info BEFORE:");
    console.log("sqrtPriceX96:", poolInfoBefore.sqrtPriceX96.toString());
    console.log();
    
    // Call initializePoolInfo() with high gas limit
    console.log("🔄 Calling initializePoolInfo() with 1M gas...");
    try {
        const tx = await farmingPool.initializePoolInfo({ gasLimit: 1000000 });
        console.log("Transaction hash:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed");
        console.log("Gas Used:", receipt.gasUsed.toString());
        console.log();
        
        // Check for events
        for (const log of receipt.logs) {
            try {
                const parsed = farmingPool.interface.parseLog(log);
                if (parsed) {
                    console.log("Event:", parsed.name);
                    if (parsed.name === "PoolInfoInitialized") {
                        console.log("  sqrtPriceX96:", parsed.args.sqrtPriceX96.toString());
                        console.log("  tick:", parsed.args.tick.toString());
                    }
                }
            } catch (e) {}
        }
        
    } catch (error) {
        console.error("❌ Transaction failed:", error.message);
    }
    
    // Check pool info after
    const poolInfoAfter = await farmingPool.poolInfo();
    console.log("\n📊 Pool Info AFTER:");
    console.log("sqrtPriceX96:", poolInfoAfter.sqrtPriceX96.toString());
    console.log("Current Tick:", poolInfoAfter.currentTick.toString());
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
