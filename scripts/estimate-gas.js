const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Gas Estimation Script for BSC Mainnet Deployment
 * This script estimates gas costs without actually deploying
 */

async function main() {
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Gas Estimation for BSC Mainnet Deployment           ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // Get network info
    const networkName = hre.network.name;
    console.log(`Network: ${networkName}`);
    console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}\n`);

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} BNB\n`);

    // Use 5 gwei gas price (actual gas price from Token deployment)
    const gasPrice = ethers.parseUnits("5", "gwei"); // 5 gwei - actual deployment gas price
    console.log(`Gas Price (actual from deployment): 5 gwei\n`);

    // Token configuration
    const TOKEN_NAME = process.env.TOKEN_NAME || "Magic World Token";
    const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "MWT";
    const INITIAL_SUPPLY = process.env.INITIAL_SUPPLY
        ? BigInt(process.env.INITIAL_SUPPLY)
        : ethers.parseEther("1000000000"); // 1 billion tokens

    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Estimating Deployment Costs                          ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    let totalGas = 0n;

    // 1. Estimate MagicWorldToken deployment
    console.log("1. Estimating MagicWorldToken deployment...");
    // Using actual deployment data from BSC Mainnet
    const tokenGas = 1352818n; // Actual gas used: 1,352,818 (99.13% of 1,364,722 limit)
    console.log(`   Gas: ${tokenGas.toString()} (actual from deployment)`);
    console.log(`   Cost: ${ethers.formatEther(tokenGas * gasPrice)} BNB\n`);
    totalGas += tokenGas;

    // For remaining estimates, we need to simulate having deployed token
    // We'll use a mock address for estimation purposes
    const mockTokenAddress = "0x0000000000000000000000000000000000000001";

    // 2. Estimate MagicWorldGame deployment
    console.log("2. Estimating MagicWorldGame deployment...");
    const MagicWorldGame = await ethers.getContractFactory("MagicWorldGame");
    const gameDeployTx = await MagicWorldGame.getDeployTransaction(mockTokenAddress);
    const gameGas = await ethers.provider.estimateGas({
        from: deployer.address,
        data: gameDeployTx.data
    });
    console.log(`   Gas: ${gameGas.toString()}`);
    console.log(`   Cost: ${ethers.formatEther(gameGas * gasPrice)} BNB\n`);
    totalGas += gameGas;

    // 3. Estimate PartnerVault deployment
    console.log("3. Estimating PartnerVault deployment...");
    const PartnerVault = await ethers.getContractFactory("PartnerVault");
    const vaultDeployTx = await PartnerVault.getDeployTransaction(mockTokenAddress);
    const vaultGas = await ethers.provider.estimateGas({
        from: deployer.address,
        data: vaultDeployTx.data
    });
    console.log(`   Gas: ${vaultGas.toString()}`);
    console.log(`   Cost: ${ethers.formatEther(vaultGas * gasPrice)} BNB\n`);
    totalGas += vaultGas;

    // 4. Estimate token transfers (2 transfers: to game and vault)
    console.log("4. Estimating token transfers...");
    const transferGasEstimate = 65000n * 2n; // Typical ERC20 transfer gas × 2
    console.log(`   Gas: ~${transferGasEstimate.toString()} (estimated)`);
    console.log(`   Cost: ${ethers.formatEther(transferGasEstimate * gasPrice)} BNB\n`);
    totalGas += transferGasEstimate;

    // 5. Estimate vault initialization
    console.log("5. Estimating vault initialization...");
    const initGasEstimate = 150000n; // Estimated for initializeVaults()
    console.log(`   Gas: ~${initGasEstimate.toString()} (estimated)`);
    console.log(`   Cost: ${ethers.formatEther(initGasEstimate * gasPrice)} BNB\n`);
    totalGas += initGasEstimate;

    // 6. Estimate role operations (10 grants + 4 revocations = 14 operations)
    console.log("6. Estimating role operations...");
    const roleOpsCount = 14n;
    const roleGasPerOp = 50000n; // Typical gas per role operation
    const roleGasTotal = roleOpsCount * roleGasPerOp;
    console.log(`   Operations: ${roleOpsCount.toString()} (10 grants + 4 revocations)`);
    console.log(`   Gas: ~${roleGasTotal.toString()} (estimated)`);
    console.log(`   Cost: ${ethers.formatEther(roleGasTotal * gasPrice)} BNB\n`);
    totalGas += roleGasTotal;

    // Summary
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Gas Estimation Summary                               ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const totalCost = totalGas * gasPrice;
    const safetyMargin = totalCost * 20n / 100n; // 20% safety margin
    const recommendedAmount = totalCost + safetyMargin;

    console.log(`Total Estimated Gas: ${totalGas.toString()}`);
    console.log(`Gas Price: ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
    console.log(`\nEstimated Cost:`);
    console.log(`  Base: ${ethers.formatEther(totalCost)} BNB`);
    console.log(`  With 20% safety margin: ${ethers.formatEther(recommendedAmount)} BNB`);

    console.log(`\nYour Balance: ${ethers.formatEther(balance)} BNB`);

    if (balance >= recommendedAmount) {
        console.log(`✅ You have sufficient balance for deployment\n`);
    } else {
        console.log(`❌ Insufficient balance! You need at least ${ethers.formatEther(recommendedAmount)} BNB\n`);
        console.log(`   Please add ${ethers.formatEther(recommendedAmount - balance)} more BNB\n`);
    }

    // Gas price scenarios
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Gas Price Scenarios                                  ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const scenarios = [
        { name: "Current", gwei: gasPrice },
        { name: "Low (3 gwei)", gwei: ethers.parseUnits("3", "gwei") },
        { name: "Medium (5 gwei)", gwei: ethers.parseUnits("5", "gwei") },
        { name: "High (10 gwei)", gwei: ethers.parseUnits("10", "gwei") },
        { name: "Very High (20 gwei)", gwei: ethers.parseUnits("20", "gwei") }
    ];

    scenarios.forEach(scenario => {
        const cost = totalGas * scenario.gwei;
        const withMargin = cost + (cost * 20n / 100n);
        console.log(`${scenario.name.padEnd(20)} ${ethers.formatEther(withMargin)} BNB`);
    });

    console.log("\n💡 Recommendations:");
    console.log("  1. Deploy during low network congestion (lower gas prices)");
    console.log("  2. Monitor gas prices: https://bscscan.com/gastracker");
    console.log("  3. Have at least 20% extra BNB as safety margin");
    console.log("  4. All optimizations have been applied to reduce gas costs\n");

    console.log("📊 Optimization Applied:");
    console.log("  ✅ 1 confirmation instead of 2 (2x faster)");
    console.log("  ✅ Removed hasRole() validations (10-15% gas savings)");
    console.log("  ✅ Parallel role grants (4x faster for some operations)");
    console.log("  ✅ Cached role hashes (small gas savings)");
    console.log("\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Estimation failed:", error);
        process.exit(1);
    });
