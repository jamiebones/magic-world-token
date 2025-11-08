const hre = require("hardhat");

async function main() {
    const FARMING_POOL_ADDRESS = "0x887e01110E803BeBa521Da99d528532C2648d90f";

    console.log("🔄 Updating MWGFarmingPool with current price data...\n");

    const [signer] = await hre.ethers.getSigners();
    console.log("Caller:", signer.address);
    console.log();

    const farmingPool = await hre.ethers.getContractAt("MWGFarmingPool", FARMING_POOL_ADDRESS);

    // Check current pool info
    const poolInfoBefore = await farmingPool.poolInfo();
    console.log("📊 Pool Info BEFORE update:");
    console.log("sqrtPriceX96:", poolInfoBefore.sqrtPriceX96.toString());
    console.log("Current Tick:", poolInfoBefore.currentTick.toString());
    console.log();

    // Call updatePool()
    console.log("🔄 Calling updatePool()...");
    const tx = await farmingPool.updatePool();
    console.log("Transaction hash:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
    console.log();

    // Check updated pool info
    const poolInfoAfter = await farmingPool.poolInfo();
    console.log("📊 Pool Info AFTER update:");
    console.log("sqrtPriceX96:", poolInfoAfter.sqrtPriceX96.toString());
    console.log("Current Tick:", poolInfoAfter.currentTick.toString());
    console.log("Last Updated:", new Date(Number(poolInfoAfter.lastUpdated) * 1000).toISOString());
    console.log();

    if (poolInfoAfter.sqrtPriceX96 > BigInt(0)) {
        console.log("✅ SUCCESS! Pool price data updated");
        console.log("   USD value calculations will now work correctly");
    } else {
        console.log("⚠️  Pool price still zero - check for errors in transaction");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
