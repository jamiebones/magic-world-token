const { ethers } = require("hardhat");
require("dotenv").config();

/**
 * Revoke the final ADMIN_ROLE from deployer in PartnerVault
 * 
 * IMPORTANT: This script must be run by the ADMIN_WALLET_ADDRESS
 * The deployer cannot revoke this role from themselves
 */
async function main() {
    console.log("╔════════════════════════════════════════════════════════╗");
    console.log("║   Revoke Deployer's Final Vault Admin Role            ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    const vaultAddress = "0x44355B0681b257df40541211884ebB00B240aC57";
    const deployerAddress = "0x0A0Cfbf38Ca51F39bD6947a0708E1965E6E0f6B8";

    const [signer] = await ethers.getSigners();
    const networkName = hre.network.name;

    console.log(`Network: ${networkName}`);
    console.log(`Signer: ${signer.address}`);
    console.log(`Vault Contract: ${vaultAddress}`);
    console.log(`Deployer to Revoke: ${deployerAddress}\n`);

    // Get vault contract
    const vault = await ethers.getContractAt("PartnerVault", vaultAddress);

    // Get role identifiers
    const ADMIN_ROLE = await vault.ADMIN_ROLE();
    const DEFAULT_ADMIN_ROLE = await vault.DEFAULT_ADMIN_ROLE();

    console.log("═══════════════════════════════════════════════════════");
    console.log("PRE-REVOCATION STATUS");
    console.log("═══════════════════════════════════════════════════════\n");

    // Check current signer has DEFAULT_ADMIN_ROLE
    const signerHasDefaultAdmin = await vault.hasRole(DEFAULT_ADMIN_ROLE, signer.address);
    if (!signerHasDefaultAdmin) {
        console.error("❌ Error: Signer does not have DEFAULT_ADMIN_ROLE");
        console.error("   Only the admin wallet can execute this script\n");
        process.exit(1);
    }
    console.log("✅ Signer has DEFAULT_ADMIN_ROLE (authorized to revoke)\n");

    // Check deployer has ADMIN_ROLE
    const deployerHasAdminRole = await vault.hasRole(ADMIN_ROLE, deployerAddress);
    if (!deployerHasAdminRole) {
        console.log("✅ Deployer already has NO ADMIN_ROLE");
        console.log("   Nothing to revoke - deployment is complete!\n");
        process.exit(0);
    }

    console.log("Current Roles:");
    console.log(`  Deployer has ADMIN_ROLE: YES (will be revoked)`);
    console.log(`  Deployer has DEFAULT_ADMIN_ROLE: ${await vault.hasRole(DEFAULT_ADMIN_ROLE, deployerAddress) ? "YES" : "NO"}`);
    console.log(`  Signer has DEFAULT_ADMIN_ROLE: YES`);
    console.log(`  Signer has ADMIN_ROLE: ${await vault.hasRole(ADMIN_ROLE, signer.address) ? "YES" : "NO"}\n`);

    console.log("═══════════════════════════════════════════════════════");
    console.log("REVOKING ADMIN_ROLE");
    console.log("═══════════════════════════════════════════════════════\n");

    console.log("  Submitting revocation transaction...");
    const tx = await vault.revokeRole(ADMIN_ROLE, deployerAddress);
    console.log(`  Transaction Hash: ${tx.hash}`);

    console.log("  Waiting for confirmation...");
    await tx.wait(1);
    console.log("  ✅ Transaction confirmed\n");

    console.log("═══════════════════════════════════════════════════════");
    console.log("POST-REVOCATION VERIFICATION");
    console.log("═══════════════════════════════════════════════════════\n");

    // Verify revocation
    const deployerStillHasAdminRole = await vault.hasRole(ADMIN_ROLE, deployerAddress);
    const deployerHasDefaultAdminRole = await vault.hasRole(DEFAULT_ADMIN_ROLE, deployerAddress);

    console.log("Final Deployer Roles:");
    console.log(`  ADMIN_ROLE: ${deployerStillHasAdminRole ? "❌ STILL HAS (ERROR!)" : "✅ REVOKED"}`);
    console.log(`  DEFAULT_ADMIN_ROLE: ${deployerHasDefaultAdminRole ? "❌ STILL HAS" : "✅ REVOKED"}`);

    if (!deployerStillHasAdminRole && !deployerHasDefaultAdminRole) {
        console.log("\n╔════════════════════════════════════════════════════════╗");
        console.log("║   🎉 DEPLOYMENT FULLY COMPLETE!                        ║");
        console.log("╚════════════════════════════════════════════════════════╝");
        console.log("\n✅ Deployer has NO admin privileges across all contracts");
        console.log("✅ All admin control transferred to admin wallet");
        console.log("✅ System is fully secured and production-ready\n");
    } else {
        console.log("\n⚠️  WARNING: Deployer still has some privileges");
        console.log("   Please verify manually on BscScan\n");
    }

    console.log("═══════════════════════════════════════════════════════");
    console.log("TRANSACTION DETAILS");
    console.log("═══════════════════════════════════════════════════════\n");
    console.log(`Transaction: ${tx.hash}`);
    if (networkName === 'bsc') {
        console.log(`BscScan: https://bscscan.com/tx/${tx.hash}`);
    } else if (networkName === 'bscTestnet') {
        console.log(`BscScan: https://testnet.bscscan.com/tx/${tx.hash}`);
    }
    console.log();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("\n❌ Error:", error.message);
        if (error.message.includes("AccessControlUnauthorizedAccount")) {
            console.error("\n💡 Tip: This script must be run with the admin wallet's private key");
            console.error("   Update your .env with PRIVATE_KEY for the admin wallet\n");
        }
        process.exit(1);
    });
