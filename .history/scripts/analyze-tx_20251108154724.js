const hre = require("hardhat");

async function main() {
    const TX_HASH = "0x8ea89a73cf90e5ed03e30ec732d6e89bf2c8c6ddeeef4f2b66e535a8fe65eff4";
    
    console.log("🔍 Analyzing transaction:", TX_HASH, "\n");
    
    const receipt = await hre.ethers.provider.getTransactionReceipt(TX_HASH);
    
    console.log("📊 Transaction Details:");
    console.log("Block:", receipt.blockNumber);
    console.log("Gas Used:", receipt.gasUsed.toString());
    console.log("Status:", receipt.status === 1 ? "✅ Success" : "❌ Failed");
    console.log();
    
    console.log("📝 Logs:");
    console.log("Total logs:", receipt.logs.length);
    console.log();
    
    const farmingPoolAddress = "0x887e01110E803BeBa521Da99d528532C2648d90f";
    const farmingPool = await hre.ethers.getContractAt("MWGFarmingPool", farmingPoolAddress);
    
    for (let i = 0; i < receipt.logs.length; i++) {
        try {
            const parsed = farmingPool.interface.parseLog(receipt.logs[i]);
            if (parsed) {
                console.log(`Event ${i + 1}:`, parsed.name);
                console.log("Arguments:", parsed.args);
                console.log();
            }
        } catch (e) {
            // Not a farming pool event
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
