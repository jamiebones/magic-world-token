const hre = require('hardhat');
const { keccak256, toUtf8Bytes } = require('ethers');

async function main() {
    const networkName = hre.network.name;
    console.log(`🚀 Granting GAME_ADMIN_ROLE on ${networkName}...\n`);

    // Get deployment info
    const fs = require('fs');
    const deploymentPath = `./deployments/${networkName}.json`;

    if (!fs.existsSync(deploymentPath)) {
        throw new Error(`No deployment found for network: ${networkName}`);
    }

    const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
    console.log('📝 Deployment Info:');
    console.log('Game Contract:', deployment.gameContract);
    console.log('Deployer:', deployment.deployer);
    console.log('Network:', deployment.network);
    console.log();

    // Get signer (deployer with admin rights)
    const [deployer] = await hre.ethers.getSigners();
    console.log('👤 Signer:', deployer.address);

    // Get the Game contract
    const MagicWorldGame = await hre.ethers.getContractFactory('MagicWorldGame');
    const gameContract = MagicWorldGame.attach(deployment.gameContract);

    // The API wallet address (from PRIVATE_KEY)
    const apiWalletAddress = '0x0A0Cfbf38Ca51F39bD6947a0708E1965E6E0f6B8';
    console.log('🎯 Target wallet (API):', apiWalletAddress);
    console.log();

    // Calculate GAME_ADMIN_ROLE
    const GAME_ADMIN_ROLE = keccak256(toUtf8Bytes('GAME_ADMIN_ROLE'));
    console.log('🔑 GAME_ADMIN_ROLE:', GAME_ADMIN_ROLE);

    // Check if already has role
    const hasRole = await gameContract.hasRole(GAME_ADMIN_ROLE, apiWalletAddress);
    console.log('Has GAME_ADMIN_ROLE already?', hasRole);
    console.log();

    if (hasRole) {
        console.log('✅ API wallet already has GAME_ADMIN_ROLE. Nothing to do.');
        return;
    }

    // Grant the role
    console.log('📤 Granting GAME_ADMIN_ROLE to API wallet...');
    const tx = await gameContract.grantRole(GAME_ADMIN_ROLE, apiWalletAddress);
    console.log('Transaction hash:', tx.hash);

    console.log('⏳ Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('✅ Role granted! Block:', receipt.blockNumber);

    // Verify
    const hasRoleNow = await gameContract.hasRole(GAME_ADMIN_ROLE, apiWalletAddress);
    console.log('\n🔍 Verification:');
    console.log('API wallet now has GAME_ADMIN_ROLE?', hasRoleNow);

    if (hasRoleNow) {
        console.log('\n🎉 SUCCESS! API wallet can now create Merkle distributions.');
    } else {
        console.log('\n⚠️  WARNING: Role grant may have failed. Please check manually.');
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Error:', error);
        process.exit(1);
    });
