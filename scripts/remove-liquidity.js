/**
 * Remove Liquidity from MWT/BNB PancakeSwap Pair
 * 
 * This script removes all your liquidity from the pool so you can re-add it
 * at a different price ratio.
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../api/.env') });

const PAIR_ABI = [
    'function balanceOf(address account) external view returns (uint256)',
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
];

const ROUTER_ABI = [
    'function removeLiquidityETH(address token, uint liquidity, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external returns (uint amountToken, uint amountETH)',
];

async function removeLiquidity() {
    const provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);

    const privateKey = process.env.BOT_WALLET_PRIVATE_KEY.startsWith('0x')
        ? process.env.BOT_WALLET_PRIVATE_KEY
        : `0x${process.env.BOT_WALLET_PRIVATE_KEY}`;
    const wallet = new ethers.Wallet(privateKey, provider);

    const pairContract = new ethers.Contract(
        process.env.MWT_BNB_PAIR_ADDRESS,
        PAIR_ABI,
        wallet
    );

    const routerContract = new ethers.Contract(
        process.env.PANCAKE_ROUTER_ADDRESS,
        ROUTER_ABI,
        wallet
    );

    console.log('\n🔥 Remove Liquidity from MWT/BNB Pool');
    console.log('='.repeat(70));
    console.log(`\nWallet: ${wallet.address}`);
    console.log(`Pool: ${process.env.MWT_BNB_PAIR_ADDRESS}\n`);

    // Get LP token balance
    const lpBalance = await pairContract.balanceOf(wallet.address);
    const lpBalanceFormatted = ethers.formatEther(lpBalance);

    if (lpBalance === 0n) {
        console.log('❌ You have no LP tokens to remove');
        process.exit(1);
    }

    console.log(`Your LP Tokens: ${lpBalanceFormatted}`);
    console.log(`\nThis will remove ALL your liquidity from the pool.\n`);

    // Check approval
    const allowance = await pairContract.allowance(wallet.address, process.env.PANCAKE_ROUTER_ADDRESS);

    if (allowance < lpBalance) {
        console.log('📝 Approving LP tokens for router...');
        const approveTx = await pairContract.approve(
            process.env.PANCAKE_ROUTER_ADDRESS,
            lpBalance
        );
        console.log(`⏳ Approval TX: ${approveTx.hash}`);
        await approveTx.wait();
        console.log('✅ LP tokens approved\n');
    } else {
        console.log('✅ LP tokens already approved\n');
    }

    // Remove liquidity with 0 minimum (accept any amount due to price difference)
    const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

    console.log('🔥 Removing liquidity...');
    console.log(`   Removing: ${lpBalanceFormatted} LP tokens`);
    console.log(`   Min MWT: 0 (no minimum)`);
    console.log(`   Min BNB: 0 (no minimum)\n`);

    const tx = await routerContract.removeLiquidityETH(
        process.env.TOKEN_CONTRACT_ADDRESS,
        lpBalance,
        0, // amountTokenMin - set to 0 to avoid INSUFFICIENT errors
        0, // amountETHMin - set to 0 to avoid INSUFFICIENT errors
        wallet.address,
        deadline
    );

    console.log(`⏳ Transaction: ${tx.hash}`);
    console.log(`   View on BSCScan: https://bscscan.com/tx/${tx.hash}\n`);

    const receipt = await tx.wait();
    console.log('✅ Liquidity removed successfully!');
    console.log(`   Gas used: ${receipt.gasUsed.toString()}\n`);

    console.log('✅ Pool is now empty. You can add liquidity at your desired price.');
    console.log(`\nNext step: Run add-liquidity.js to create pool at $0.001\n`);
}

removeLiquidity().catch(error => {
    console.error('\n❌ Error:', error.message);
    if (error.reason) {
        console.error(`   Reason: ${error.reason}`);
    }
    process.exit(1);
});
