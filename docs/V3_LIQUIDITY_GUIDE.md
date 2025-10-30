# PancakeSwap V3 Liquidity Calculator & Addition Guide

## Quick Start

### Part 1: Calculate Required Amounts for Target Price

Calculate how much MWG and BNB you need to achieve a specific price:

```bash
# Calculate for default price (0.0003 BNB per MWG)
npm run liquidity-v3:calc

# Calculate for custom price in USD (e.g., $0.0005 per MWG)
node scripts/add-liquidity-v3.js --calculate --price=0.0005
```

**Example Output:**
```
💵 Price Conversion:
  Input: 1 MWG = $0.0005 USD
  BNB Price: $600 USD
  Converted: 1 MWG = 0.00000083 BNB

Target Price: 1 MWG = 0.00000083 BNB
You need: 0.833333 BNB
You need: 2,777,777 MWG
This will set price: 1 MWG = $0.0005 USD
```

### Part 2: Add Liquidity with Calculated Amounts

```bash
# Add liquidity on BSC Mainnet
npm run liquidity-v3:bsc

# Add liquidity on BSC Testnet (test first!)
npm run liquidity-v3:bsc-testnet
```

---

## Understanding the Configuration

Open `scripts/add-liquidity-v3.js` and modify the `CONFIG` section:

```javascript
const CONFIG = {
    // Target price: 1 MWG = X BNB
    TARGET_PRICE_IN_BNB: 0.0003,
    
    // Total liquidity budget in USD
    TOTAL_LIQUIDITY_USD: 1000,
    
    // Current BNB price (update this!)
    BNB_PRICE_USD: 600,
    
    // Fee tier (LOWEST=0.01%, LOW=0.05%, MEDIUM=0.25%, HIGH=1%)
    FEE_TIER: FEE_TIERS.MEDIUM, // 0.25%
    
    // Price range for concentrated liquidity
    PRICE_RANGE_PERCENT: 50, // ±50% range
    
    // Slippage tolerance
    SLIPPAGE_TOLERANCE: 0.01, // 1%
};
```

---

## Step-by-Step Example

### Scenario: Set MWG price to $0.0003

**Step 1: Update BNB price**

Check current BNB price on CoinMarketCap or similar. Let's say BNB = $600.

Update in config:
```javascript
BNB_PRICE_USD: 600,
```

**Step 2: Set your target price**

You want: 1 MWG = $0.0003

Calculate: $0.0003 / $600 = 0.0000005 BNB

Update in config:
```javascript
TARGET_PRICE_IN_BNB: 0.0000005,
```

**Step 3: Set your liquidity budget**

You have $1000 to add as liquidity:
```javascript
TOTAL_LIQUIDITY_USD: 1000,
```

**Step 4: Calculate required amounts**

```bash
npm run liquidity-v3:calc
```

Output will show:
```
You need: 0.833333 BNB ($500)
You need: 1,666,666 MWG ($500)
```

**Step 5: Verify you have enough tokens**

Check your wallet:
- BNB: Need 0.833333 + 0.05 (gas) = ~0.88 BNB
- MWG: Need 1,666,666 MWG

**Step 6: Add liquidity**

```bash
npm run liquidity-v3:bsc
```

---

## Price Calculation Examples

### Example 1: High-Value Token

**Want:** 1 MWG = $0.01 USD

**Calculation:**
- BNB price = $600
- Target = $0.01 / $600 = 0.0000167 BNB
- For $1000 liquidity:
  - BNB needed: $500 / $600 = 0.833 BNB
  - MWG needed: 0.833 / 0.0000167 = 50,000 MWG

**Config:**
```javascript
TARGET_PRICE_IN_BNB: 0.0000167,
TOTAL_LIQUIDITY_USD: 1000,
```

### Example 2: Low-Value Token

**Want:** 1 MWG = $0.00001 USD

**Calculation:**
- BNB price = $600
- Target = $0.00001 / $600 = 0.0000000167 BNB
- For $1000 liquidity:
  - BNB needed: 0.833 BNB
  - MWG needed: 0.833 / 0.0000000167 = 50,000,000 MWG

**Config:**
```javascript
TARGET_PRICE_IN_BNB: 0.0000000167,
TOTAL_LIQUIDITY_USD: 1000,
```

### Example 3: Match Existing Price

You already have a V2 pool at 1 MWG = 0.0003 BNB, want to create V3:

**Config:**
```javascript
TARGET_PRICE_IN_BNB: 0.0003,
TOTAL_LIQUIDITY_USD: 1000, // Your budget
```

---

## Understanding V3 Concentrated Liquidity

### What is Concentrated Liquidity?

In V3, you provide liquidity within a specific **price range** instead of across all prices (0 to ∞).

**Benefits:**
- More capital efficient (less tokens needed for same liquidity depth)
- Earn more fees if price stays in your range
- Can set a specific starting price

**Trade-offs:**
- If price moves outside your range, no fees earned
- Need to rebalance if price moves too far

### Price Range Configuration

```javascript
PRICE_RANGE_PERCENT: 50, // ±50% range
```

This means:
- **Lower bound:** Target price × (1 - 0.50) = Target × 0.5
- **Upper bound:** Target price × (1 + 0.50) = Target × 1.5

**Example:**
- Target: 1 MWG = 0.0003 BNB
- Lower: 0.00015 BNB (-50%)
- Upper: 0.00045 BNB (+50%)

Your liquidity is active between these prices.

**Recommendations:**
- **Tight range (±20%)**: Maximum capital efficiency, but risky if volatile
- **Medium range (±50%)**: Balanced approach (default)
- **Wide range (±100%)**: Safer but less efficient

---

## Fee Tiers

PancakeSwap V3 has 4 fee tiers:

| Tier | Fee | Best For | Tick Spacing |
|------|-----|----------|--------------|
| LOWEST | 0.01% | Stablecoins (USDT/USDC) | 1 |
| LOW | 0.05% | Major pairs (BTC/ETH) | 10 |
| MEDIUM | 0.25% | Most tokens (MWG/BNB) | 50 |
| HIGH | 1% | Exotic/volatile pairs | 200 |

**Recommendation for MWG:**
```javascript
FEE_TIER: FEE_TIERS.MEDIUM, // 0.25%
```

---

## Common Scenarios

### Scenario 1: Initial Launch (No Existing Pool)

**Goal:** Set starting price for new token

**Steps:**
1. Calculate amounts for target price
2. Script will create pool automatically
3. Add liquidity with calculated amounts

**Config:**
```javascript
TARGET_PRICE_IN_BNB: 0.0001, // Your desired starting price
TOTAL_LIQUIDITY_USD: 500,    // Your budget
PRICE_RANGE_PERCENT: 50,     // ±50% range
```

### Scenario 2: Adding More Liquidity (Existing Pool)

**Goal:** Add liquidity to existing V3 pool

**Steps:**
1. Check current price on PancakeSwap
2. Use current price as target
3. Add liquidity around current price

**Config:**
```javascript
TARGET_PRICE_IN_BNB: 0.00032, // Current pool price
TOTAL_LIQUIDITY_USD: 1000,
PRICE_RANGE_PERCENT: 30,      // Tighter range around current price
```

### Scenario 3: Price Discovery

**Goal:** Let market find the right price

**Steps:**
1. Start with conservative price
2. Use wide range (±100%)
3. Monitor and adjust

**Config:**
```javascript
TARGET_PRICE_IN_BNB: 0.0003,
TOTAL_LIQUIDITY_USD: 500,
PRICE_RANGE_PERCENT: 100,     // Wide range for price discovery
```

---

## Technical Details

### How Price is Set

Price in V3 is determined by the ratio of tokens:

```
Price (MWG/BNB) = Amount of BNB / Amount of MWG
```

For 50/50 split by value:
- $500 in BNB = 0.833 BNB (at $600/BNB)
- $500 in MWG = Amount of MWG needed

To find MWG amount:
```
MWG Amount = BNB Amount / Target Price
MWG Amount = 0.833 / 0.0003 = 2,777 MWG
```

### sqrtPriceX96 Calculation

V3 uses a special price format called `sqrtPriceX96`:

```
sqrtPriceX96 = sqrt(price) × 2^96
```

The script calculates this automatically for you.

### Tick Calculation

Ticks are logarithmic price points:

```
tick = floor(log₁.₀₀₀₁(price))
```

Each tick represents a 0.01% price change.

Different fee tiers have different tick spacings:
- 0.01% fee: 1 tick spacing
- 0.05% fee: 10 tick spacing
- 0.25% fee: 50 tick spacing
- 1% fee: 200 tick spacing

---

## Troubleshooting

### Issue: "Calculated price doesn't match expected"

**Cause:** Rounding or token order

**Solution:**
- V3 always orders tokens: token0 < token1 (by address)
- Price is always token1/token0
- Script handles this automatically

### Issue: "Insufficient MWG balance"

**Solution:**
- Reduce `TOTAL_LIQUIDITY_USD`
- Or obtain more MWG tokens
- Check you're using the right wallet

### Issue: "Transaction fails with 'Price out of range'"

**Cause:** Slippage or price moved

**Solution:**
- Increase `SLIPPAGE_TOLERANCE` (e.g., 0.02 = 2%)
- Check pool hasn't been created with different price
- Try again immediately

### Issue: "Pool already exists with different fee"

**Solution:**
- Check existing pool's fee tier on PancakeSwap
- Use same fee tier: Update `FEE_TIER` in config
- Or create pool with different fee (separate pool)

---

## Best Practices

### ✅ DO:

1. **Always calculate first:**
   ```bash
   npm run liquidity-v3:calc
   ```

2. **Test on testnet:**
   ```bash
   npm run liquidity-v3:bsc-testnet
   ```

3. **Update BNB price** before calculating (check CoinMarketCap)

4. **Use appropriate fee tier:**
   - Stable pairs: 0.01%
   - Major pairs: 0.05%
   - Most tokens: 0.25%
   - Volatile: 1%

5. **Set reasonable price range:**
   - New token: ±50-100%
   - Established: ±30-50%
   - Stable: ±5-10%

6. **Monitor your position:**
   - Check if price is in range
   - Rebalance if needed
   - Collect fees regularly

### ❌ DON'T:

1. Don't use extremely tight ranges (±5%) unless you'll actively manage
2. Don't forget to update `BNB_PRICE_USD` (affects calculations)
3. Don't add all liquidity at once (consider multiple positions)
4. Don't ignore gas fees (keep extra 0.05 BNB)
5. Don't panic if price moves out of range temporarily

---

## Quick Reference Commands

```bash
# Calculate amounts for default price (0.0003 BNB)
npm run liquidity-v3:calc

# Calculate for custom price
node scripts/add-liquidity-v3.js --calculate --price=0.0005

# Add liquidity on testnet
npm run liquidity-v3:bsc-testnet

# Add liquidity on mainnet
npm run liquidity-v3:bsc

# Check your deployment addresses
npm run addresses:bsc
```

---

## Example Workflows

### Workflow 1: New Token Launch

```bash
# 1. Set target price in config
#    TARGET_PRICE_IN_BNB: 0.0001

# 2. Calculate requirements
npm run liquidity-v3:calc

# 3. Test on testnet first
npm run liquidity-v3:bsc-testnet

# 4. If successful, deploy on mainnet
npm run liquidity-v3:bsc

# 5. Verify on PancakeSwap
#    https://pancakeswap.finance/info/v3/bsc/pools
```

### Workflow 2: Add Liquidity to Existing Pool

```bash
# 1. Check current price on PancakeSwap
#    https://pancakeswap.finance/swap

# 2. Update TARGET_PRICE_IN_BNB to current price

# 3. Calculate with your budget
npm run liquidity-v3:calc

# 4. Add liquidity
npm run liquidity-v3:bsc
```

### Workflow 3: Price Adjustment Strategy

```bash
# 1. Calculate for lower price
node scripts/add-liquidity-v3.js --calculate --price=0.0002

# 2. Calculate for current price  
node scripts/add-liquidity-v3.js --calculate --price=0.0003

# 3. Calculate for higher price
node scripts/add-liquidity-v3.js --calculate --price=0.0004

# 4. Choose strategy and add liquidity accordingly
```

---

## Support & Resources

- **PancakeSwap V3 Docs:** https://docs.pancakeswap.finance/products/pancakeswap-v3
- **PancakeSwap Info:** https://pancakeswap.finance/info/v3/bsc
- **BSCScan:** https://bscscan.com
- **V3 Position Manager:** `0x46A15B0b27311cedF172AB29E4f4766fbE7F4364`

---

## Summary

1. **Update** `BNB_PRICE_USD` in config
2. **Set** your `TARGET_PRICE_IN_BNB`
3. **Calculate** required amounts: `npm run liquidity-v3:calc`
4. **Test** on testnet: `npm run liquidity-v3:bsc-testnet`
5. **Deploy** on mainnet: `npm run liquidity-v3:bsc`
6. **Verify** on PancakeSwap
7. **Monitor** your position regularly

**Good luck! 🚀**
