const hre = require("hardhat");

async function main() {
    const FARMING_POOL_ADDRESS = "0x887e01110E803BeBa521Da99d528532C2648d90f";
    const USER_ADDRESS = "0x25b2b618c5C496CB4920dad1A70D118a22B9de93"; // Your wallet

    console.log("🔍 Checking user's staked positions...\n");
    console.log("User:", USER_ADDRESS);
    console.log("Farming Pool:", FARMING_POOL_ADDRESS);
    console.log();

    const farmingPool = await hre.ethers.getContractAt("MWGFarmingPool", FARMING_POOL_ADDRESS);

    // Get user positions
    const positions = await farmingPool.getUserPositions(USER_ADDRESS);
    console.log("📊 Total Positions:", positions.length);
    console.log();

    if (positions.length === 0) {
        console.log("No positions found");
        return;
    }

    // Get pool info
    const poolInfo = await farmingPool.poolInfo();
    console.log("📈 Pool Info:");
    console.log("sqrtPriceX96:", poolInfo.sqrtPriceX96.toString());
    console.log("Current Tick:", poolInfo.currentTick.toString());
    console.log("Last Updated:", new Date(Number(poolInfo.lastUpdated) * 1000).toISOString());
    console.log();

    // Check each position
    for (let i = 0; i < positions.length; i++) {
        const tokenId = positions[i];
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Position ${i + 1}: Token ID #${tokenId.toString()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

        const position = await farmingPool.stakedPositions(tokenId);
        const pendingRewards = await farmingPool.pendingRewards(tokenId);

        console.log("\n📋 Position Details:");
        console.log("Owner:", position.owner);
        console.log("Liquidity:", position.liquidity.toString());
        console.log("USD Value:", hre.ethers.formatEther(position.usdValue), "USD");
        console.log("Tick Range:", position.tickLower, "→", position.tickUpper);
        console.log();

        console.log("⏰ Lock Info:");
        console.log("Staked At:", new Date(Number(position.stakedAt) * 1000).toISOString());
        console.log("Lock Until:", new Date(Number(position.lockUntil) * 1000).toISOString());
        console.log("Boost Multiplier:", (Number(position.boostMultiplier) / 1000).toFixed(2) + "x");

        const now = Math.floor(Date.now() / 1000);
        const isLocked = Number(position.lockUntil) > now;
        console.log("Status:", isLocked ? "🔒 Locked" : "🔓 Unlocked");
        console.log();

        console.log("💰 Rewards:");
        console.log("Reward Debt:", hre.ethers.formatEther(position.rewardDebt), "MWG");
        console.log("Pending Rewards:", hre.ethers.formatEther(pendingRewards), "MWG");
        console.log();
    }

    // Get user totals
    const userTotalValue = await farmingPool.userTotalValue(USER_ADDRESS);
    const userRewardsClaimed = await farmingPool.userRewardsClaimed(USER_ADDRESS);
    const totalPending = await farmingPool.pendingRewardsForUser(USER_ADDRESS);

    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("📊 User Summary");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("Total Staked Value:", hre.ethers.formatEther(userTotalValue), "USD");
    console.log("Total Pending Rewards:", hre.ethers.formatEther(totalPending), "MWG");
    console.log("Total Claimed:", hre.ethers.formatEther(userRewardsClaimed), "MWG");
    console.log();

    if (poolInfo.sqrtPriceX96 === BigInt(0)) {
        console.log("⚠️  Pool price data is still zero");
        console.log("   This explains why USD values are showing as zero");
        console.log("   The external call to pool.slot0() is failing due to viaIR compilation");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
