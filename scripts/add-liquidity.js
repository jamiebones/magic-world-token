/**
 * Add Liquidity to MWG/BNB PancakeSwap Pair
 * 
 * This script adds liquidity to the MWG/BNB pair on PancakeSwap to achieve
 * the target peg price of $0.01 per MWG token.
 * 
 * Usage:
 *   node scripts/add-liquidity.js --bnb <amount> --dry-run
 *   node scripts/add-liquidity.js --bnb 1.0 --execute
 */

const { ethers } = require('ethers');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../api/.env') });

// Contract ABIs
const ERC20_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)',
    'function balanceOf(address account) external view returns (uint256)',
    'function decimals() external view returns (uint8)'
];

const PANCAKE_ROUTER_ABI = [
    'function addLiquidityETH(address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline) external payable returns (uint amountToken, uint amountETH, uint liquidity)',
    'function getAmountsOut(uint amountIn, address[] memory path) external view returns (uint[] memory amounts)'
];

const PANCAKE_PAIR_ABI = [
    'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',
    'function token0() external view returns (address)',
    'function token1() external view returns (address)'
];

const CHAINLINK_ABI = [
    'function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)',
    'function decimals() external view returns (uint8)'
];

class LiquidityManager {
    constructor() {
        // Connect to BSC Mainnet
        this.provider = new ethers.JsonRpcProvider(process.env.BSC_MAINNET_RPC_URL);

        // Setup wallet - ensure private key has 0x prefix
        const privateKey = process.env.BOT_WALLET_PRIVATE_KEY.startsWith('0x')
            ? process.env.BOT_WALLET_PRIVATE_KEY
            : `0x${process.env.BOT_WALLET_PRIVATE_KEY}`;
        this.wallet = new ethers.Wallet(privateKey, this.provider);        // Initialize contracts
        this.tokenContract = new ethers.Contract(
            process.env.TOKEN_CONTRACT_ADDRESS,
            ERC20_ABI,
            this.wallet
        );

        this.routerContract = new ethers.Contract(
            process.env.PANCAKE_ROUTER_ADDRESS,
            PANCAKE_ROUTER_ABI,
            this.wallet
        );

        this.pairContract = new ethers.Contract(
            process.env.MWT_BNB_PAIR_ADDRESS,
            PANCAKE_PAIR_ABI,
            this.provider
        );

        this.chainlinkBNBUSD = new ethers.Contract(
            process.env.CHAINLINK_BNB_USD_FEED,
            CHAINLINK_ABI,
            this.provider
        );

        this.targetPegUSD = parseFloat(process.env.TARGET_PEG_USD || '0.01');
    }

    /**
     * Get current BNB/USD price from Chainlink
     */
    async getBNBUSDPrice() {
        const [, answer, , ,] = await this.chainlinkBNBUSD.latestRoundData();
        const decimals = await this.chainlinkBNBUSD.decimals();
        return Number(answer) / Math.pow(10, Number(decimals));
    }

    /**
     * Get current pool reserves
     */
    async getCurrentReserves() {
        const [reserve0, reserve1] = await this.pairContract.getReserves();
        const token0 = await this.pairContract.token0();

        let mwtReserve, bnbReserve;
        if (token0.toLowerCase() === process.env.TOKEN_CONTRACT_ADDRESS.toLowerCase()) {
            mwtReserve = reserve0;
            bnbReserve = reserve1;
        } else {
            mwtReserve = reserve1;
            bnbReserve = reserve0;
        }

        return {
            mwtReserve: ethers.formatEther(mwtReserve),
            bnbReserve: ethers.formatEther(bnbReserve),
            mwtReserveRaw: mwtReserve,
            bnbReserveRaw: bnbReserve
        };
    }

    /**
     * Calculate required MWG tokens for target price
     * Formula: MWG/BNB = BNB_reserve / MWG_reserve
     * Therefore: MWG_reserve = BNB_reserve / (MWT/BNB)
     * 
     * Where MWG/BNB = Target_USD / BNB_USD
     */
    async calculateRequiredTokens(bnbAmount) {
        const bnbUsdPrice = await this.getBNBUSDPrice();
        const reserves = await this.getCurrentReserves();

        // Calculate what the total BNB reserve will be after adding liquidity
        const currentBNB = parseFloat(reserves.bnbReserve);
        const totalBNB = currentBNB + bnbAmount;

        // Calculate target MWG/BNB price
        const targetMWTBNBPrice = this.targetPegUSD / bnbUsdPrice;

        // Calculate total MWG needed to achieve target price
        const totalMWTNeeded = totalBNB / targetMWTBNBPrice;

        // Calculate how much MWG to add (subtract current reserve)
        const currentMWT = parseFloat(reserves.mwtReserve);
        const mwtToAdd = totalMWTNeeded - currentMWT;

        return {
            bnbUsdPrice,
            currentBNB,
            currentMWT,
            bnbToAdd: bnbAmount,
            mwtToAdd,
            totalBNB,
            totalMWT: totalMWTNeeded,
            targetMWTBNBPrice,
            expectedMWTUSDPrice: targetMWTBNBPrice * bnbUsdPrice,
            liquidityValueUSD: totalBNB * bnbUsdPrice * 2
        };
    }

    /**
     * Calculate required BNB for target price based on MWG amount
     * Formula: For target price, BNB_reserve = MWG_reserve × (Target_USD / BNB_USD)
     */
    async calculateRequiredBNB(mwtAmount) {
        const bnbUsdPrice = await this.getBNBUSDPrice();
        const reserves = await this.getCurrentReserves();

        // Calculate what the total MWG reserve will be after adding liquidity
        const currentMWT = parseFloat(reserves.mwtReserve);
        const totalMWT = currentMWT + mwtAmount;

        // Calculate target MWG/BNB price
        const targetMWTBNBPrice = this.targetPegUSD / bnbUsdPrice;

        // Calculate total BNB needed to achieve target price
        // MWG/BNB = BNB / MWG, so BNB = MWG × (MWT/BNB)
        const totalBNBNeeded = totalMWT * targetMWTBNBPrice;

        // Calculate how much BNB to add (subtract current reserve)
        const currentBNB = parseFloat(reserves.bnbReserve);
        const bnbToAdd = totalBNBNeeded - currentBNB;

        return {
            bnbUsdPrice,
            currentBNB,
            currentMWT,
            bnbToAdd,
            mwtToAdd: mwtAmount,
            totalBNB: totalBNBNeeded,
            totalMWT,
            targetMWTBNBPrice,
            expectedMWTUSDPrice: targetMWTBNBPrice * bnbUsdPrice,
            liquidityValueUSD: totalBNBNeeded * bnbUsdPrice * 2
        };
    }    /**
     * Check wallet balances
     */
    async checkBalances(mwtNeeded, bnbNeeded) {
        const bnbBalance = await this.provider.getBalance(this.wallet.address);
        const mwtBalance = await this.tokenContract.balanceOf(this.wallet.address);

        const bnbBalanceFormatted = parseFloat(ethers.formatEther(bnbBalance));
        const mwtBalanceFormatted = parseFloat(ethers.formatEther(mwtBalance));

        const hasSufficientBNB = bnbBalanceFormatted >= (bnbNeeded + 0.01); // +0.01 for gas
        const hasSufficientMWT = mwtBalanceFormatted >= mwtNeeded;

        return {
            bnb: {
                balance: bnbBalanceFormatted,
                needed: bnbNeeded,
                sufficient: hasSufficientBNB,
                remaining: bnbBalanceFormatted - bnbNeeded
            },
            mwt: {
                balance: mwtBalanceFormatted,
                needed: mwtNeeded,
                sufficient: hasSufficientMWT,
                remaining: mwtBalanceFormatted - mwtNeeded
            }
        };
    }

    /**
     * Approve MWG tokens for PancakeSwap Router
     */
    async approveTokens(amount) {
        const amountWei = ethers.parseEther(amount.toString());
        const currentAllowance = await this.tokenContract.allowance(
            this.wallet.address,
            process.env.PANCAKE_ROUTER_ADDRESS
        );

        if (currentAllowance >= amountWei) {
            console.log('✅ Tokens already approved');
            return true;
        }

        console.log(`\n📝 Approving ${amount.toLocaleString()} MWG tokens...`);
        const tx = await this.tokenContract.approve(
            process.env.PANCAKE_ROUTER_ADDRESS,
            amountWei
        );

        console.log(`⏳ Approval transaction: ${tx.hash}`);
        await tx.wait();
        console.log('✅ Tokens approved');
        return true;
    }

    /**
     * Add liquidity to PancakeSwap
     */
    async addLiquidity(mwtAmount, bnbAmount, slippageTolerance = 0.02) {
        // Use parseUnits with fixed precision to handle very small amounts
        const mwtAmountWei = ethers.parseUnits(mwtAmount.toFixed(18), 18);
        const bnbAmountWei = ethers.parseUnits(bnbAmount.toFixed(18), 18);

        // Calculate minimum amounts (with slippage tolerance)
        const mwtMin = mwtAmount * (1 - slippageTolerance);
        const bnbMin = bnbAmount * (1 - slippageTolerance);
        const mwtMinWei = ethers.parseUnits(mwtMin.toFixed(18), 18);
        const bnbMinWei = ethers.parseUnits(bnbMin.toFixed(18), 18);

        // Deadline: 20 minutes from now
        const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

        console.log(`\n💧 Adding liquidity to PancakeSwap...`);
        console.log(`   MWG: ${mwtAmount.toLocaleString()}`);
        console.log(`   BNB: ${bnbAmount}`);
        console.log(`   Slippage: ${(slippageTolerance * 100).toFixed(1)}%`);

        const tx = await this.routerContract.addLiquidityETH(
            process.env.TOKEN_CONTRACT_ADDRESS,
            mwtAmountWei,
            mwtMinWei,
            bnbMinWei,
            this.wallet.address,
            deadline,
            { value: bnbAmountWei }
        );

        console.log(`⏳ Transaction: ${tx.hash}`);
        console.log(`   View on BSCScan: https://bscscan.com/tx/${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`✅ Liquidity added successfully!`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);

        return receipt;
    }

    /**
     * Display liquidity plan
     */
    displayPlan(calculations, balances) {
        console.log('\n' + '='.repeat(70));
        console.log('LIQUIDITY ADDITION PLAN');
        console.log('='.repeat(70));

        console.log('\n📊 CURRENT STATE:');
        console.log(`   BNB/USD Price: $${calculations.bnbUsdPrice.toFixed(2)}`);
        console.log(`   Current BNB Reserve: ${calculations.currentBNB.toFixed(6)} BNB`);
        console.log(`   Current MWG Reserve: ${calculations.currentMWT.toLocaleString()} MWG`);
        console.log(`   Current MWG/BNB: ${(calculations.currentBNB / calculations.currentMWT).toFixed(10)}`);
        console.log(`   Current MWG/USD: $${((calculations.currentBNB / calculations.currentMWT) * calculations.bnbUsdPrice).toFixed(2)}`);

        console.log('\n🎯 TARGET STATE:');
        console.log(`   Target Peg: $${this.targetPegUSD}`);
        console.log(`   Target MWG/BNB: ${calculations.targetMWTBNBPrice.toFixed(10)}`);

        console.log('\n➕ LIQUIDITY TO ADD:');
        console.log(`   BNB: ${calculations.bnbToAdd.toFixed(6)} BNB (~$${(calculations.bnbToAdd * calculations.bnbUsdPrice).toFixed(2)})`);
        console.log(`   MWG: ${calculations.mwtToAdd.toLocaleString()} MWG`);

        console.log('\n📈 AFTER LIQUIDITY ADDITION:');
        console.log(`   Total BNB Reserve: ${calculations.totalBNB.toFixed(6)} BNB`);
        console.log(`   Total MWG Reserve: ${calculations.totalMWT.toLocaleString()} MWG`);
        console.log(`   Expected MWG/USD: $${calculations.expectedMWTUSDPrice.toFixed(4)}`);
        console.log(`   Total Liquidity: ~$${calculations.liquidityValueUSD.toFixed(2)}`);

        console.log('\n💰 WALLET BALANCES:');
        console.log(`   BNB: ${balances.bnb.balance.toFixed(6)} (need ${balances.bnb.needed.toFixed(6)}) ${balances.bnb.sufficient ? '✅' : '❌'}`);
        console.log(`   MWG: ${balances.mwt.balance.toLocaleString()} (need ${balances.mwt.needed.toLocaleString()}) ${balances.mwt.sufficient ? '✅' : '❌'}`);

        if (balances.bnb.sufficient && balances.mwt.sufficient) {
            console.log('\n✅ Sufficient balances available');
        } else {
            console.log('\n❌ INSUFFICIENT BALANCES!');
            if (!balances.bnb.sufficient) {
                console.log(`   Need ${(balances.bnb.needed - balances.bnb.balance).toFixed(6)} more BNB`);
            }
            if (!balances.mwt.sufficient) {
                console.log(`   Need ${(balances.mwt.needed - balances.mwt.balance).toLocaleString()} more MWG`);
            }
        }

        console.log('\n' + '='.repeat(70));
    }
}

// Main execution
async function main() {
    const args = process.argv.slice(2);

    // Parse command line arguments
    let bnbAmount = null;
    let mwtAmount = null;
    let execute = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--bnb' && args[i + 1]) {
            bnbAmount = parseFloat(args[i + 1]);
        }
        if (args[i] === '--mwt' && args[i + 1]) {
            mwtAmount = parseFloat(args[i + 1]);
        }
        if (args[i] === '--execute') {
            execute = true;
        }
    }

    // Default to 1 BNB if neither specified
    if (!bnbAmount && !mwtAmount) {
        bnbAmount = 1.0;
    }

    // Check that only one mode is specified
    if (bnbAmount && mwtAmount) {
        console.log('\n❌ Error: Cannot specify both --bnb and --mwt. Choose one mode.');
        console.log('   Examples:');
        console.log('   node scripts/add-liquidity.js --bnb 1.0');
        console.log('   node scripts/add-liquidity.js --mwt 100000');
        process.exit(1);
    }

    const mode = bnbAmount ? 'BNB' : 'MWT';
    const amount = bnbAmount || mwtAmount;

    console.log('\n🚀 MWG Liquidity Manager');
    console.log(`   Network: BSC Mainnet`);
    console.log(`   Wallet: ${process.env.BOT_WALLET_ADDRESS}`);
    console.log(`   Mode: ${execute ? 'EXECUTE' : 'DRY RUN'}`);
    console.log(`   Input: ${amount.toLocaleString()} ${mode}`);

    const manager = new LiquidityManager();

    try {
        // Calculate required tokens based on mode
        console.log('\n⚙️  Calculating liquidity requirements...');
        let calculations;

        if (bnbAmount) {
            calculations = await manager.calculateRequiredTokens(bnbAmount);
        } else {
            calculations = await manager.calculateRequiredBNB(mwtAmount);
        }

        // Check balances
        const balances = await manager.checkBalances(
            calculations.mwtToAdd,
            calculations.bnbToAdd
        );

        // Display plan
        manager.displayPlan(calculations, balances);

        // Check if we can proceed
        if (!balances.bnb.sufficient || !balances.mwt.sufficient) {
            console.log('\n❌ Cannot proceed - insufficient balances');
            process.exit(1);
        }

        if (!execute) {
            console.log('\n💡 This was a dry run. Add --execute flag to actually add liquidity.');
            const exampleFlag = bnbAmount ? `--bnb ${bnbAmount}` : `--mwt ${mwtAmount}`;
            console.log(`   Example: node scripts/add-liquidity.js ${exampleFlag} --execute`);
            process.exit(0);
        }

        // Execute liquidity addition
        console.log('\n🚀 Proceeding with liquidity addition...');

        // Step 1: Approve tokens
        await manager.approveTokens(calculations.mwtToAdd);

        // Step 2: Add liquidity
        await manager.addLiquidity(calculations.mwtToAdd, calculations.bnbToAdd);

        // Step 3: Verify new price
        console.log('\n🔍 Verifying new price...');
        const newReserves = await manager.getCurrentReserves();
        const newMWTBNBPrice = parseFloat(newReserves.bnbReserve) / parseFloat(newReserves.mwtReserve);
        const bnbUsdPrice = await manager.getBNBUSDPrice();
        const newMWTUSDPrice = newMWTBNBPrice * bnbUsdPrice;

        console.log(`\n📊 NEW POOL STATE:`);
        console.log(`   MWG Reserve: ${parseFloat(newReserves.mwtReserve).toLocaleString()} MWG`);
        console.log(`   BNB Reserve: ${parseFloat(newReserves.bnbReserve).toFixed(6)} BNB`);
        console.log(`   MWG/USD Price: $${newMWTUSDPrice.toFixed(6)}`);
        console.log(`   Deviation from $${manager.targetPegUSD}: ${(((newMWTUSDPrice - manager.targetPegUSD) / manager.targetPegUSD) * 100).toFixed(2)}%`);

        console.log('\n✅ Liquidity addition complete!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.reason) {
            console.error(`   Reason: ${error.reason}`);
        }
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}

module.exports = LiquidityManager;
