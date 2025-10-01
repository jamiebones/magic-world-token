const { ethers } = require("hardhat");
const fs = require('fs');
const path = require('path');
require("dotenv").config();

/**
 * Helper function to get network native currency symbol
 */
function getNetworkCurrency(networkName) {
    const currencyMap = {
        'bsc': 'BNB',
        'bscTestnet': 'BNB',
        'polygon': 'MATIC',
        'polygonAmoy': 'MATIC',
        'ethereum': 'ETH',
        'hardhat': 'ETH',
        'localhost': 'ETH'
    };
    return currencyMap[networkName] || 'ETH';
}

/**
 * Helper function to wait for transaction confirmations
 */
async function waitForConfirmations(tx, confirmations = 2) {
    console.log(`  Waiting for ${confirmations} confirmations...`);
    const receipt = await tx.wait(confirmations);
    console.log(`  ✅ Confirmed in block ${receipt.blockNumber}`);
    return receipt;
}

/**
 * Helper function to validate contract deployment
 */
async function validateDeployment(contract, contractName) {
    const address = await contract.getAddress();
    const code = await ethers.provider.getCode(address);

    if (code === '0x') {
        throw new Error(`${contractName} deployment failed - no code at address ${address}`);
    }

    console.log(`  ✅ ${contractName} deployed successfully`);
    return address;
}

async function main() {
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Magic World Token Deployment Script                 ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    // Get network info
    const networkName = hre.network.name;
    const networkCurrency = getNetworkCurrency(networkName);

    console.log(`Network: ${networkName}`);
    console.log(`Chain ID: ${(await ethers.provider.getNetwork()).chainId}`);

    // Get deployer account
    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const balance = await ethers.provider.getBalance(deployer.address);
    console.log(`Balance: ${ethers.formatEther(balance)} ${networkCurrency}\n`);


    // Token configuration from environment or defaults
    const TOKEN_NAME = process.env.TOKEN_NAME || "Magic World Token";
    const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "MWT";
    const TOKEN_DECIMALS = process.env.TOKEN_DECIMALS || 18;
    const INITIAL_SUPPLY = process.env.INITIAL_SUPPLY
        ? BigInt(process.env.INITIAL_SUPPLY)
        : ethers.parseEther("1000000000"); // 1 billion tokens

    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Token Configuration                                  ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`Name:           ${TOKEN_NAME}`);
    console.log(`Symbol:         ${TOKEN_SYMBOL}`);
    console.log(`Decimals:       ${TOKEN_DECIMALS}`);
    console.log(`Initial Supply: ${ethers.formatEther(INITIAL_SUPPLY)} tokens\n`);

    // Deploy Token Contract
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 1: Deploy MagicWorldToken                      ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    const MagicWorldToken = await ethers.getContractFactory("MagicWorldToken");
    console.log("  Deploying contract...");
    const token = await MagicWorldToken.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    await token.waitForDeployment();
    const tokenAddress = await validateDeployment(token, "MagicWorldToken");
    console.log(`  Address: ${tokenAddress}\n`);

    // Deploy Game Contract
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 2: Deploy MagicWorldGame                       ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    const MagicWorldGame = await ethers.getContractFactory("MagicWorldGame");
    console.log("  Deploying contract...");
    const game = await MagicWorldGame.deploy(tokenAddress);
    await game.waitForDeployment();
    const gameAddress = await validateDeployment(game, "MagicWorldGame");
    console.log(`  Address: ${gameAddress}\n`);

    // Deploy Partner Vault Contract
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 3: Deploy PartnerVault                         ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    const PartnerVault = await ethers.getContractFactory("PartnerVault");
    console.log("  Deploying contract...");
    const partnerVault = await PartnerVault.deploy(tokenAddress);
    await partnerVault.waitForDeployment();
    const partnerVaultAddress = await validateDeployment(partnerVault, "PartnerVault");
    console.log(`  Address: ${partnerVaultAddress}\n`);


    // Calculate token allocations
    const PARTNER_ALLOCATION = INITIAL_SUPPLY / 10n; // 10% for partners
    const GAME_ALLOCATION = INITIAL_SUPPLY - PARTNER_ALLOCATION; // 90% for game vaults

    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Token Allocation Plan                                ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`Total Supply:         ${ethers.formatEther(INITIAL_SUPPLY)} MWT (100%)`);
    console.log(`Partner Allocation:   ${ethers.formatEther(PARTNER_ALLOCATION)} MWT (10%)`);
    console.log(`Game Allocation:      ${ethers.formatEther(GAME_ALLOCATION)} MWT (90%)`);
    console.log(`  ├─ Player Tasks:    ${ethers.formatEther(GAME_ALLOCATION * 50n / 100n)} MWT (50%)`);
    console.log(`  ├─ Social Followers: ${ethers.formatEther(GAME_ALLOCATION * 5n / 100n)} MWT (5%)`);
    console.log(`  ├─ Social Posters:  ${ethers.formatEther(GAME_ALLOCATION * 15n / 100n)} MWT (15%)`);
    console.log(`  └─ Ecosystem Fund:  ${ethers.formatEther(GAME_ALLOCATION * 30n / 100n)} MWT (30%)\n`);

    // Transfer partner allocation to Partner Vault
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 4: Transfer Tokens to PartnerVault             ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`  Transferring ${ethers.formatEther(PARTNER_ALLOCATION)} MWT...`);
    const partnerTransferTx = await token.transfer(partnerVaultAddress, PARTNER_ALLOCATION);
    await waitForConfirmations(partnerTransferTx);

    // Validate transfer
    const partnerVaultBalance = await token.balanceOf(partnerVaultAddress);
    if (partnerVaultBalance !== PARTNER_ALLOCATION) {
        throw new Error("Partner vault balance mismatch!");
    }
    console.log(`  ✅ Partner tokens transferred successfully\n`);

    // Transfer game allocation to Game Contract
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 5: Transfer Tokens to Game Contract            ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`  Transferring ${ethers.formatEther(GAME_ALLOCATION)} MWT...`);
    const gameTransferTx = await token.transfer(gameAddress, GAME_ALLOCATION);
    await waitForConfirmations(gameTransferTx);

    // Validate transfer
    const gameBalance = await token.balanceOf(gameAddress);
    if (gameBalance !== GAME_ALLOCATION) {
        throw new Error("Game contract balance mismatch!");
    }
    console.log(`  ✅ Game tokens transferred successfully\n`);

    // Initialize vaults in Game Contract
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 6: Initialize Game Vaults                      ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("  Initializing vault allocations...");
    const initializeVaultsTx = await game.initializeVaults(INITIAL_SUPPLY, PARTNER_ALLOCATION);
    await waitForConfirmations(initializeVaultsTx);

    // Validate vault initialization
    const vaultsInitialized = await game.vaultsInitialized();
    if (!vaultsInitialized) {
        throw new Error("Vault initialization failed!");
    }
    console.log(`  ✅ Vaults initialized successfully\n`);


    // Grant GAME_OPERATOR_ROLE to Game Contract
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 7: Setup Roles and Permissions                 ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log("  Granting GAME_OPERATOR_ROLE to Game Contract...");
    const GAME_OPERATOR_ROLE = await token.GAME_OPERATOR_ROLE();
    const grantRoleTx = await token.grantRole(GAME_OPERATOR_ROLE, gameAddress);
    await waitForConfirmations(grantRoleTx);

    // Validate role grant
    const hasOperatorRole = await token.hasRole(GAME_OPERATOR_ROLE, gameAddress);
    if (!hasOperatorRole) {
        throw new Error("Failed to grant GAME_OPERATOR_ROLE to Game Contract!");
    }
    console.log(`  ✅ GAME_OPERATOR_ROLE granted to Game Contract`);

    // Grant REWARD_DISTRIBUTOR_ROLE to deployer (so they can distribute rewards initially)
    console.log("  Granting REWARD_DISTRIBUTOR_ROLE to deployer...");
    const REWARD_DISTRIBUTOR_ROLE = await game.REWARD_DISTRIBUTOR_ROLE();
    const grantDistributorTx = await game.grantRole(REWARD_DISTRIBUTOR_ROLE, deployer.address);
    await waitForConfirmations(grantDistributorTx);

    // Validate role grant
    const hasDistributorRole = await game.hasRole(REWARD_DISTRIBUTOR_ROLE, deployer.address);
    if (!hasDistributorRole) {
        throw new Error("Failed to grant REWARD_DISTRIBUTOR_ROLE to deployer!");
    }
    console.log(`  ✅ REWARD_DISTRIBUTOR_ROLE granted to deployer\n`);


    // Verify balances and vault allocations
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 8: Verify Deployment State                     ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    const finalGameBalance = await token.balanceOf(gameAddress);
    const finalPartnerVaultBalance = await token.balanceOf(partnerVaultAddress);
    const deployerBalance = await token.balanceOf(deployer.address);

    console.log("Token Balances:");
    console.log(`  Game Contract:    ${ethers.formatEther(finalGameBalance)} MWT`);
    console.log(`  Partner Vault:    ${ethers.formatEther(finalPartnerVaultBalance)} MWT`);
    console.log(`  Deployer:         ${ethers.formatEther(deployerBalance)} MWT`);

    // Verify vault allocations
    const [playerTasks, socialFollowers, socialPosters, ecosystemFund] = await game.getAllVaultStats();
    console.log("\nVault Allocations:");
    console.log(`  Player Tasks:     ${ethers.formatEther(playerTasks.totalAllocated)} MWT`);
    console.log(`  Social Followers: ${ethers.formatEther(socialFollowers.totalAllocated)} MWT`);
    console.log(`  Social Posters:   ${ethers.formatEther(socialPosters.totalAllocated)} MWT`);
    console.log(`  Ecosystem Fund:   ${ethers.formatEther(ecosystemFund.totalAllocated)} MWT`);

    // Validate total allocation
    const totalVaultAllocation = playerTasks.totalAllocated +
        socialFollowers.totalAllocated +
        socialPosters.totalAllocated +
        ecosystemFund.totalAllocated;

    if (totalVaultAllocation !== GAME_ALLOCATION) {
        console.error(`\n❌ Vault allocation mismatch!`);
        console.error(`  Expected: ${ethers.formatEther(GAME_ALLOCATION)} MWT`);
        console.error(`  Got:      ${ethers.formatEther(totalVaultAllocation)} MWT`);
        throw new Error("Vault allocation validation failed!");
    }

    console.log(`\n✅ All validations passed!\n`);


    // Save deployment info
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 9: Save Deployment Information                 ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    const deploymentInfo = {
        network: networkName,
        chainId: Number((await ethers.provider.getNetwork()).chainId),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        blockNumber: await ethers.provider.getBlockNumber(),
        tokenAllocation: {
            totalSupply: INITIAL_SUPPLY.toString(),
            partnerAllocation: PARTNER_ALLOCATION.toString(),
            gameAllocation: GAME_ALLOCATION.toString(),
            vaults: {
                playerTasks: {
                    allocated: playerTasks.totalAllocated.toString(),
                    percentage: "50%"
                },
                socialFollowers: {
                    allocated: socialFollowers.totalAllocated.toString(),
                    percentage: "5%"
                },
                socialPosters: {
                    allocated: socialPosters.totalAllocated.toString(),
                    percentage: "15%"
                },
                ecosystemFund: {
                    allocated: ecosystemFund.totalAllocated.toString(),
                    percentage: "30%"
                }
            }
        },
        contracts: {
            token: {
                address: tokenAddress,
                name: TOKEN_NAME,
                symbol: TOKEN_SYMBOL,
                decimals: TOKEN_DECIMALS,
                totalSupply: INITIAL_SUPPLY.toString()
            },
            game: {
                address: gameAddress,
                vaultsInitialized: true
            },
            partnerVault: {
                address: partnerVaultAddress,
                balance: finalPartnerVaultBalance.toString(),
                lockupPeriod: "3 years"
            }
        },
        roles: {
            token: {
                gameOperatorRole: gameAddress,
                defaultAdmin: deployer.address
            },
            game: {
                rewardDistributor: [deployer.address],
                gameAdmin: [deployer.address],
                defaultAdmin: deployer.address
            }
        },
        transactions: {
            tokenDeployment: token.deploymentTransaction().hash,
            gameDeployment: game.deploymentTransaction().hash,
            partnerVaultDeployment: partnerVault.deploymentTransaction().hash,
            partnerTokenTransfer: partnerTransferTx.hash,
            gameTokenTransfer: gameTransferTx.hash,
            vaultInitialization: initializeVaultsTx.hash,
            roleGrants: [grantRoleTx.hash, grantDistributorTx.hash]
        }
    };

    const deploymentsDir = path.join(__dirname, '..', 'deployments');
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const deploymentFile = path.join(deploymentsDir, `${networkName}.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`  ✅ Deployment info saved to: ${deploymentFile}\n`);


    // Verify contracts on Block Explorer (skip for localhost)
    if (networkName !== "localhost" && networkName !== "hardhat") {
        console.log("╔════════════════════════════════════════════════════════╗");
        console.log("║   Step 10: Verify Contracts on Block Explorer         ║");
        console.log("╚════════════════════════════════════════════════════════╝");

        console.log("  Waiting 30 seconds for blockchain indexing...");
        await new Promise(resolve => setTimeout(resolve, 30000));

        const explorerName = networkName.includes('bsc') ? 'BscScan' : 'PolygonScan';

        try {
            console.log(`  Verifying Token Contract on ${explorerName}...`);
            await hre.run("verify:verify", {
                address: tokenAddress,
                constructorArguments: [TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY],
            });
            console.log(`  ✅ Token contract verified`);
        } catch (error) {
            console.log(`  ⚠️  Token verification failed: ${error.message}`);
        }

        try {
            console.log(`  Verifying Game Contract on ${explorerName}...`);
            await hre.run("verify:verify", {
                address: gameAddress,
                constructorArguments: [tokenAddress],
            });
            console.log(`  ✅ Game contract verified`);
        } catch (error) {
            console.log(`  ⚠️  Game verification failed: ${error.message}`);
        }

        try {
            console.log(`  Verifying PartnerVault Contract on ${explorerName}...`);
            await hre.run("verify:verify", {
                address: partnerVaultAddress,
                constructorArguments: [tokenAddress],
            });
            console.log(`  ✅ PartnerVault contract verified`);
        } catch (error) {
            console.log(`  ⚠️  PartnerVault verification failed: ${error.message}`);
        }

        console.log();
    }

    // Print deployment summary
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   DEPLOYMENT SUCCESSFUL! 🚀                            ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    console.log("📋 Contract Addresses:");
    console.log(`  Token:         ${tokenAddress}`);
    console.log(`  Game:          ${gameAddress}`);
    console.log(`  Partner Vault: ${partnerVaultAddress}\n`);

    console.log("📊 Token Distribution:");
    console.log(`  Total Supply:  ${ethers.formatEther(INITIAL_SUPPLY)} MWT`);
    console.log(`  Game Contract: ${ethers.formatEther(finalGameBalance)} MWT (90%)`);
    console.log(`  Partner Vault: ${ethers.formatEther(finalPartnerVaultBalance)} MWT (10%)\n`);

    console.log("🔐 Important Notes:");
    console.log("  1. Save the contract addresses above");
    console.log("  2. Partner allocations can be set up via PartnerVault.allocateToPartner()");
    console.log("  3. Rewards can be distributed using Game Contract vault functions");
    console.log("  4. Update your .env file with contract addresses");
    console.log("  5. Consider transferring admin roles to a multisig wallet\n");

    console.log("📄 Deployment file saved to:");
    console.log(`  ${deploymentFile}\n`);

    console.log("🔗 Useful Links:");
    if (networkName.includes('bsc')) {
        const explorerBase = networkName === 'bsc'
            ? 'https://bscscan.com'
            : 'https://testnet.bscscan.com';
        console.log(`  Token:  ${explorerBase}/address/${tokenAddress}`);
        console.log(`  Game:   ${explorerBase}/address/${gameAddress}`);
        console.log(`  Vault:  ${explorerBase}/address/${partnerVaultAddress}\n`);
    } else if (networkName.includes('polygon')) {
        const explorerBase = networkName === 'polygonAmoy'
            ? 'https://amoy.polygonscan.com'
            : 'https://polygonscan.com';
        console.log(`  Token:  ${explorerBase}/address/${tokenAddress}`);
        console.log(`  Game:   ${explorerBase}/address/${gameAddress}`);
        console.log(`  Vault:  ${explorerBase}/address/${partnerVaultAddress}\n`);
    }

    console.log("✨ Next Steps:");
    console.log("  1. Test token distribution: npx hardhat run scripts/test-distribution.js --network " + networkName);
    console.log("  2. Allocate partner tokens: Use PartnerVault.allocateToPartner()");
    console.log("  3. Setup API: Configure api/.env with contract addresses");
    console.log("  4. Deploy API: Follow api/README.md for Railway deployment\n");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Deployment failed:", error);
        process.exit(1);
    });