const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log("Running post-deployment setup...");

    // You'll need to update these addresses after deployment
    const TOKEN_ADDRESS = process.env.TOKEN_ADDRESS || "";
    const GAME_ADDRESS = process.env.GAME_ADDRESS || "";
    const GAME_ADMIN_ADDRESS = process.env.GAME_ADMIN_ADDRESS || "";

    if (!TOKEN_ADDRESS || !GAME_ADDRESS) {
        console.error("Please set TOKEN_ADDRESS and GAME_ADDRESS in your .env file");
        process.exit(1);
    }

    const [deployer] = await ethers.getSigners();
    console.log("Setup running with account:", deployer.address);

    // Get contract instances
    const token = await ethers.getContractAt("MagicWorldToken", TOKEN_ADDRESS);
    const game = await ethers.getContractAt("MagicWorldGame", GAME_ADDRESS);

    console.log("\n=== Contract Setup ===");

    // Set game configuration
    const DAILY_REWARD_LIMIT = process.env.DAILY_REWARD_LIMIT || ethers.parseEther("1");
    const MAX_BATCH_SIZE = process.env.MAX_BATCH_SIZE || 200;

    try {
        // Configure game parameters (if the game contract has these functions)
        console.log("Configuring game parameters...");
        // await game.setDailyRewardLimit(DAILY_REWARD_LIMIT);
        // await game.setMaxBatchSize(MAX_BATCH_SIZE);

        // Grant additional roles if needed
        if (GAME_ADMIN_ADDRESS && GAME_ADMIN_ADDRESS !== deployer.address) {
            console.log("Granting admin role to:", GAME_ADMIN_ADDRESS);
            const DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
            await token.grantRole(DEFAULT_ADMIN_ROLE, GAME_ADMIN_ADDRESS);
        }

        // Verify current state
        console.log("\n=== Verification ===");
        const tokenBalance = await token.balanceOf(GAME_ADDRESS);
        const totalSupply = await token.totalSupply();

        console.log("Token Contract:", TOKEN_ADDRESS);
        console.log("Game Contract:", GAME_ADDRESS);
        console.log("Total Supply:", ethers.formatEther(totalSupply));
        console.log("Game Contract Balance:", ethers.formatEther(tokenBalance));

        // Check roles
        const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
        const hasOperatorRole = await token.hasRole(GAME_OPERATOR_ROLE, GAME_ADDRESS);
        console.log("Game has operator role:", hasOperatorRole);

        console.log("\n=== Setup Complete ===");
        console.log("Your Magic World Token system is ready for use! 🎮");

    } catch (error) {
        console.error("Setup failed:", error.message);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Setup script failed:", error);
        process.exit(1);
    });