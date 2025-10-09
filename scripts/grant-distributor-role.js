const { ethers } = require('hardhat');

async function main() {
    // Get the deployer/admin account
    const [deployer] = await ethers.getSigners();
    console.log('Granting role with admin account:', deployer.address);

    // Get Game contract
    const gameAddress = process.env.GAME_CONTRACT_ADDRESS || '0x942dd0207feC11F92676d7D1a10498ea1473439A';
    const Game = await ethers.getContractAt('MagicWorldGame', gameAddress);

    // Role hash
    const REWARD_DISTRIBUTOR_ROLE = ethers.keccak256(ethers.toUtf8Bytes('REWARD_DISTRIBUTOR_ROLE'));

    // API wallet address (from GAME_ADMIN_ADDRESS or PRIVATE_KEY)
    const apiWalletAddress = process.env.GAME_ADMIN_ADDRESS || '0x178113A73061f2049268CEbaDbF753E93B2Aa965';

    console.log('\n📋 Role Details:');
    console.log('Role Name: REWARD_DISTRIBUTOR_ROLE');
    console.log('Role Hash:', REWARD_DISTRIBUTOR_ROLE);
    console.log('Granting to:', apiWalletAddress);
    console.log('Game Contract:', gameAddress);

    // Check if already has role
    const hasRole = await Game.hasRole(REWARD_DISTRIBUTOR_ROLE, apiWalletAddress);

    if (hasRole) {
        console.log('\n✅ Address already has REWARD_DISTRIBUTOR_ROLE');
        return;
    }

    console.log('\n🔄 Granting REWARD_DISTRIBUTOR_ROLE...');

    const tx = await Game.grantRole(REWARD_DISTRIBUTOR_ROLE, apiWalletAddress);
    console.log('Transaction hash:', tx.hash);

    await tx.wait();
    console.log('✅ REWARD_DISTRIBUTOR_ROLE granted successfully!');

    // Verify
    const hasRoleAfter = await Game.hasRole(REWARD_DISTRIBUTOR_ROLE, apiWalletAddress);
    console.log('\nVerification:', hasRoleAfter ? '✅ Role granted' : '❌ Role NOT granted');
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
