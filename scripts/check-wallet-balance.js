const { ethers } = require('hardhat');

async function main() {
    // Connect to BSC Testnet
    const provider = new ethers.JsonRpcProvider(process.env.BSC_TESTNET_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/');

    // API wallet address
    const apiWalletAddress = process.env.GAME_ADMIN_ADDRESS || '0x178113a73061f2049268cebadbf753e93b2aa965';

    console.log('🔍 Checking wallet balance:');
    console.log('Address:', apiWalletAddress);
    console.log('Network: BSC Testnet\n');

    // Get balance
    const balance = await provider.getBalance(apiWalletAddress);
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

    // Check gas price
    const feeData = await provider.getFeeData();
    const gasPriceGwei = ethers.formatUnits(feeData.gasPrice, 'gwei');
    console.log('\n⛽ Current Gas Price:', gasPriceGwei, 'Gwei');

    // Estimate cost for a typical distribution
    const estimatedGas = 200000; // Typical gas for distribution
    const estimatedCost = feeData.gasPrice * BigInt(estimatedGas);
    const estimatedCostBNB = ethers.formatEther(estimatedCost);
    console.log('📊 Estimated cost per transaction:', estimatedCostBNB, 'BNB');
    console.log('📊 Number of transactions possible:', Math.floor(parseFloat(balanceInBNB) / parseFloat(estimatedCostBNB)));
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
