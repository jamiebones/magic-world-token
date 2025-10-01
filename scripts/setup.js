const { ethers } = require("hardhat");
const { getDeployment } = require("./getDeployment");
require("dotenv").config();

/**
 * Post-Deployment Configuration Script
 * 
 * This script is used for managing configuration AFTER initial deployment.
 * The deploy.js script now handles all initial setup, so this script is for:
 * 
 * - Updating game parameters (daily limits, batch sizes)
 * - Granting roles to new admins or distributors
 * - Allocating tokens to partners in PartnerVault
 * - Updating contract configurations
 * 
 * Usage: npx hardhat run scripts/setup.js --network <network>
 */

async function main() {
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Post-Deployment Configuration Utility               ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const networkName = hre.network.name;
    console.log(`Network: ${networkName}\n`);

    // Get deployment addresses
    let deployment;
    try {
        deployment = getDeployment(networkName);
        console.log("✅ Loaded deployment configuration\n");
    } catch (error) {
        console.error("❌ Deployment file not found. Please run deploy script first.");
        console.error(`   Looking for: deployments/${networkName}.json\n`);
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}\n`);

    // Get contract instances
    const token = await ethers.getContractAt("MagicWorldToken", deployment.contracts.token.address);
    const game = await ethers.getContractAt("MagicWorldGame", deployment.contracts.game.address);
    const partnerVault = await ethers.getContractAt("PartnerVault", deployment.contracts.partnerVault.address);

    console.log("📋 Contract Addresses:");
    console.log(`  Token:         ${deployment.contracts.token.address}`);
    console.log(`  Game:          ${deployment.contracts.game.address}`);
    console.log(`  Partner Vault: ${deployment.contracts.partnerVault.address}\n`);

    // ============================================================================
    // CONFIGURATION OPTIONS - Uncomment and modify as needed
    // ============================================================================

    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Available Configuration Options                      ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    console.log("📝 To use this script, uncomment the relevant sections below:\n");

    // ----------------------------------------------------------------------------
    // 1. UPDATE GAME PARAMETERS
    // ----------------------------------------------------------------------------
    /*
    console.log("1️⃣  Updating Daily Reward Limit...");
    const newDailyLimit = ethers.parseEther("2000"); // 2000 tokens per day
    const updateLimitTx = await game.setDailyRewardLimit(newDailyLimit);
    await updateLimitTx.wait();
    console.log(`   ✅ Daily limit updated to ${ethers.formatEther(newDailyLimit)} MWT\n`);
    */

    /*
    console.log("2️⃣  Updating Max Batch Size...");
    const newBatchSize = 300;
    const updateBatchTx = await game.setMaxBatchSize(newBatchSize);
    await updateBatchTx.wait();
    console.log(`   ✅ Max batch size updated to ${newBatchSize}\n`);
    */

    /*
    console.log("3️⃣  Updating Cooldown Period...");
    const newCooldown = 30 * 60; // 30 minutes in seconds
    const updateCooldownTx = await game.setCooldownPeriod(newCooldown);
    await updateCooldownTx.wait();
    console.log(`   ✅ Cooldown period updated to ${newCooldown} seconds\n`);
    */

    // ----------------------------------------------------------------------------
    // 2. GRANT ROLES TO NEW ACCOUNTS
    // ----------------------------------------------------------------------------
    /*
    console.log("4️⃣  Granting REWARD_DISTRIBUTOR_ROLE to new account...");
    const newDistributor = "0x1234567890123456789012345678901234567890"; // Replace with actual address
    const grantDistributorTx = await game.grantDistributorRole(newDistributor);
    await grantDistributorTx.wait();
    console.log(`   ✅ REWARD_DISTRIBUTOR_ROLE granted to ${newDistributor}\n`);
    */

    /*
    console.log("5️⃣  Granting GAME_ADMIN_ROLE to new account...");
    const newGameAdmin = "0x1234567890123456789012345678901234567890"; // Replace with actual address
    const grantAdminTx = await game.grantGameAdminRole(newGameAdmin);
    await grantAdminTx.wait();
    console.log(`   ✅ GAME_ADMIN_ROLE granted to ${newGameAdmin}\n`);
    */

    /*
    console.log("6️⃣  Granting GAME_OPERATOR_ROLE to new account...");
    const newOperator = "0x1234567890123456789012345678901234567890"; // Replace with actual address
    const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
    const grantOperatorTx = await token.grantRole(GAME_OPERATOR_ROLE, newOperator);
    await grantOperatorTx.wait();
    console.log(`   ✅ GAME_OPERATOR_ROLE granted to ${newOperator}\n`);
    */

    // ----------------------------------------------------------------------------
    // 3. ALLOCATE TOKENS TO PARTNERS
    // ----------------------------------------------------------------------------
    /*
    console.log("7️⃣  Allocating tokens to partner...");
    const partnerAddress = "0x1234567890123456789012345678901234567890"; // Replace with actual address
    const partnerAllocation = ethers.parseEther("1000000"); // 1M tokens
    const allocateTx = await partnerVault.allocateToPartner(partnerAddress, partnerAllocation);
    await allocateTx.wait();
    console.log(`   ✅ Allocated ${ethers.formatEther(partnerAllocation)} MWT to ${partnerAddress}`);
    console.log(`   ⏰ Withdrawable after 3 years from now\n`);
    */

    // ----------------------------------------------------------------------------
    // 4. TRANSFER ADMIN ROLES (USE WITH CAUTION!)
    // ----------------------------------------------------------------------------
    /*
    console.log("8️⃣  Transferring Token Admin Role...");
    const newTokenAdmin = "0x1234567890123456789012345678901234567890"; // Replace with actual address
    console.log("   ⚠️  WARNING: This will transfer admin control!");
    console.log("   Current admin will lose DEFAULT_ADMIN_ROLE");
    const transferAdminTx = await token.transferAdmin(newTokenAdmin);
    await transferAdminTx.wait();
    console.log(`   ✅ Token admin transferred to ${newTokenAdmin}\n`);
    */

    /*
    console.log("9️⃣  Transferring Game Admin Role...");
    const newGameAdminOwner = "0x1234567890123456789012345678901234567890"; // Replace with actual address
    console.log("   ⚠️  WARNING: This will transfer admin control!");
    console.log("   Current admin will lose DEFAULT_ADMIN_ROLE");
    const transferGameAdminTx = await game.transferAdmin(newGameAdminOwner);
    await transferGameAdminTx.wait();
    console.log(`   ✅ Game admin transferred to ${newGameAdminOwner}\n`);
    */

    // ----------------------------------------------------------------------------
    // 5. EMERGENCY FUNCTIONS (USE WITH EXTREME CAUTION!)
    // ----------------------------------------------------------------------------
    /*
    console.log("🚨 Pausing Token Contract...");
    const pauseTokenTx = await token.pause();
    await pauseTokenTx.wait();
    console.log("   ✅ Token contract paused\n");
    */

    /*
    console.log("🚨 Unpausing Token Contract...");
    const unpauseTokenTx = await token.unpause();
    await unpauseTokenTx.wait();
    console.log("   ✅ Token contract unpaused\n");
    */

    /*
    console.log("🚨 Pausing Game Contract...");
    const pauseGameTx = await game.pause();
    await pauseGameTx.wait();
    console.log("   ✅ Game contract paused\n");
    */

    /*
    console.log("🚨 Unpausing Game Contract...");
    const unpauseGameTx = await game.unpause();
    await unpauseGameTx.wait();
    console.log("   ✅ Game contract unpaused\n");
    */

    // ============================================================================
    // VERIFICATION & STATUS CHECK
    // ============================================================================

    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Current System Status                                ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    try {
        // Token status
        const totalSupply = await token.totalSupply();
        const tokenPaused = await token.paused();
        console.log("🪙 Token Contract:");
        console.log(`  Total Supply:  ${ethers.formatEther(totalSupply)} MWT`);
        console.log(`  Status:        ${tokenPaused ? '⏸️  PAUSED' : '✅ Active'}\n`);

        // Game status
        const gamePaused = await game.paused();
        const dailyLimit = await game.dailyRewardLimit();
        const maxBatch = await game.maxBatchSize();
        const cooldown = await game.cooldownPeriod();
        const vaultsInit = await game.vaultsInitialized();

        console.log("🎮 Game Contract:");
        console.log(`  Status:        ${gamePaused ? '⏸️  PAUSED' : '✅ Active'}`);
        console.log(`  Daily Limit:   ${ethers.formatEther(dailyLimit)} MWT`);
        console.log(`  Max Batch:     ${maxBatch}`);
        console.log(`  Cooldown:      ${cooldown} seconds`);
        console.log(`  Vaults Init:   ${vaultsInit ? '✅' : '❌'}\n`);

        // Vault balances
        const [totalDist, playersCount, gameBalance] = await game.getContractStats();
        console.log("📊 Distribution Stats:");
        console.log(`  Total Distributed: ${ethers.formatEther(totalDist)} MWT`);
        console.log(`  Players Rewarded:  ${playersCount.toString()}`);
        console.log(`  Game Balance:      ${ethers.formatEther(gameBalance)} MWT\n`);

        // Vault allocations
        const [playerTasks, socialFollowers, socialPosters, ecosystemFund] = await game.getAllVaultStats();
        console.log("💰 Vault Status:");
        console.log(`  Player Tasks:`);
        console.log(`    Allocated: ${ethers.formatEther(playerTasks.totalAllocated)} MWT`);
        console.log(`    Remaining: ${ethers.formatEther(playerTasks.remaining)} MWT`);
        console.log(`  Social Followers:`);
        console.log(`    Allocated: ${ethers.formatEther(socialFollowers.totalAllocated)} MWT`);
        console.log(`    Remaining: ${ethers.formatEther(socialFollowers.remaining)} MWT`);
        console.log(`  Social Posters:`);
        console.log(`    Allocated: ${ethers.formatEther(socialPosters.totalAllocated)} MWT`);
        console.log(`    Remaining: ${ethers.formatEther(socialPosters.remaining)} MWT`);
        console.log(`  Ecosystem Fund:`);
        console.log(`    Allocated: ${ethers.formatEther(ecosystemFund.totalAllocated)} MWT`);
        console.log(`    Remaining: ${ethers.formatEther(ecosystemFund.remaining)} MWT\n`);

        // Partner Vault
        const partnerVaultBalance = await token.balanceOf(deployment.contracts.partnerVault.address);
        const totalAllocated = await partnerVault.totalAllocated();
        console.log("🤝 Partner Vault:");
        console.log(`  Balance:       ${ethers.formatEther(partnerVaultBalance)} MWT`);
        console.log(`  Allocated:     ${ethers.formatEther(totalAllocated)} MWT`);
        console.log(`  Unallocated:   ${ethers.formatEther(partnerVaultBalance - totalAllocated)} MWT\n`);

        // Role checks
        const REWARD_DISTRIBUTOR_ROLE = await game.REWARD_DISTRIBUTOR_ROLE();
        const GAME_ADMIN_ROLE = await game.GAME_ADMIN_ROLE();
        const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();

        const isDistributor = await game.hasRole(REWARD_DISTRIBUTOR_ROLE, deployer.address);
        const isGameAdmin = await game.hasRole(GAME_ADMIN_ROLE, deployer.address);
        const gameHasOperatorRole = await token.hasRole(GAME_OPERATOR_ROLE, deployment.contracts.game.address);

        console.log("🔐 Role Status:");
        console.log(`  Deployer is Distributor:     ${isDistributor ? '✅' : '❌'}`);
        console.log(`  Deployer is Game Admin:      ${isGameAdmin ? '✅' : '❌'}`);
        console.log(`  Game has Operator Role:      ${gameHasOperatorRole ? '✅' : '❌'}\n`);

        console.log("╔════════════════════════════════════════════════════════╗");
        console.log("║   Configuration Check Complete                         ║");
        console.log("╚════════════════════════════════════════════════════════╝\n");

        console.log("💡 To make configuration changes:");
        console.log("   1. Edit this script (scripts/setup.js)");
        console.log("   2. Uncomment the desired configuration section");
        console.log("   3. Update the values as needed");
        console.log("   4. Run: npx hardhat run scripts/setup.js --network " + networkName + "\n");

    } catch (error) {
        console.error("❌ Status check failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Setup script failed:", error);
        process.exit(1);
    });