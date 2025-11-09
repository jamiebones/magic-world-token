/**
 * Test V3 swap directly to diagnose the issue
 */

require('dotenv').config();
const { ethers } = require('ethers');

const V3_ROUTER_ADDRESS = '0x13f4EA83D0bd40E75C8222255bc855a974568Dd4';
const WBNB_ADDRESS = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
const MWT_ADDRESS = '0x9c04995284e6015Ff45068DC78f6dd8263581df9';

const routerABI = [
    'function exactInputSingle((address,address,uint24,address,uint256,uint256,uint256,uint160)) external payable returns (uint256)',
    'function multicall(bytes[]) external payable returns (bytes[])',
    'function refundETH() external payable'
];

async function testV3Swap() {
    console.log('\n🧪 Testing V3 Swap Direct Call\n');
    console.log('='.repeat(70));
    
    const provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);
    const wallet = new ethers.Wallet(process.env.BOT_WALLET_PRIVATE_KEY, provider);
    
    console.log(`Wallet: ${wallet.address}`);
    
    const router = new ethers.Contract(V3_ROUTER_ADDRESS, routerABI, wallet);
    
    const bnbAmount = ethers.parseEther('0.001');
    const minMWT = ethers.parseEther('3000'); // ~3000 MWT minimum
    const deadline = Math.floor(Date.now() / 1000) + 1200;
    
    const params = {
        tokenIn: WBNB_ADDRESS,
        tokenOut: MWT_ADDRESS,
        fee: 2500,
        recipient: wallet.address,
        deadline: deadline,
        amountIn: bnbAmount,
        amountOutMinimum: minMWT,
        sqrtPriceLimitX96: 0
    };
    
    console.log('\n📊 Swap Parameters:');
    console.log(JSON.stringify(params, null, 2));
    
    try {
        console.log('\n⏳ Estimating gas...');
        const gasEstimate = await router.exactInputSingle.estimateGas(
            params,
            { value: bnbAmount }
        );
        console.log(`✅ Gas estimate: ${gasEstimate.toString()}`);
        
        console.log('\n✅ Gas estimation successful! Swap should work.');
        console.log('⚠️  NOT executing actual swap (remove this line to execute)');
        
    } catch (error) {
        console.log('\n❌ Gas estimation failed!');
        console.log('Error:', error.message);
        
        if (error.data) {
            console.log('Error data:', error.data);
        }
        
        // Try with multicall
        console.log('\n🔄 Trying with multicall pattern...');
        try {
            const swapData = router.interface.encodeFunctionData('exactInputSingle', [params]);
            const refundData = router.interface.encodeFunctionData('refundETH', []);
            
            const gasEstimate2 = await router.multicall.estimateGas(
                [swapData, refundData],
                { value: bnbAmount }
            );
            console.log(`✅ Multicall gas estimate: ${gasEstimate2.toString()}`);
            console.log('✅ Multicall pattern works!');
            
        } catch (error2) {
            console.log('❌ Multicall also failed:', error2.message);
        }
    }
}

testV3Swap().catch(console.error);
