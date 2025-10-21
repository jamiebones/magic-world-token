/**
 * Check MWT/BNB Pool Ownership
 * 
 * This script analyzes who owns the LP tokens in the MWT/BNB PancakeSwap pair
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../api/.env') });

const PAIR_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function totalSupply() external view returns (uint256)',
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)',
    'event Transfer(address indexed from, address indexed to, uint256 value)'
];

async function checkPoolOwners() {
    const provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);
    const pairAddress = process.env.MWT_BNB_PAIR_ADDRESS;

    const pairContract = new ethers.Contract(pairAddress, PAIR_ABI, provider);

    console.log('\n🔍 Analyzing MWT/BNB Pool Ownership');
    console.log('='.repeat(70));
    console.log(`\nPool Address: ${pairAddress}`);
    console.log(`View on BSCScan: https://bscscan.com/address/${pairAddress}\n`);

    // Get total supply
    const totalSupply = await pairContract.totalSupply();
    const totalSupplyFormatted = ethers.formatEther(totalSupply);
    console.log(`Total LP Tokens: ${totalSupplyFormatted}\n`);

    // Get reserves
    const [reserve0, reserve1] = await pairContract.getReserves();
    const token0 = await pairContract.token0();
    const token1 = await pairContract.token1();

    console.log(`Pool Reserves:`);
    console.log(`  Token0 (${token0}): ${ethers.formatEther(reserve0)}`);
    console.log(`  Token1 (${token1}): ${ethers.formatEther(reserve1)}\n`);

    // Identify which is MWT and which is WBNB
    const mwtAddress = process.env.TOKEN_CONTRACT_ADDRESS.toLowerCase();
    const isMWTToken0 = token0.toLowerCase() === mwtAddress;

    console.log(`Token Identification:`);
    console.log(`  MWT: ${isMWTToken0 ? 'Token0' : 'Token1'}`);
    console.log(`  WBNB: ${isMWTToken0 ? 'Token1' : 'Token0'}\n`);

    const mwtReserve = isMWTToken0 ? reserve0 : reserve1;
    const bnbReserve = isMWTToken0 ? reserve1 : reserve0;

    console.log(`Formatted Reserves:`);
    console.log(`  MWT Reserve: ${ethers.formatEther(mwtReserve)} MWT`);
    console.log(`  BNB Reserve: ${ethers.formatEther(bnbReserve)} BNB\n`);

    // Check specific addresses
    const addressesToCheck = [
        { name: 'Your Bot Wallet', address: process.env.BOT_WALLET_ADDRESS },
        { name: 'Dead Address (Burned)', address: '0x000000000000000000000000000000000000dEaD' },
        { name: 'Zero Address', address: '0x0000000000000000000000000000000000000000' },
        { name: 'PancakeSwap Router', address: process.env.PANCAKE_ROUTER_ADDRESS },
        { name: 'Game Contract', address: process.env.GAME_CONTRACT_ADDRESS },
    ];

    console.log('Known Address LP Holdings:');
    console.log('='.repeat(70) + '\n');

    let foundHolders = 0;
    for (const addr of addressesToCheck) {
        const balance = await pairContract.balanceOf(addr.address);
        const balanceFormatted = ethers.formatEther(balance);
        const percentage = totalSupply > 0n ? (Number(balance) / Number(totalSupply) * 100).toFixed(4) : '0';

        if (balance > 0n) {
            foundHolders++;
            console.log(`✅ ${addr.name}:`);
            console.log(`   Address: ${addr.address}`);
            console.log(`   LP Tokens: ${balanceFormatted}`);
            console.log(`   Ownership: ${percentage}%\n`);
        }
    }

    if (foundHolders === 0) {
        console.log('❌ None of the known addresses hold LP tokens\n');
    }

    // Try to get recent Transfer events to find actual holders
    console.log('Fetching Recent LP Token Transfers...');
    console.log('='.repeat(70) + '\n');

    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 5000); // Last ~5k blocks

        console.log(`Scanning blocks ${fromBlock} to ${currentBlock}...`);

        const filter = pairContract.filters.Transfer();
        const events = await pairContract.queryFilter(filter, fromBlock, currentBlock);

        console.log(`Found ${events.length} Transfer events\n`);

        // Collect unique recipient addresses
        const holders = new Set();
        for (const event of events) {
            // Exclude zero address and include any recipient
            if (event.args.to && event.args.to !== '0x0000000000000000000000000000000000000000') {
                holders.add(event.args.to);
            }
        }

        console.log(`Found ${holders.size} unique addresses in recent transfers\n`);

        // Check current balance for each holder
        const holderBalances = [];
        for (const holder of holders) {
            const balance = await pairContract.balanceOf(holder);
            if (balance > 0n) {
                holderBalances.push({
                    address: holder,
                    balance: balance,
                    balanceFormatted: ethers.formatEther(balance),
                    percentage: (Number(balance) / Number(totalSupply) * 100).toFixed(4)
                });
            }
        }

        // Sort by balance descending
        holderBalances.sort((a, b) => Number(b.balance - a.balance));

        if (holderBalances.length > 0) {
            console.log('Current LP Token Holders (Sorted by Balance):');
            console.log('='.repeat(70) + '\n');

            holderBalances.forEach((holder, index) => {
                console.log(`${index + 1}. Address: ${holder.address}`);
                console.log(`   LP Tokens: ${holder.balanceFormatted}`);
                console.log(`   Ownership: ${holder.percentage}%`);
                console.log(`   View on BSCScan: https://bscscan.com/address/${holder.address}\n`);
            });
        } else {
            console.log('❌ No active LP token holders found in recent transfers\n');
        }

    } catch (error) {
        console.log('⚠️  Note: Could not fetch all Transfer events');
        console.log(`   Error: ${error.message}\n`);
    }

    // Summary
    console.log('='.repeat(70));
    console.log('SUMMARY');
    console.log('='.repeat(70) + '\n');
    console.log(`Total LP Tokens in Circulation: ${totalSupplyFormatted}`);
    console.log(`\nTo view complete holder list, visit:`);
    console.log(`https://bscscan.com/token/${pairAddress}#balances`);
    console.log('\n');
}

checkPoolOwners().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});
