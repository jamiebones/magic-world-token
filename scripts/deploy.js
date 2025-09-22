const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
    console.log("Starting Magic World Token deployment...");

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", ethers.formatEther(balance), "MATIC");

    // Token configuration from environment or defaults
    const TOKEN_NAME = process.env.TOKEN_NAME || "Magic World Token";
    const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "MWT";
    const TOKEN_DECIMALS = process.env.TOKEN_DECIMALS || 18;
    const INITIAL_SUPPLY = process.env.INITIAL_SUPPLY || ethers.parseEther("1000000000"); // 1 billion tokens

    console.log("\n=== Token Configuration ===");
    console.log("Name:", TOKEN_NAME);
    console.log("Symbol:", TOKEN_SYMBOL);
    console.log("Decimals:", TOKEN_DECIMALS);
    console.log("Initial Supply:", ethers.formatEther(INITIAL_SUPPLY));

    // Deploy Token Contract
    console.log("\n=== Deploying MagicWorldToken ===");
    const MagicWorldToken = await ethers.getContractFactory("MagicWorldToken");
    const token = await MagicWorldToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();

    console.log("MagicWorldToken deployed to:", tokenAddress);

    // Deploy Game Contract
    console.log("\n=== Deploying MagicWorldGame ===");
    const MagicWorldGame = await ethers.getContractFactory("MagicWorldGame");
    const game = await MagicWorldGame.deploy(tokenAddress);
    await game.waitForDeployment();
    const gameAddress = await game.getAddress();

    console.log("MagicWorldGame deployed to:", gameAddress);

    // Transfer all tokens to Game Contract
    console.log("\n=== Transferring tokens to Game Contract ===");
    const transferTx = await token.transfer(gameAddress, INITIAL_SUPPLY);
    await transferTx.wait();
    console.log("All tokens transferred to Game Contract");

    // Grant GAME_OPERATOR_ROLE to Game Contract
    console.log("\n=== Setting up roles ===");
    const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
    const grantRoleTx = await token.grantRole(GAME_OPERATOR_ROLE, gameAddress);
    await grantRoleTx.wait();
    console.log("GAME_OPERATOR_ROLE granted to Game Contract");

    // Verify balances
    const gameBalance = await token.balanceOf(gameAddress);
    const deployerBalance = await token.balanceOf(deployer.address);

    console.log("\n=== Deployment Summary ===");
    console.log("Token Contract:", tokenAddress);
    console.log("Game Contract:", gameAddress);
    console.log("Game Contract Token Balance:", ethers.formatEther(gameBalance));
    console.log("Deployer Token Balance:", ethers.formatEther(deployerBalance));

    // Save deployment info
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            token: {
                address: tokenAddress,
                name: TOKEN_NAME,
                symbol: TOKEN_SYMBOL,
                decimals: TOKEN_DECIMALS,
                totalSupply: INITIAL_SUPPLY.toString()
            },
            game: {
                address: gameAddress
            }
        },
        transactions: {
            tokenDeployment: token.deploymentTransaction().hash,
            gameDeployment: game.deploymentTransaction().hash,
            tokenTransfer: transferTx.hash,
            roleGrant: grantRoleTx.hash
        }
    };

    console.log("\n=== Next Steps ===");
    console.log("1. Copy .env.example to .env and fill in your configuration");
    console.log("2. Run setup script: npm run setup:" + hre.network.name);
    console.log("3. Verify contracts: npm run verify:" + hre.network.name, tokenAddress, gameAddress);
    console.log("\nDeployment completed successfully! 🚀");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });