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
 * Optimized: BSC only needs 1 confirmation for safety
 */
async function waitForConfirmations(tx, confirmations = 1) {
    console.log(`  Waiting for ${confirmations} confirmation(s)...`);
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
    console.log("║   Magic World Gems Deployment Script                 ║");
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
    const TOKEN_NAME = process.env.TOKEN_NAME || "Magic World Gems";
    const TOKEN_SYMBOL = process.env.TOKEN_SYMBOL || "MWG";
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
    console.log("║   Step 1: Deploy MagicWorldGems                      ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    const MagicWorldGems = await ethers.getContractFactory("MagicWorldGems");
    console.log("  Deploying contract...");
    const token = await MagicWorldGems.deploy(TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY);
    await token.waitForDeployment();
    const tokenAddress = await validateDeployment(token, "MagicWorldGems");
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
    console.log(`Total Supply:         ${ethers.formatEther(INITIAL_SUPPLY)} MWG (100%)`);
    console.log(`Partner Allocation:   ${ethers.formatEther(PARTNER_ALLOCATION)} MWG (10%)`);
    console.log(`Game Allocation:      ${ethers.formatEther(GAME_ALLOCATION)} MWG (90%)`);
    console.log(`  ├─ Player Tasks:    ${ethers.formatEther(GAME_ALLOCATION * 50n / 100n)} MWG (50%)`);
    console.log(`  ├─ Social Followers: ${ethers.formatEther(GAME_ALLOCATION * 5n / 100n)} MWG (5%)`);
    console.log(`  ├─ Social Posters:  ${ethers.formatEther(GAME_ALLOCATION * 15n / 100n)} MWG (15%)`);
    console.log(`  └─ Ecosystem Fund:  ${ethers.formatEther(GAME_ALLOCATION * 30n / 100n)} MWG (30%)\n`);

    // Transfer partner allocation to Partner Vault
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 4: Transfer Tokens to PartnerVault             ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`  Transferring ${ethers.formatEther(PARTNER_ALLOCATION)} MWG...`);
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
    console.log(`  Transferring ${ethers.formatEther(GAME_ALLOCATION)} MWG...`);
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

    // Validate addresses from environment first
    const adminWalletAddress = process.env.ADMIN_WALLET_ADDRESS;
    const gameAdminAddress = process.env.GAME_ADMIN_ADDRESS;

    if (!adminWalletAddress || adminWalletAddress === '') {
        throw new Error("ADMIN_WALLET_ADDRESS not set in .env file");
    }
    if (!gameAdminAddress || gameAdminAddress === '') {
        throw new Error("GAME_ADMIN_ADDRESS not set in .env file");
    }

    console.log(`  Admin Wallet Address: ${adminWalletAddress}`);
    console.log(`  Game Admin Address: ${gameAdminAddress}\n`);

    // Cache all role hashes upfront (optimization)
    console.log("  Fetching role identifiers...");
    const [GAME_OPERATOR_ROLE, REWARD_DISTRIBUTOR_ROLE, GAME_ADMIN_ROLE, PAUSE_ROLE] = await Promise.all([
        token.GAME_OPERATOR_ROLE(),
        game.REWARD_DISTRIBUTOR_ROLE(),
        game.GAME_ADMIN_ROLE(),
        token.PAUSE_ROLE()
    ]);
    console.log(`  ✅ Role identifiers cached\n`);

    // Grant GAME_OPERATOR_ROLE to Game Contract
    console.log("  Granting GAME_OPERATOR_ROLE to Game Contract...");
    const grantRoleTx = await token.grantRole(GAME_OPERATOR_ROLE, gameAddress);
    await waitForConfirmations(grantRoleTx);
    console.log(`  ✅ GAME_OPERATOR_ROLE granted to Game Contract`);

    // Grant roles to ADMIN_WALLET_ADDRESS and GAME_ADMIN_ADDRESS
    // Sequential to avoid nonce/gas price issues on mainnet
    console.log(`\n  Granting operational roles...`);

    console.log(`  Granting REWARD_DISTRIBUTOR_ROLE to admin wallet...`);
    const grantDistributorAdminWalletTx = await game.grantRole(REWARD_DISTRIBUTOR_ROLE, adminWalletAddress);
    await waitForConfirmations(grantDistributorAdminWalletTx);

    console.log(`  Granting GAME_ADMIN_ROLE to admin wallet...`);
    const grantGameAdminAdminWalletTx = await game.grantRole(GAME_ADMIN_ROLE, adminWalletAddress);
    await waitForConfirmations(grantGameAdminAdminWalletTx);

    console.log(`  Granting REWARD_DISTRIBUTOR_ROLE to game admin...`);
    const grantDistributorGameAdminTx = await game.grantRole(REWARD_DISTRIBUTOR_ROLE, gameAdminAddress);
    await waitForConfirmations(grantDistributorGameAdminTx);

    console.log(`  Granting GAME_ADMIN_ROLE to game admin...`);
    const grantGameAdminGameAdminTx = await game.grantRole(GAME_ADMIN_ROLE, gameAdminAddress);
    await waitForConfirmations(grantGameAdminGameAdminTx);

    console.log(`  ✅ REWARD_DISTRIBUTOR_ROLE granted to admin wallet`);
    console.log(`  ✅ GAME_ADMIN_ROLE granted to admin wallet`);
    console.log(`  ✅ REWARD_DISTRIBUTOR_ROLE granted to game admin`);
    console.log(`  ✅ GAME_ADMIN_ROLE granted to game admin`);

    // Grant PAUSE_ROLE to ADMIN_WALLET_ADDRESS in Token Contract
    console.log(`\n  Granting PAUSE_ROLE to admin wallet in Token Contract...`);
    const grantPauseRoleTx = await token.grantRole(PAUSE_ROLE, adminWalletAddress);
    await waitForConfirmations(grantPauseRoleTx);
    console.log(`  ✅ PAUSE_ROLE granted to admin wallet in Token Contract\n`);


    // Transfer admin ownership to ADMIN_WALLET_ADDRESS
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 8: Transfer Admin Ownership                    ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    // Transfer Game Contract admin to ADMIN_WALLET_ADDRESS
    console.log(`  Transferring Game Contract roles to admin wallet...`);
    const DEFAULT_ADMIN_ROLE = await game.DEFAULT_ADMIN_ROLE();

    // Grant DEFAULT_ADMIN_ROLE to admin wallet
    const grantGameDefaultAdminTx = await game.grantRole(DEFAULT_ADMIN_ROLE, adminWalletAddress);
    await waitForConfirmations(grantGameDefaultAdminTx);
    console.log(`  ✅ Game Contract DEFAULT_ADMIN_ROLE granted to admin wallet`);

    // Revoke deployer's roles from Game Contract
    // IMPORTANT: Revoke other roles BEFORE DEFAULT_ADMIN_ROLE
    console.log(`  Revoking deployer's roles from Game Contract...`);
    const revokeGameAdminRoleTx = await game.revokeRole(GAME_ADMIN_ROLE, deployer.address);
    await waitForConfirmations(revokeGameAdminRoleTx);

    const revokeRewardDistributorTx = await game.revokeRole(REWARD_DISTRIBUTOR_ROLE, deployer.address);
    await waitForConfirmations(revokeRewardDistributorTx);

    // Revoke DEFAULT_ADMIN_ROLE last
    const revokeGameAdminTx = await game.revokeRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await waitForConfirmations(revokeGameAdminTx);
    console.log(`  ✅ Deployer's Game Contract roles revoked (GAME_ADMIN, REWARD_DISTRIBUTOR, DEFAULT_ADMIN)`);

    // Transfer PartnerVault admin to ADMIN_WALLET_ADDRESS
    console.log(`  Transferring PartnerVault roles to admin wallet...`);
    const VAULT_DEFAULT_ADMIN_ROLE = await partnerVault.DEFAULT_ADMIN_ROLE();
    const VAULT_ADMIN_ROLE = await partnerVault.ADMIN_ROLE();

    // Grant roles sequentially to avoid nonce issues
    console.log(`  Granting PartnerVault DEFAULT_ADMIN_ROLE...`);
    const grantVaultDefaultAdminTx = await partnerVault.grantRole(VAULT_DEFAULT_ADMIN_ROLE, adminWalletAddress);
    await waitForConfirmations(grantVaultDefaultAdminTx);

    console.log(`  Granting PartnerVault ADMIN_ROLE...`);
    const grantVaultAdminRoleTx = await partnerVault.grantRole(VAULT_ADMIN_ROLE, adminWalletAddress);
    await waitForConfirmations(grantVaultAdminRoleTx);

    console.log(`  ✅ PartnerVault DEFAULT_ADMIN_ROLE granted to admin wallet`);
    console.log(`  ✅ PartnerVault ADMIN_ROLE granted to admin wallet`);

    // Revoke deployer's roles from PartnerVault
    // IMPORTANT: Revoke ADMIN_ROLE BEFORE DEFAULT_ADMIN_ROLE
    console.log(`  Revoking deployer's roles from PartnerVault...`);
    const revokeVaultAdminRoleTx = await partnerVault.revokeRole(VAULT_ADMIN_ROLE, deployer.address);
    await waitForConfirmations(revokeVaultAdminRoleTx);

    // Revoke DEFAULT_ADMIN_ROLE last
    const revokeVaultDefaultAdminTx = await partnerVault.revokeRole(VAULT_DEFAULT_ADMIN_ROLE, deployer.address);
    await waitForConfirmations(revokeVaultDefaultAdminTx);
    console.log(`  ✅ Deployer's PartnerVault roles revoked (ADMIN, DEFAULT_ADMIN)`);

    // Transfer Token Contract admin to ADMIN_WALLET_ADDRESS
    console.log(`  Transferring Token Contract roles to admin wallet...`);
    const TOKEN_DEFAULT_ADMIN_ROLE = await token.DEFAULT_ADMIN_ROLE();
    const BLACKLIST_MANAGER_ROLE = await token.BLACKLIST_MANAGER_ROLE();

    // Grant roles to admin wallet
    const grantTokenDefaultAdminTx = await token.grantRole(TOKEN_DEFAULT_ADMIN_ROLE, adminWalletAddress);
    await waitForConfirmations(grantTokenDefaultAdminTx);

    const grantBlacklistManagerTx = await token.grantRole(BLACKLIST_MANAGER_ROLE, adminWalletAddress);
    await waitForConfirmations(grantBlacklistManagerTx);
    console.log(`  ✅ Token Contract DEFAULT_ADMIN_ROLE granted to admin wallet`);
    console.log(`  ✅ Token Contract BLACKLIST_MANAGER_ROLE granted to admin wallet`);

    // Revoke deployer's roles from Token Contract
    // IMPORTANT: Revoke other roles BEFORE DEFAULT_ADMIN_ROLE
    console.log(`  Revoking deployer's roles from Token Contract...`);
    const revokeTokenPauseTx = await token.revokeRole(PAUSE_ROLE, deployer.address);
    await waitForConfirmations(revokeTokenPauseTx);

    const revokeBlacklistManagerTx = await token.revokeRole(BLACKLIST_MANAGER_ROLE, deployer.address);
    await waitForConfirmations(revokeBlacklistManagerTx);

    // Revoke DEFAULT_ADMIN_ROLE last
    const revokeTokenAdminTx = await token.revokeRole(TOKEN_DEFAULT_ADMIN_ROLE, deployer.address);
    await waitForConfirmations(revokeTokenAdminTx);
    console.log(`  ✅ Deployer's Token Contract roles revoked (PAUSE, BLACKLIST_MANAGER, DEFAULT_ADMIN)\n`);

    // Verify balances and vault allocations
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 9: Verify Deployment State                     ║");
    console.log("╚════════════════════════════════════════════════════════╝");

    const finalGameBalance = await token.balanceOf(gameAddress);
    const finalPartnerVaultBalance = await token.balanceOf(partnerVaultAddress);
    const deployerBalance = await token.balanceOf(deployer.address);

    console.log("Token Balances:");
    console.log(`  Game Contract:    ${ethers.formatEther(finalGameBalance)} MWG`);
    console.log(`  Partner Vault:    ${ethers.formatEther(finalPartnerVaultBalance)} MWG`);
    console.log(`  Deployer:         ${ethers.formatEther(deployerBalance)} MWG`);

    // Verify vault allocations
    const [playerTasks, socialFollowers, socialPosters, ecosystemFund] = await game.getAllVaultStats();
    console.log("\nVault Allocations:");
    console.log(`  Player Tasks:     ${ethers.formatEther(playerTasks.totalAllocated)} MWG`);
    console.log(`  Social Followers: ${ethers.formatEther(socialFollowers.totalAllocated)} MWG`);
    console.log(`  Social Posters:   ${ethers.formatEther(socialPosters.totalAllocated)} MWG`);
    console.log(`  Ecosystem Fund:   ${ethers.formatEther(ecosystemFund.totalAllocated)} MWG`);

    // Validate total allocation
    const totalVaultAllocation = playerTasks.totalAllocated +
        socialFollowers.totalAllocated +
        socialPosters.totalAllocated +
        ecosystemFund.totalAllocated;

    if (totalVaultAllocation !== GAME_ALLOCATION) {
        console.error(`\n❌ Vault allocation mismatch!`);
        console.error(`  Expected: ${ethers.formatEther(GAME_ALLOCATION)} MWG`);
        console.error(`  Got:      ${ethers.formatEther(totalVaultAllocation)} MWG`);
        throw new Error("Vault allocation validation failed!");
    }

    console.log(`\n✅ All validations passed!\n`);


    // Save deployment info
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Step 10: Save Deployment Information                ║");
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
                pauseRole: adminWalletAddress,
                blacklistManagerRole: adminWalletAddress,
                defaultAdmin: adminWalletAddress,
                previousAdmin: deployer.address
            },
            game: {
                rewardDistributor: [adminWalletAddress, gameAdminAddress],
                gameAdmin: [adminWalletAddress, gameAdminAddress],
                defaultAdmin: adminWalletAddress,
                previousAdmin: deployer.address
            },
            partnerVault: {
                defaultAdmin: adminWalletAddress,
                adminRole: adminWalletAddress,
                previousAdmin: deployer.address
            }
        },
        transactions: {
            tokenDeployment: token.deploymentTransaction().hash,
            gameDeployment: game.deploymentTransaction().hash,
            partnerVaultDeployment: partnerVault.deploymentTransaction().hash,
            partnerTokenTransfer: partnerTransferTx.hash,
            gameTokenTransfer: gameTransferTx.hash,
            vaultInitialization: initializeVaultsTx.hash,
            roleGrants: [
                grantRoleTx.hash,
                grantDistributorAdminWalletTx.hash,
                grantGameAdminAdminWalletTx.hash,
                grantDistributorGameAdminTx.hash,
                grantGameAdminGameAdminTx.hash,
                grantPauseRoleTx.hash,
                grantGameDefaultAdminTx.hash,
                grantVaultDefaultAdminTx.hash,
                grantVaultAdminRoleTx.hash,
                grantTokenDefaultAdminTx.hash,
                grantBlacklistManagerTx.hash
            ],
            roleRevocations: [
                revokeGameAdminTx.hash,
                revokeGameAdminRoleTx.hash,
                revokeRewardDistributorTx.hash,
                revokeVaultDefaultAdminTx.hash,
                revokeVaultAdminRoleTx.hash,
                revokeTokenAdminTx.hash,
                revokeTokenPauseTx.hash,
                revokeBlacklistManagerTx.hash
            ],
            adminTransfer: {
                newAdmin: adminWalletAddress,
                gameAdmin: gameAdminAddress,
                previousAdmin: deployer.address
            }
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
        console.log("║   Step 11: Verify Contracts on Block Explorer         ║");
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
    console.log(`  Total Supply:  ${ethers.formatEther(INITIAL_SUPPLY)} MWG`);
    console.log(`  Game Contract: ${ethers.formatEther(finalGameBalance)} MWG (90%)`);
    console.log(`  Partner Vault: ${ethers.formatEther(finalPartnerVaultBalance)} MWG (10%)\n`);

    console.log("🔐 Important Notes:");
    console.log("  1. Save the contract addresses above");
    console.log("  2. All admin roles transferred to: " + adminWalletAddress);
    console.log("  3. Deployer admin roles have been revoked for security");
    console.log("  4. Partner allocations can be set up via PartnerVault.allocateToPartner()");
    console.log("  5. Rewards can be distributed using Game Contract vault functions");
    console.log("  6. Update your .env file with contract addresses\n");

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
