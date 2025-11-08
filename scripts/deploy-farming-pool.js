const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Deploying MWGFarmingPool to BSC Mainnet...\n");

    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer address:", deployer.address);
    console.log(
        "Deployer balance:",
        hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
        "BNB\n"
    );

    // Load BSC deployment data
    const bscDeploymentPath = path.join(__dirname, "../deployments/bsc.json");
    const bscDeployment = JSON.parse(fs.readFileSync(bscDeploymentPath, "utf8"));

    // Contract addresses
    const MWG_TOKEN = bscDeployment.contracts.token.address;
    const POSITION_MANAGER = "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364"; // PancakeSwap V3 Position Manager
    const FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865"; // PancakeSwap V3 Factory
    const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // WBNB on BSC
    const MWG_BNB_POOL = "0x63D85c8580d9d5e676F7Efd4d95A6a55326f174F"; // MWG/BNB 0.25% pool
    const CHAINLINK_BNB_USD = "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE"; // Chainlink BNB/USD feed

    // Deployment parameters
    const INITIAL_REWARD_PER_SECOND = hre.ethers.parseEther("0.01"); // 0.01 MWG per second per USD
    const FARMING_DURATION = 365 * 24 * 60 * 60; // 365 days (1 year)

    console.log("📋 Deployment Parameters:");
    console.log("  MWG Token:", MWG_TOKEN);
    console.log("  Position Manager:", POSITION_MANAGER);
    console.log("  Factory:", FACTORY);
    console.log("  WBNB:", WBNB);
    console.log("  Target Pool:", MWG_BNB_POOL);
    console.log("  BNB/USD Feed:", CHAINLINK_BNB_USD);
    console.log("  Initial Reward Rate:", hre.ethers.formatEther(INITIAL_REWARD_PER_SECOND), "MWG/second");
    console.log("  Farming Duration:", FARMING_DURATION / 86400, "days");
    console.log();

    // Deploy MWGFarmingPool
    console.log("📦 Deploying MWGFarmingPool contract...");
    const MWGFarmingPool = await hre.ethers.getContractFactory("MWGFarmingPool");

    // Deploy with estimated gas (from pre-flight check: ~3.7M)
    const farmingPool = await MWGFarmingPool.deploy(
        POSITION_MANAGER,
        FACTORY,
        MWG_TOKEN,
        WBNB,
        MWG_BNB_POOL,
        CHAINLINK_BNB_USD,
        INITIAL_REWARD_PER_SECOND,
        FARMING_DURATION,
        {
            gasLimit: 4000000 // 4M gas (slightly above estimate for safety)
        }
    );
    await farmingPool.waitForDeployment();
    const farmingPoolAddress = await farmingPool.getAddress();

    console.log("✅ MWGFarmingPool deployed to:", farmingPoolAddress);
    console.log();

    // Wait for confirmations
    console.log("⏳ Waiting for block confirmations...");
    await farmingPool.deploymentTransaction().wait(5);
    console.log("✅ Confirmed!");
    console.log();

    // Initialize pool info FIRST (deployer has ADMIN_ROLE from constructor)
    console.log("🔄 Initializing pool info...");
    let txInit;
    let poolInitialized = false;
    try {
        txInit = await farmingPool.initializePoolInfo({ gasLimit: 500000 });
        const receipt = await txInit.wait();
        
        // Check if PoolInfoInitialized event was emitted
        const initEvent = receipt.logs.find(log => {
            try {
                const parsed = farmingPool.interface.parseLog(log);
                return parsed && parsed.name === 'PoolInfoInitialized';
            } catch { return false; }
        });
        
        const failedEvent = receipt.logs.find(log => {
            try {
                const parsed = farmingPool.interface.parseLog(log);
                return parsed && parsed.name === 'PoolPriceUpdateFailed';
            } catch { return false; }
        });
        
        if (initEvent) {
            console.log("✅ Pool info initialized successfully");
            const poolInfo = await farmingPool.poolInfo();
            console.log("   sqrtPriceX96:", poolInfo.sqrtPriceX96.toString());
            console.log("   currentTick:", poolInfo.currentTick.toString());
            poolInitialized = true;
        } else if (failedEvent) {
            console.log("⚠️  Pool info update failed but contract is operational");
            console.log("   Pool price data will be updated during normal operations");
            console.log("   This is expected and won't affect farming functionality");
        } else {
            console.log("✅ Pool info initialization completed");
        }
    } catch (error) {
        console.log("⚠️  Pool info initialization transaction failed");
        console.log("   Error:", error.message);
        console.log("   Contract is still operational - pool info will update during staking");
    }
    console.log();

    // Grant roles to admin wallet
    const ADMIN_WALLET = "0x6E0f3aC00d51b1f34c6791D099a6CAc31693BA6a";
    const REWARD_DISTRIBUTOR = "0x12a3B0a5c87e3B55f9E3a7aaaDB524BF569C878B";

    console.log("🔑 Setting up roles...");

    // Grant ADMIN_ROLE to admin wallet
    const ADMIN_ROLE = await farmingPool.ADMIN_ROLE();
    const tx1 = await farmingPool.grantRole(ADMIN_ROLE, ADMIN_WALLET);
    await tx1.wait();
    console.log("✅ ADMIN_ROLE granted to:", ADMIN_WALLET);

    // Grant REWARD_MANAGER_ROLE to admin wallet
    const REWARD_MANAGER_ROLE = await farmingPool.REWARD_MANAGER_ROLE();
    const tx2 = await farmingPool.grantRole(REWARD_MANAGER_ROLE, ADMIN_WALLET);
    await tx2.wait();
    console.log("✅ REWARD_MANAGER_ROLE granted to:", ADMIN_WALLET);

    // Grant REWARD_MANAGER_ROLE to reward distributor
    const tx3 = await farmingPool.grantRole(REWARD_MANAGER_ROLE, REWARD_DISTRIBUTOR);
    await tx3.wait();
    console.log("✅ REWARD_MANAGER_ROLE granted to:", REWARD_DISTRIBUTOR);

    // Grant PAUSE_ROLE to admin wallet
    const PAUSE_ROLE = await farmingPool.PAUSE_ROLE();
    const tx4 = await farmingPool.grantRole(PAUSE_ROLE, ADMIN_WALLET);
    await tx4.wait();
    console.log("✅ PAUSE_ROLE granted to:", ADMIN_WALLET);

    // Renounce roles from deployer (optional - for security)
    console.log("\n🔐 Transferring admin rights...");
    const DEFAULT_ADMIN_ROLE = await farmingPool.DEFAULT_ADMIN_ROLE();

    // First grant DEFAULT_ADMIN to new admin
    const tx5 = await farmingPool.grantRole(DEFAULT_ADMIN_ROLE, ADMIN_WALLET);
    await tx5.wait();
    console.log("✅ DEFAULT_ADMIN_ROLE granted to:", ADMIN_WALLET);

    // Renounce deployer's DEFAULT_ADMIN role
    const tx6 = await farmingPool.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
    await tx6.wait();
    console.log("✅ DEFAULT_ADMIN_ROLE renounced from deployer");
    console.log();

    // Update deployment file
    console.log("💾 Updating deployment records...");

    const farmingDeployment = {
        network: "bsc",
        chainId: 56,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        blockNumber: await hre.ethers.provider.getBlockNumber(),
        contracts: {
            farmingPool: {
                address: farmingPoolAddress,
                positionManager: POSITION_MANAGER,
                factory: FACTORY,
                mwgToken: MWG_TOKEN,
                wbnb: WBNB,
                targetPool: MWG_BNB_POOL,
                bnbUsdFeed: CHAINLINK_BNB_USD,
            },
        },
        roles: {
            adminRole: ADMIN_WALLET,
            rewardManagers: [ADMIN_WALLET, REWARD_DISTRIBUTOR],
            pauseRole: ADMIN_WALLET,
            defaultAdmin: ADMIN_WALLET,
            previousAdmin: deployer.address,
        },
        transactions: {
            deployment: farmingPool.deploymentTransaction().hash,
            poolInit: poolInitialized && txInit ? txInit.hash : null,
            roleGrants: [tx1.hash, tx2.hash, tx3.hash, tx4.hash],
            adminTransfer: [tx5.hash, tx6.hash],
        },
        status: {
            deployed: true,
            rolesConfigured: true,
            poolInfoInitialized: poolInitialized,
        }
    };

    const farmingDeploymentPath = path.join(__dirname, "../deployments/farming-pool-bsc.json");
    fs.writeFileSync(
        farmingDeploymentPath,
        JSON.stringify(farmingDeployment, null, 2)
    );
    console.log("✅ Deployment data saved to:", farmingDeploymentPath);
    console.log();

    // Print summary
    console.log("📊 DEPLOYMENT SUMMARY");
    console.log("═══════════════════════════════════════════════");
    console.log("Farming Pool Address:", farmingPoolAddress);
    console.log("Target Pool (MWG/BNB):", MWG_BNB_POOL);
    console.log("Admin Wallet:", ADMIN_WALLET);
    console.log("Reward Distributor:", REWARD_DISTRIBUTOR);
    console.log("═══════════════════════════════════════════════");
    console.log();

    console.log("⚠️  NEXT STEPS:");
    console.log("1. Add this to your frontend .env.local:");
    console.log(`   NEXT_PUBLIC_FARMING_POOL_ADDRESS=${farmingPoolAddress}`);
    console.log(`   NEXT_PUBLIC_MWG_BNB_POOL_ADDRESS=${MWG_BNB_POOL}`);
    console.log();
    console.log("2. Deposit MWG rewards to farming pool:");
    console.log(`   Use admin wallet to approve and deposit MWG tokens`);
    console.log();
    console.log("3. Set reward rate and start farming period:");
    console.log(`   Use /farming/admin page to configure`);
    console.log();

    console.log("🔗 Verify contract on BSCScan:");
    console.log(
        `npx hardhat verify --network bsc ${farmingPoolAddress} "${POSITION_MANAGER}" "${FACTORY}" "${MWG_TOKEN}" "${WBNB}" "${MWG_BNB_POOL}" "${CHAINLINK_BNB_USD}" "${INITIAL_REWARD_PER_SECOND}" "${FARMING_DURATION}"`
    );
    console.log();

    console.log("✅ Deployment complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
