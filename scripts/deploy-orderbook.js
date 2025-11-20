const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("\n=== MWGOrderBook Deployment Script ===\n");

    const [deployer] = await hre.ethers.getSigners();
    const network = hre.network.name;

    console.log("Deploying from account:", deployer.address);
    console.log("Network:", network);
    console.log("Account balance:", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "BNB/ETH");

    // Load admin addresses from environment variables
    const adminAddress = process.env.ORDER_BOOK_ADMIN_ADDRESS;
    const pauseAddress = process.env.ORDER_BOOK_PAUSE_ADDRESS;

    if (!adminAddress) {
        throw new Error("ORDER_BOOK_ADMIN_ADDRESS not set in .env file");
    }
    if (!pauseAddress) {
        throw new Error("ORDER_BOOK_PAUSE_ADDRESS not set in .env file");
    }

    console.log("Admin address:", adminAddress);
    console.log("Pause address:", pauseAddress);

    // Get MWG token address from existing deployments
    let mwgTokenAddress;

    if (network === "bsc") {
        // BSC Mainnet
        const bscDeployment = require("../deployments/bsc.json");
        mwgTokenAddress = bscDeployment.contracts.token?.address || bscDeployment.MagicWorldGems;
        console.log("Using MWG Token from BSC mainnet:", mwgTokenAddress);
    } else if (network === "bscTestnet") {
        // BSC Testnet
        const testnetDeployment = require("../deployments/bscTestnet.json");
        mwgTokenAddress = testnetDeployment.contracts.token?.address || testnetDeployment.MagicWorldGems;
        console.log("Using MWG Token from BSC testnet:", mwgTokenAddress);
    } else if (network === "polygonAmoy") {
        // Polygon Amoy Testnet
        const amoyDeployment = require("../deployments/polygonAmoy.json");
        mwgTokenAddress = amoyDeployment.contracts.token?.address || amoyDeployment.MagicWorldGems;
        console.log("Using MWG Token from Polygon Amoy testnet:", mwgTokenAddress);
    } else if (network === "hardhat" || network === "localhost") {
        // For local testing, deploy a mock token
        console.log("\nDeploying mock MWG token for local testing...");
        const MagicWorldGems = await hre.ethers.getContractFactory("MagicWorldGems");
        const mwgToken = await MagicWorldGems.deploy(deployer.address);
        await mwgToken.waitForDeployment();
        mwgTokenAddress = await mwgToken.getAddress();
        console.log("Mock MWG Token deployed to:", mwgTokenAddress);
    } else {
        throw new Error(`Unsupported network: ${network}. Please add MWG token address for this network.`);
    }

    if (!mwgTokenAddress) {
        throw new Error(`MWG token address not found in deployments/${network}.json`);
    }

    console.log("\n--- Deploying MWGOrderBook ---");

    // Deploy MWGOrderBook with deployer as initial admin
    // We'll transfer admin rights after configuration
    const MWGOrderBook = await hre.ethers.getContractFactory("MWGOrderBook");
    const orderBook = await MWGOrderBook.deploy(
        mwgTokenAddress,
        deployer.address // Deployer is initial admin for setup
    );

    await orderBook.waitForDeployment();
    const orderBookAddress = await orderBook.getAddress();

    console.log("MWGOrderBook deployed to:", orderBookAddress);

    // Get deployment transaction details
    const deploymentTx = orderBook.deploymentTransaction();
    console.log("Deployment transaction hash:", deploymentTx.hash);
    console.log("Deployment gas used:", deploymentTx.gasLimit.toString());

    // Configure initial parameters (optional - can be changed later by admin)
    console.log("\n--- Configuring Initial Parameters ---");

    const minMWGAmount = hre.ethers.parseEther("100"); // 100 MWG
    const minBNBAmount = hre.ethers.parseEther("0.0001"); // 0.0001 BNB
    const feePercentage = 0; // 0% fee initially (can be set to 100 = 1%, 200 = 2%, etc.)
    const feeRecipient = deployer.address;

    console.log("Setting minimum amounts...");
    console.log("- Min MWG:", hre.ethers.formatEther(minMWGAmount), "MWG");
    console.log("- Min BNB:", hre.ethers.formatEther(minBNBAmount), "BNB");

    const setMinTx = await orderBook.setMinimumAmounts(minMWGAmount, minBNBAmount);
    await setMinTx.wait();
    console.log("✓ Minimum amounts set");

    console.log("\nSetting fee parameters...");
    console.log("- Fee percentage:", feePercentage / 100, "%");
    console.log("- Fee recipient:", feeRecipient);

    const setFeeTx = await orderBook.setFee(feePercentage, feeRecipient);
    await setFeeTx.wait();
    console.log("✓ Fee parameters set");

    // Grant PAUSE_ROLE to pause address if different from admin
    console.log("\n--- Setting Up Roles ---");
    const PAUSE_ROLE = await orderBook.PAUSE_ROLE();
    const ADMIN_ROLE = await orderBook.ADMIN_ROLE();
    const DEFAULT_ADMIN_ROLE = await orderBook.DEFAULT_ADMIN_ROLE();

    // Grant ADMIN_ROLE to designated admin (if different from deployer)
    if (deployer.address.toLowerCase() !== adminAddress.toLowerCase()) {
        console.log("Granting ADMIN_ROLE to:", adminAddress);
        const grantAdminTx = await orderBook.grantRole(ADMIN_ROLE, adminAddress);
        await grantAdminTx.wait();
        console.log("✓ ADMIN_ROLE granted");
    }

    if (pauseAddress.toLowerCase() !== adminAddress.toLowerCase()) {
        console.log("Granting PAUSE_ROLE to:", pauseAddress);
        const grantPauseTx = await orderBook.grantRole(PAUSE_ROLE, pauseAddress);
        await grantPauseTx.wait();
        console.log("✓ PAUSE_ROLE granted");
    } else {
        console.log("PAUSE_ROLE: Using admin address (same as ADMIN_ROLE)");
    }

    // Revoke deployer's admin role (transfer ownership to designated admin)
    console.log("\n--- Revoking Deployer Permissions ---");

    // Grant DEFAULT_ADMIN_ROLE to the designated admin first (if different)
    if (deployer.address.toLowerCase() !== adminAddress.toLowerCase()) {
        console.log("Granting DEFAULT_ADMIN_ROLE to:", adminAddress);
        const grantDefaultAdminTx = await orderBook.grantRole(DEFAULT_ADMIN_ROLE, adminAddress);
        await grantDefaultAdminTx.wait();
        console.log("✓ DEFAULT_ADMIN_ROLE granted to admin");

        // Revoke deployer's DEFAULT_ADMIN_ROLE
        console.log("Revoking DEFAULT_ADMIN_ROLE from deployer:", deployer.address);
        const revokeDeployerTx = await orderBook.renounceRole(DEFAULT_ADMIN_ROLE, deployer.address);
        await revokeDeployerTx.wait();
        console.log("✓ Deployer's DEFAULT_ADMIN_ROLE revoked");

        // Revoke deployer's ADMIN_ROLE
        console.log("Revoking ADMIN_ROLE from deployer:", deployer.address);
        const revokeAdminTx = await orderBook.renounceRole(ADMIN_ROLE, deployer.address);
        await revokeAdminTx.wait();
        console.log("✓ Deployer's ADMIN_ROLE revoked");

        console.log("✓ Contract ownership transferred to admin");
    } else {
        console.log("Deployer is the admin - no role transfer needed");
    }

    // Save deployment info
    const deploymentInfo = {
        network: network,
        chainId: (await hre.ethers.provider.getNetwork()).chainId.toString(),
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            MWGToken: mwgTokenAddress,
            MWGOrderBook: orderBookAddress
        },
        deploymentTransaction: deploymentTx.hash,
        configuration: {
            minMWGAmount: minMWGAmount.toString(),
            minBNBAmount: minBNBAmount.toString(),
            feePercentage: feePercentage,
            feeRecipient: feeRecipient
        },
        roles: {
            admin: adminAddress,
            pauseAddress: pauseAddress,
            ADMIN_ROLE: await orderBook.ADMIN_ROLE(),
            PAUSE_ROLE: await orderBook.PAUSE_ROLE(),
            DEFAULT_ADMIN_ROLE: await orderBook.DEFAULT_ADMIN_ROLE()
        },
        constants: {
            DEAD_ADDRESS: "0x000000000000000000000000000000000000dEaD",
            MAX_EXPIRY: "2592000" // 30 days in seconds
        }
    };

    // Save to deployments folder
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `orderbook-${network}.json`;
    const filepath = path.join(deploymentsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n✓ Deployment info saved to: deployments/${filename}`);

    // Verification instructions
    console.log("\n=== Deployment Summary ===");
    console.log("Network:", network);
    console.log("MWG Token:", mwgTokenAddress);
    console.log("Order Book:", orderBookAddress);
    console.log("Deployer:", deployer.address);
    console.log("Admin:", adminAddress);
    console.log("Pause Address:", pauseAddress);
    console.log("\nConfiguration:");
    console.log("- Min MWG Amount:", hre.ethers.formatEther(minMWGAmount), "MWG");
    console.log("- Min BNB Amount:", hre.ethers.formatEther(minBNBAmount), "BNB");
    console.log("- Fee:", feePercentage / 100, "%");
    console.log("- Fee Recipient:", feeRecipient);

    // Auto-verify on supported networks
    if (network === "bsc" || network === "bscTestnet") {
        console.log("\n=== Verifying Contract on BSCScan ===");
        try {
            console.log("Waiting 30 seconds for BSCScan to index the contract...");
            await new Promise(resolve => setTimeout(resolve, 30000));

            console.log("Verifying MWGOrderBook contract...");
            await hre.run("verify:verify", {
                address: orderBookAddress,
                constructorArguments: [
                    mwgTokenAddress,
                    deployer.address // Contract was deployed with deployer as initial admin
                ],
            });
            console.log("✓ Contract verified successfully!");
            console.log(`View on BSCScan: https://${network === "bsc" ? "" : "testnet."}bscscan.com/address/${orderBookAddress}`);
        } catch (error) {
            if (error.message.includes("Already Verified")) {
                console.log("✓ Contract already verified!");
                console.log(`View on BSCScan: https://${network === "bsc" ? "" : "testnet."}bscscan.com/address/${orderBookAddress}`);
            } else {
                console.error("❌ Verification failed:");
                console.error(error.message);
                console.log("\nYou can verify manually later with:");
                console.log(`npx hardhat verify --network ${network} ${orderBookAddress} "${mwgTokenAddress}" "${deployer.address}"`);
            }
        }
    }

    console.log("\n=== Security Status ===");
    if (deployer.address.toLowerCase() !== adminAddress.toLowerCase()) {
        console.log("✓ Deployer permissions revoked");
        console.log("✓ Admin role transferred to:", adminAddress);
        console.log("✓ Pause role granted to:", pauseAddress);
    } else {
        console.log("⚠ Deployer is the admin (no permission transfer)");
    }

    console.log("\n=== Next Steps ===");
    console.log("1. Verify contract on block explorer (if mainnet/testnet)");
    console.log("2. Test creating orders through the contract");
    console.log("3. Update frontend configuration with contract address");
    console.log("4. Update API with contract ABI and address");
    console.log("5. Start event listener service for order monitoring");
    console.log("6. Set appropriate fee percentage if needed (currently 0%)");

    return {
        mwgToken: mwgTokenAddress,
        orderBook: orderBookAddress,
        deployer: deployer.address,
        admin: adminAddress,
        pauseAddress: pauseAddress
    };
}

// Handle errors
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Deployment failed:");
        console.error(error);
        process.exit(1);
    });

module.exports = main;
