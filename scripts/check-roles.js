const { ethers } = require('hardhat');

async function main() {
    // Get the deployer/admin account
    const [deployer] = await ethers.getSigners();
    console.log('Checking roles with account:', deployer.address);

    // Get Game contract
    const gameAddress = process.env.GAME_CONTRACT_ADDRESS || '0x942dd0207feC11F92676d7D1a10498ea1473439A';
    const Game = await ethers.getContractAt('MagicWorldGame', gameAddress);

    const apiWallet = process.env.GAME_ADMIN_ADDRESS || '0x178113A73061f2049268CEbaDbF753E93B2Aa965';

    console.log('🔍 Checking roles for:', apiWallet);
    console.log('Game Contract:', gameAddress);
    console.log('');

    // Define roles
    const roles = {
        'DEFAULT_ADMIN_ROLE': ethers.ZeroHash,
        'REWARD_DISTRIBUTOR_ROLE': ethers.keccak256(ethers.toUtf8Bytes('REWARD_DISTRIBUTOR_ROLE')),
        'GAME_ADMIN_ROLE': ethers.keccak256(ethers.toUtf8Bytes('GAME_ADMIN_ROLE')),
        'PAUSE_ROLE': ethers.keccak256(ethers.toUtf8Bytes('PAUSE_ROLE')),
        'VAULT_ROLE': ethers.keccak256(ethers.toUtf8Bytes('VAULT_ROLE'))
    };

    console.log('📋 Roles Status:');
    for (const [name, hash] of Object.entries(roles)) {
        const hasRole = await Game.hasRole(hash, apiWallet);
        console.log(`${hasRole ? '✅' : '❌'} ${name}`);
        if (name === 'REWARD_DISTRIBUTOR_ROLE') {
            console.log(`   Role Hash: ${hash}`);
        }
    }

    // Check admin's roles too
    console.log('\n📋 Admin Roles (deployer):');
    for (const [name, hash] of Object.entries(roles)) {
        const hasRole = await Game.hasRole(hash, deployer.address);
        console.log(`${hasRole ? '✅' : '❌'} ${name}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
