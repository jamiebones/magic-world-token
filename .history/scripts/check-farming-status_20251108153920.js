const hre = require("hardhat");

async function main() {
    const FARMING_POOL_ADDRESS = "0x887e01110E803BeBa521Da99d528532C2648d90f";
    
    console.log("🔍 Checking MWGFarmingPool Status...\n");
    
    const farmingPool = await hre.ethers.getContractAt("MWGFarmingPool", FARMING_POOL_ADDRESS);
    
    // Get farming stats
    const stats = await farmingPool.getFarmingStats();
    const rewardPerSecond = await farmingPool.rewardPerSecond();
    const farmingStartTime = await farmingPool.farmingStartTime();
    const farmingEndTime = await farmingPool.farmingEndTime();
    const poolInfo = await farmingPool.poolInfo();
    const paused = await farmingPool.paused();
    
    const now = Math.floor(Date.now() / 1000);
    const hasStarted = Number(farmingStartTime) <= now;
    const hasEnded = Number(farmingEndTime) <= now;
    
    console.log("📊 Farming Contract Status:");
    console.log("═══════════════════════════════════════");
    console.log("Address:", FARMING_POOL_ADDRESS);
    console.log("Paused:", paused);
    console.log();
    
    console.log("⏰ Timing:");
    console.log("Current Time:", now, "(", new Date(now * 1000).toISOString(), ")");
    console.log("Start Time:", farmingStartTime.toString(), "(", new Date(Number(farmingStartTime) * 1000).toISOString(), ")");
    console.log("End Time:", farmingEndTime.toString(), "(", new Date(Number(farmingEndTime) * 1000).toISOString(), ")");
    console.log("Has Started:", hasStarted);
    console.log("Has Ended:", hasEnded);
    console.log();
    
    console.log("💰 Rewards:");
    console.log("Reward Per Second:", hre.ethers.formatEther(rewardPerSecond), "MWG");
    console.log("Reward Per Day:", hre.ethers.formatEther(rewardPerSecond * BigInt(86400)), "MWG");
    console.log("Total Staked Value:", hre.ethers.formatEther(stats.totalStakedValue), "USD");
    console.log("Total Rewards Deposited:", hre.ethers.formatEther(stats.totalRewardsDeposited), "MWG");
    console.log("Total Rewards Distributed:", hre.ethers.formatEther(stats.totalRewardsDistributed), "MWG");
    console.log("Available Rewards:", hre.ethers.formatEther(stats.availableRewards), "MWG");
    console.log();
    
    console.log("📈 Pool Info (PancakeSwap V3):");
    console.log("sqrtPriceX96:", poolInfo.sqrtPriceX96.toString());
    console.log("Current Tick:", poolInfo.currentTick.toString());
    console.log("Last Updated:", poolInfo.lastUpdated.toString(), "(", new Date(Number(poolInfo.lastUpdated) * 1000).toISOString(), ")");
    console.log();
    
    console.log("📊 Stats:");
    console.log("Current APR:", stats.currentAPR.toString(), "basis points (", Number(stats.currentAPR) / 100, "%)");
    console.log("Participant Count:", stats.participantCount.toString());
    console.log("Is Active:", stats.isActive);
    console.log();
    
    if (poolInfo.sqrtPriceX96 === BigInt(0)) {
        console.log("⚠️  WARNING: Pool info not initialized!");
        console.log("   sqrtPriceX96 is 0, which means USD value calculations will fail");
        console.log("   Call updatePool() or wait for first stake to initialize pool data");
    }
    
    if (!stats.isActive) {
        console.log("⚠️  WARNING: Farming is NOT active!");
        if (!hasStarted) {
            console.log("   Farming hasn't started yet");
        } else if (hasEnded) {
            console.log("   Farming period has ended");
        } else if (paused) {
            console.log("   Contract is paused");
        }
    }
    
    console.log("\n✅ Status check complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
