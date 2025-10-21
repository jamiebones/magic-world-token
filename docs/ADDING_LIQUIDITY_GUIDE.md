# Adding Liquidity to MWT/BNB PancakeSwap Pair

## Overview

This guide explains how to add liquidity to your MWT/BNB PancakeSwap pair to achieve the target peg price of $0.01 per MWT token.

## Current Situation

Based on the API analysis, your pool has:
- **MWT Reserve**: 0.000277 MWT (almost zero!)
- **BNB Reserve**: 0.2776 BNB (~$298 USD)
- **Current Price**: $1,075,725 per MWT (extremely high due to low MWT liquidity)
- **Target Price**: $0.01 per MWT
- **Deviation**: +10,757,258,371% (over 10 billion percent!)

## Why This Happened

The pool has virtually no MWT tokens, causing an extreme price imbalance. Possible causes:
1. Someone removed liquidity
2. Pool was created with wrong initial ratios
3. Someone bought all the MWT from the pool

## Solution: Add Proper Liquidity

### Prerequisites

Before adding liquidity, ensure you have:

1. **MWT Tokens**: You'll need ~30 million MWT tokens (for 1 BNB liquidity)
2. **BNB**: Amount you want to add as liquidity
3. **Gas Fees**: ~0.01 BNB for transaction fees

### Step 1: Check Your Wallet Balances

First, let's see what you have:

```bash
cd /home/jamiebones/Coding_Directory/Tutorials/Magic_World_Token

# Check wallet balances
node scripts/check-wallet-balance.js
```

You need to check:
- **BOT_WALLET_ADDRESS** (`0x178113a73061f2049268cebadbf753e93b2aa965`) - has MWT tokens?
- Do you have sufficient BNB?

### Step 2: Run a Dry Run Simulation

Before executing, always run a dry run to see the calculations:

```bash
# Simulate adding 1 BNB of liquidity (default)
node scripts/add-liquidity.js --bnb 1.0 --dry-run

# Simulate adding 5 BNB of liquidity
node scripts/add-liquidity.js --bnb 5.0 --dry-run

# Simulate adding 10 BNB of liquidity  
node scripts/add-liquidity.js --bnb 10.0 --dry-run
```

This will show you:
- Current pool state
- How much MWT you need
- Expected final price
- Whether you have sufficient balances

### Step 3: Execute Liquidity Addition

Once you're satisfied with the dry run, execute:

```bash
# Add 1 BNB worth of liquidity
node scripts/add-liquidity.js --bnb 1.0 --execute

# Add 5 BNB worth of liquidity
node scripts/add-liquidity.js --bnb 5.0 --execute
```

The script will:
1. Calculate exact MWT amount needed for $0.01 peg
2. Approve MWT tokens for PancakeSwap Router
3. Add liquidity to the pool
4. Verify the new price

### Step 4: Verify the New Price

After adding liquidity, check the deviation:

```bash
curl -X GET "https://magic-world-token-production.up.railway.app/api/bot/prices/deviation" \
  -H "X-API-Key: mwt_7bd2673fdb6f63cafe059d9052dd00c00e6b113b5a20c2a00875a46cb6c4aec7"
```

You should see the deviation drop significantly closer to 0%.

## Calculation Explanation

### How Much MWT Do You Need?

For a target price of $0.01 USD:

```
1. Get BNB/USD price (e.g., $1,074 from Chainlink)

2. Calculate target MWT/BNB price:
   MWT/BNB = Target_USD ÷ BNB_USD
   MWT/BNB = $0.01 ÷ $1,074 = 0.0000093109 BNB per MWT

3. Current BNB in pool: 0.2776 BNB
   Adding: 1.0 BNB
   Total BNB: 1.2776 BNB

4. Calculate required MWT:
   MWT_needed = Total_BNB ÷ MWT/BNB_price
   MWT_needed = 1.2776 ÷ 0.0000093109 = 137,193 MWT

5. MWT to add:
   Current MWT: 0.000277
   Need to add: 137,193 - 0.000277 ≈ 137,193 MWT
```

### Example Scenarios

| BNB to Add | Total Liquidity | MWT Needed | Final Price | 
|------------|----------------|------------|-------------|
| 1 BNB | ~$2,148 | ~137,193 MWT | $0.01 |
| 5 BNB | ~$10,740 | ~656,193 MWT | $0.01 |
| 10 BNB | ~$21,480 | ~1,309,193 MWT | $0.01 |

## Important Notes

### Slippage Protection

The script uses 2% slippage tolerance by default. This means:
- If market moves during transaction, you're protected
- Minimum amounts will be (amount × 0.98)

### Transaction Deadlines

Transactions have a 20-minute deadline. If the blockchain is congested and your transaction doesn't execute within 20 minutes, it will fail and revert.

### Gas Optimization

The script will:
- Check current gas prices
- Estimate gas requirements
- Use appropriate gas limits

### Liquidity Pool Tokens (LP Tokens)

After adding liquidity, you'll receive LP tokens representing your share of the pool. These are sent to your wallet automatically.

## Troubleshooting

### Error: "Insufficient MWT Balance"

You need more MWT tokens in your wallet.

**Solution**: Transfer MWT from Game Contract or another wallet:

```bash
# Check how much MWT the Game Contract has
node scripts/check-roles.js

# Transfer from Game Contract (if you have DISTRIBUTOR_ROLE)
# You'll need to create a transfer script or use the admin panel
```

### Error: "Insufficient BNB Balance"

You need more BNB for the liquidity and gas fees.

**Solution**: Send BNB to your bot wallet (`0x178113a73061f2049268cebadbf753e93b2aa965`)

### Error: "Transaction Failed - Price Impact Too High"

The pool is in an unstable state.

**Solution**: 
1. Try adding smaller amounts first (0.1 BNB)
2. Gradually increase liquidity
3. Or consider removing all liquidity and re-creating the pool

### Price Still Deviates After Adding Liquidity

Small deviations are normal due to:
- BNB price fluctuations
- Trading activity
- Blockchain price updates

**Acceptable Range**: ±5% deviation is normal for low liquidity pools

## Alternative: Remove and Re-create Pool

If the pool is too imbalanced, you might want to:

1. **Remove all existing liquidity** (if you own it)
2. **Create a fresh pool** with correct ratios

To calculate initial liquidity for a new pool:

```
For $10,000 total liquidity at $0.01 per MWT:

BNB Amount: $10,000 ÷ 2 ÷ $1,074 = 4.656 BNB
MWT Amount: ($10,000 ÷ 2) ÷ $0.01 = 500,000 MWT

Initial Ratio: 500,000 MWT : 4.656 BNB
```

## Monitoring After Adding Liquidity

After successfully adding liquidity, monitor:

1. **Price Stability**:
```bash
# Check every few minutes
curl "https://magic-world-token-production.up.railway.app/api/bot/prices/current" \
  -H "X-API-Key: mwt_7bd2673fdb6f63cafe059d9052dd00c00e6b113b5a20c2a00875a46cb6c4aec7"
```

2. **Deviation**:
```bash
curl "https://magic-world-token-production.up.railway.app/api/bot/prices/deviation" \
  -H "X-API-Key: mwt_7bd2673fdb6f63cafe059d9052dd00c00e6b113b5a20c2a00875a46cb6c4aec7"
```

3. **Trading Activity**:
Check on BSCScan: https://bscscan.com/address/0x9f55c42d54e07daa717f6458c8c5ed480b7592f0

## Next Steps: Enable Trading Bot

Once liquidity is stable:

1. Update `.env`:
```bash
BOT_ENABLED=true
```

2. The trading bot will automatically:
   - Monitor price deviations
   - Execute BUY orders when price < $0.01
   - Execute SELL orders when price > $0.01
   - Maintain the peg within configured thresholds

## Support

If you encounter issues:

1. Check the transaction on BSCScan
2. Review the error message
3. Ensure wallet has sufficient balances
4. Verify contract addresses in `.env`

## Security Reminders

⚠️ **IMPORTANT**:
- Always run dry runs first (`--dry-run`)
- Double-check amounts before executing
- Keep your private keys secure
- Monitor transactions on BSCScan
- Start with small amounts to test

---

**Last Updated**: October 21, 2025
**Script**: `/scripts/add-liquidity.js`
