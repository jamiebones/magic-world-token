const { ethers } = require('ethers');

async function main() {
    // Connect to BSC Testnet
    const provider = new ethers.JsonRpcProvider('https://data-seed-prebsc-1-s1.binance.org:8545/');

    // Get wallet from private key in .env (the one API is using)
    const privateKey = 'f139b31774be86fb7759ff7acb4aa45e029df583aaf22562a1c71540fcd56e1a';
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log('🔍 Checking PRIVATE_KEY wallet (used by production API):');
    console.log('Address:', wallet.address);
    console.log('Network: BSC Testnet\n');

    // Get balance
    const balance = await provider.getBalance(wallet.address);
    const balanceInBNB = ethers.formatEther(balance);

    console.log('💰 Balance:', balanceInBNB, 'BNB');
    console.log('💰 Balance (Wei):', balance.toString());

    if (parseFloat(balanceInBNB) < 0.001) {
        console.log('\n⚠️  WARNING: Balance is very low! Need at least 0.01 BNB for gas fees.');
    } else if (parseFloat(balanceInBNB) < 0.01) {
        console.log('\n⚠️  Balance is low. Recommended: 0.01+ BNB for multiple transactions.');
    } else {
        console.log('\n✅ Balance is sufficient for transactions.');
    }

    // Now check GAME_ADMIN_ADDRESS
    console.log('\n' + '='.repeat(60));
    console.log('\n🔍 Checking GAME_ADMIN_ADDRESS wallet:');
    const gameAdminAddress = '0x178113a73061f2049268cebadbf753e93b2aa965';
    console.log('Address:', gameAdminAddress);

    const adminBalance = await provider.getBalance(gameAdminAddress);
    const adminBalanceInBNB = ethers.formatEther(adminBalance);

    console.log('💰 Balance:', adminBalanceInBNB, 'BNB');
    console.log('💰 Balance (Wei):', adminBalance.toString());

    if (wallet.address.toLowerCase() === gameAdminAddress.toLowerCase()) {
        console.log('\n✅ PRIVATE_KEY and GAME_ADMIN_ADDRESS are the SAME wallet');
    } else {
        console.log('\n⚠️  PRIVATE_KEY and GAME_ADMIN_ADDRESS are DIFFERENT wallets!');
        console.log('   Production API uses:', wallet.address);
        console.log('   GAME_ADMIN_ADDRESS is:', gameAdminAddress);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
