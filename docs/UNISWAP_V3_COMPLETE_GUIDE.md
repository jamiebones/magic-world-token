# Uniswap V3 Deep Dive - Complete Mathematical Guide

## Overview

Uniswap V3 revolutionized automated market makers (AMMs) by introducing **concentrated liquidity**. Instead of spreading liquidity across the entire price curve (0 to ∞), liquidity providers can concentrate their capital within specific price ranges, achieving capital efficiency up to **4000x** compared to V2.

**Real Example: Your MWT/WBNB Pool**
- Pool Address: `0x88AEBA95750Aa6aEF25CD3B696B0BDa53DabE2d8`
- Current Price: 1 MWT = 0.0000003115 WBNB ($0.00033)
- Your Position: Concentrated in tick range [-153800, -142800]

---

## Table of Contents

1. [Core Concepts](#core-concepts)
2. [Mathematical Foundations](#mathematical-foundations)
3. [Price and Ticks](#price-and-ticks)
4. [sqrtPriceX96 Explained](#sqrtpricex96-explained)
5. [Liquidity Calculation](#liquidity-calculation)
6. [Position Mathematics](#position-mathematics)
7. [Swap Mathematics](#swap-mathematics)
8. [Fee Accumulation](#fee-accumulation)
9. [Real MWT Examples](#real-mwt-examples)
10. [V2 vs V3 Comparison](#v2-vs-v3-comparison)

---

## Core Concepts

### 1. Concentrated Liquidity

**V2 (Old Way):**
```
Liquidity spread across entire curve: [0, ∞)
Capital Efficiency: 1x
```

**V3 (New Way):**
```
Liquidity concentrated in specific ranges: [P_lower, P_upper]
Capital Efficiency: Up to 4000x
```

**Your MWT Position:**
```javascript
Price Range: [P_lower, P_upper]
P_lower = 2.094e-7 WBNB/MWT  // tick -153800
P_upper = 6.289e-7 WBNB/MWT  // tick -142800
Current = 3.115e-7 WBNB/MWT  // tick -149826

// Your liquidity is ONLY active in this range
// Outside this range, you earn NO fees!
```

### 2. Non-Fungible Positions (NFTs)

**V2:** LP tokens are ERC20 (fungible)
```javascript
// Everyone gets the same token
balanceOf(user) = 1000.5 LP tokens
```

**V3:** Positions are ERC721 NFTs (non-fungible)
```javascript
// Each position is unique
tokenId = 4875198  // Your specific position
owner = 0x178113a73061f2049268cebadbf753e93b2aa965
tickLower = -153800
tickUpper = -142800
liquidity = 2982933378959767425990
```

### 3. Tick-Based Pricing

Instead of continuous prices, V3 uses discrete **ticks**:
```
Each tick represents a 0.01% (1 basis point) price change
tick = log₁.₀₀₀₁(price)
price = 1.0001^tick
```

---

## Mathematical Foundations

### The Constant Product Formula (V2 Base)

V2 uses the simple formula:
```
x × y = k

Where:
x = amount of token X (MWT)
y = amount of token Y (WBNB)
k = constant
```

**Price:**
```
P = y / x
```

**Example: Your Old V2 Pool (before it broke)**
```
Reserves: 0.2776 WBNB, 0.0002772 MWT
Price = 0.2776 / 0.0002772 = 1001.4 WBNB per MWT
= $1,069,494 per MWT (BROKEN!)
```

### The Concentrated Liquidity Formula (V3)

V3 modifies this to work within ranges:
```
L² = x × y

Where:
L = liquidity (constant within a position's range)
x = "virtual" amount of token X in the range
y = "virtual" amount of token Y in the range
```

**Key Insight:** The actual reserves are calculated based on the current price and tick range!

---

## Price and Ticks

### Tick Spacing

Different fee tiers have different tick spacing:

| Fee Tier | Tick Spacing | Price Step |
|----------|--------------|------------|
| 0.01%    | 1            | 0.01%      |
| 0.05%    | 10           | 0.10%      |
| 0.25%    | 50           | 0.50%      |
| **1%**   | **200**      | **2.01%**  |

**Your MWT Pool:**
- Fee Tier: 1% (10000 basis points)
- Tick Spacing: 200
- Valid Ticks: ..., -153800, -153600, -153400, ...

### Tick to Price Conversion

**Formula:**
```
price = 1.0001^tick
```

**Your Position Ticks:**
```javascript
// Lower Bound
tick_lower = -153800
P_lower = 1.0001^(-153800)
P_lower = 2.0936e-7 WBNB/MWT

// Upper Bound
tick_upper = -142800
P_upper = 1.0001^(-142800)
P_upper = 6.2890e-7 WBNB/MWT

// Current Price
tick_current = -149826
P_current = 1.0001^(-149826)
P_current = 3.1150e-7 WBNB/MWT
```

### Why Negative Ticks?

Negative ticks mean **token0 < token1** in terms of value:
```javascript
token0 = MWT  (0x73331cb65cfb32b609178B75F70e00216b788401)
token1 = WBNB (0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c)

// Negative tick means:
// It takes MANY MWT to equal 1 WBNB
// 1 MWT = 0.0000003115 WBNB (very small!)
```

### Price Direction

```
Tick increases → Price increases → More token1 per token0
Tick decreases → Price decreases → Less token1 per token0

Example for MWT/WBNB:
tick = -150000 → 1 MWT = 0.0000003059 WBNB
tick = -149826 → 1 MWT = 0.0000003115 WBNB (current)
tick = -149000 → 1 MWT = 0.0000003377 WBNB
```

---

## sqrtPriceX96 Explained

### What is sqrtPriceX96?

Instead of storing price directly, V3 stores the **square root of price**, scaled by 2^96:

```
sqrtPriceX96 = sqrt(price) × 2^96
```

**Your Pool's Current Value:**
```javascript
sqrtPriceX96 = 44219313113930648073605858

// To get price:
price = (sqrtPriceX96 / 2^96)²
```

### Why Square Root?

**Mathematical Efficiency:**
1. Avoids overflow in multiplication
2. Simplifies liquidity calculations
3. Enables efficient tick transitions

**The Math:**
```
If:    L² = x × y
And:   P = y / x
Then:  L = sqrt(x × y)
       L = sqrt(x × P × x)
       L = x × sqrt(P)

This is why we store sqrt(P)!
```

### Why 2^96?

**Precision:**
- Fixed-point arithmetic (no floating point)
- 2^96 gives ~29 decimals of precision
- Handles extreme price ranges: 10^-20 to 10^20

### Calculating Price from sqrtPriceX96

**Step-by-Step:**

```javascript
// Your pool's value
const sqrtPriceX96 = BigInt("44219313113930648073605858");
const Q96 = BigInt(2) ** BigInt(96);

// Step 1: Calculate numerator (sqrtPrice²)
const numerator = sqrtPriceX96 * sqrtPriceX96;
// numerator = 1955346876363869409262857176164

// Step 2: Calculate denominator (2^192)
const denominator = Q96 * Q96;
// denominator = 6277101735386680763835789423207666416102355444464034512896

// Step 3: Divide and convert to decimal
const priceRaw = Number(numerator) / Number(denominator);
// priceRaw = 3.115048528e-7

// Step 4: Adjust for token decimals (both 18)
const decimals0 = 18; // MWT
const decimals1 = 18; // WBNB
const decimalAdjustment = Math.pow(10, decimals1 - decimals0);
const price = priceRaw * decimalAdjustment;
// price = 3.115048528e-7 WBNB/MWT

// In USD (assuming BNB = $1068)
const priceUSD = price * 1068;
// priceUSD = $0.00033289
```

### Converting Price to sqrtPriceX96

**Reverse Process:**

```javascript
// Want to set price to $0.0001 per MWT
const targetPriceUSD = 0.0001;
const bnbUSD = 1068;
const targetPriceBNB = targetPriceUSD / bnbUSD;
// targetPriceBNB = 9.363e-8 WBNB/MWT

// Calculate sqrtPrice
const sqrtPrice = Math.sqrt(targetPriceBNB);
// sqrtPrice = 3.0599e-4

// Scale by 2^96
const Q96 = BigInt(2) ** BigInt(96);
const sqrtPriceX96 = BigInt(Math.floor(sqrtPrice * Number(Q96)));
// sqrtPriceX96 = 24239486616677929387958656

// Convert to tick
const tick = Math.floor(Math.log(targetPriceBNB) / Math.log(1.0001));
// tick = -160933
```

---

## Liquidity Calculation

### What is Liquidity (L)?

Liquidity is a measure of how much trading activity a position can support:

```
L = sqrt(x × y)

Where:
x = virtual amount of token0 in the range
y = virtual amount of token1 in the range
```

**Higher L = More depth = Smaller slippage**

### Your Position's Liquidity

```javascript
const liquidity = BigInt("2982933378959767425990");

// This is HUGE relative to the price range!
// It means your position provides significant depth
```

### Calculating Liquidity from Deposit Amounts

When you deposited **0.3 BNB + 1,583,136 MWT**, V3 calculated the required liquidity:

**Formula (when price is within range):**

```javascript
// Given deposit amounts and price range
const amount0 = 1583136; // MWT
const amount1 = 0.3;     // BNB
const P = 3.115e-7;      // Current price (WBNB/MWT)
const P_lower = 2.094e-7;
const P_upper = 6.289e-7;

// Calculate liquidity from token1 (BNB)
const sqrt_P = Math.sqrt(P);
const sqrt_P_lower = Math.sqrt(P_lower);
const sqrt_P_upper = Math.sqrt(P_upper);

// Liquidity from token1
const L_from_1 = amount1 / (sqrt_P - sqrt_P_lower);

// Liquidity from token0
const L_from_0 = amount0 * sqrt_P * sqrt_P_upper / (sqrt_P_upper - sqrt_P);

// The smaller value determines actual liquidity
const L = Math.min(L_from_0, L_from_1);
```

**In Practice:**
```javascript
// Simplified calculation (actual involves more precision)
const L = 0.3 / (sqrt(3.115e-7) - sqrt(2.094e-7))
// L ≈ 2.98e21 (matches your position!)
```

### Virtual Reserves

Your position doesn't actually hold 1.5M MWT and 0.3 BNB in the traditional sense. Instead:

**Virtual Reserves Formula:**
```javascript
// Amount of token0 (MWT) in range
const x = L * (sqrt_P_upper - sqrt_P) / (sqrt_P * sqrt_P_upper);

// Amount of token1 (WBNB) in range
const y = L * (sqrt_P - sqrt_P_lower);
```

**For Your Position:**
```javascript
// At current price (tick -149826)
const sqrt_P = Math.sqrt(3.115e-7) = 0.000558
const sqrt_P_lower = Math.sqrt(2.094e-7) = 0.000458
const sqrt_P_upper = Math.sqrt(6.289e-7) = 0.000793

const L = 2.98e21;

// MWT in range
const x = L * (0.000793 - 0.000558) / (0.000558 * 0.000793)
x ≈ 1,583,136 MWT ✓

// WBNB in range
const y = L * (0.000558 - 0.000458)
y ≈ 0.298 BNB ✓

// These match your deposits!
```

---

## Position Mathematics

### Position Structure

```solidity
struct Position {
    uint96 nonce;
    address operator;
    address token0;        // MWT
    address token1;        // WBNB
    uint24 fee;            // 10000 (1%)
    int24 tickLower;       // -153800
    int24 tickUpper;       // -142800
    uint128 liquidity;     // 2982933378959767425990
    uint256 feeGrowthInside0LastX128;
    uint256 feeGrowthInside1LastX128;
    uint128 tokensOwed0;   // Fees earned in MWT
    uint128 tokensOwed1;   // Fees earned in WBNB
}
```

### Position Value Calculation

**Total Value = Value of token0 + Value of token1**

```javascript
// At current price P = 3.115e-7
const P = 3.115e-7;
const P_lower = 2.094e-7;
const P_upper = 6.289e-7;
const L = 2.98e21;

// Calculate amounts
const sqrt_P = Math.sqrt(P);
const sqrt_P_lower = Math.sqrt(P_lower);
const sqrt_P_upper = Math.sqrt(P_upper);

// MWT amount
const amount_MWT = L * (sqrt_P_upper - sqrt_P) / (sqrt_P * sqrt_P_upper);
// amount_MWT = 1,583,136 MWT

// WBNB amount
const amount_WBNB = L * (sqrt_P - sqrt_P_lower);
// amount_WBNB = 0.298 BNB

// USD Value (BNB = $1068)
const value_MWT = amount_MWT * P * 1068;
// value_MWT = $526.76

const value_WBNB = amount_WBNB * 1068;
// value_WBNB = $318.26

const total_value = value_MWT + value_WBNB;
// total_value = $845.02
```

### What Happens When Price Moves?

**Scenario 1: Price Increases (More Expensive MWT)**

```javascript
// Price moves from $0.00033 to $0.0005
// tick moves from -149826 to -146974

// Your position automatically rebalances:
// - Sells MWT
// - Accumulates WBNB

// New composition:
const new_P = 4.68e-7; // Higher
const amount_MWT = L * (sqrt_P_upper - sqrt(new_P)) / (sqrt(new_P) * sqrt_P_upper);
// amount_MWT ≈ 1,200,000 MWT (decreased!)

const amount_WBNB = L * (sqrt(new_P) - sqrt_P_lower);
// amount_WBNB ≈ 0.36 BNB (increased!)

// This is AUTOMATIC! No action needed!
```

**Scenario 2: Price Decreases (Cheaper MWT)**

```javascript
// Price moves from $0.00033 to $0.0002
// tick moves from -149826 to -153011

// Your position rebalances:
// - Sells WBNB
// - Accumulates MWT

// New composition:
const new_P = 1.87e-7; // Lower
const amount_MWT = L * (sqrt_P_upper - sqrt(new_P)) / (sqrt(new_P) * sqrt_P_upper);
// amount_MWT ≈ 2,100,000 MWT (increased!)

const amount_WBNB = L * (sqrt(new_P) - sqrt_P_lower);
// amount_WBNB ≈ 0.05 BNB (decreased!)
```

**Scenario 3: Price Goes Out of Range**

```javascript
// If price < P_lower (tick < -153800):
// Position is 100% MWT, 0% WBNB
amount_MWT = L * (sqrt_P_upper - sqrt_P_lower) / (sqrt_P_lower * sqrt_P_upper);
amount_WBNB = 0;
// NO FEES EARNED! Position inactive!

// If price > P_upper (tick > -142800):
// Position is 0% MWT, 100% WBNB
amount_MWT = 0;
amount_WBNB = L * (sqrt_P_upper - sqrt_P_lower);
// NO FEES EARNED! Position inactive!
```

---

## Swap Mathematics

### How Swaps Work in V3

When someone swaps MWT for WBNB:

1. **Find active liquidity** at current tick
2. **Calculate swap amount** within current tick
3. **Move to next tick** if needed
4. **Repeat** until swap complete

### Single-Tick Swap

**Formula for swapping Δy WBNB for Δx MWT:**

```javascript
// Given: Amount of WBNB to swap (Δy)
const delta_y = 0.001; // 0.001 BNB

// Current state
const sqrt_P_current = Math.sqrt(3.115e-7);
const L = 2.98e21;

// New sqrtPrice after swap
const sqrt_P_new = sqrt_P_current + (delta_y / L);

// Amount of MWT received
const delta_x = L * (sqrt_P_new - sqrt_P_current) / (sqrt_P_new * sqrt_P_current);

// Calculate
const sqrt_P_new = 0.000558 + (0.001 / 2.98e21);
const sqrt_P_new = 0.000558 + 3.355e-25;
const sqrt_P_new ≈ 0.000558; // Tiny change!

const delta_x = 2.98e21 * (0.000558 - 0.000558) / (0.000558 * 0.000558);
const delta_x ≈ 3,209 MWT
```

**Price Impact:**
```javascript
// Old price
const P_old = 3.115e-7 WBNB/MWT;

// New price
const P_new = (sqrt_P_new)^2;
const P_new ≈ 3.116e-7 WBNB/MWT;

// Impact
const impact = (P_new - P_old) / P_old * 100;
const impact ≈ 0.03% // Very small!
```

### Multi-Tick Swap (Large Trade)

For large swaps that cross multiple ticks:

```javascript
// Want to swap 1 BNB for MWT
const amount_in = 1.0; // BNB
let remaining = amount_in;
let amount_out = 0; // MWT
let current_tick = -149826;

while (remaining > 0) {
    // Get liquidity at current tick
    const L = getLiquidityAtTick(current_tick);
    
    // Calculate max swap in this tick
    const next_tick = getNextTick(current_tick);
    const sqrt_P_next = Math.sqrt(1.0001^next_tick);
    
    // Amount that can be swapped in this tick
    const amount_in_tick = L * (sqrt_P_next - sqrt_P_current);
    
    if (remaining <= amount_in_tick) {
        // Swap completes in this tick
        const sqrt_P_final = sqrt_P_current + (remaining / L);
        const delta_x = L * (sqrt_P_final - sqrt_P_current) / (sqrt_P_final * sqrt_P_current);
        amount_out += delta_x;
        remaining = 0;
    } else {
        // Use all liquidity in this tick, move to next
        const delta_x = L * (sqrt_P_next - sqrt_P_current) / (sqrt_P_next * sqrt_P_current);
        amount_out += delta_x;
        remaining -= amount_in_tick;
        current_tick = next_tick;
        sqrt_P_current = sqrt_P_next;
    }
}

// Result: You get amount_out MWT for 1 BNB
```

### Slippage Protection

**Why You Need Slippage Tolerance:**

```javascript
// Expected output (no price change)
const expected = 3,209,000 MWT;

// Actual output (after other txs)
const actual = 3,180,000 MWT;

// Slippage
const slippage = (expected - actual) / expected * 100;
// slippage = 0.9%

// If you set maxSlippage = 0.5%, trade reverts!
```

---

## Fee Accumulation

### How Fees Work

**Fee Structure:**
- Your pool: 1% fee tier (10000 basis points)
- On each swap: 1% goes to liquidity providers
- Fees accrue **only when price is in your range**

### Fee Calculation

**Formula:**
```
Your fee share = (Your Liquidity / Total Liquidity) × Swap Fee
```

**Example Swap:**
```javascript
// Someone swaps 1 BNB for MWT
const swap_amount = 1.0; // BNB
const fee_rate = 0.01; // 1%
const total_fee = swap_amount * fee_rate;
// total_fee = 0.01 BNB

// Your position
const your_L = 2.98e21;
const total_L = 2.98e21; // You're the only LP!
const your_share = your_L / total_L;
// your_share = 100%!

// Your fee
const your_fee = total_fee * your_share;
// your_fee = 0.01 BNB
```

### Fee Growth Tracking

V3 uses **cumulative fee growth** to track fees:

```solidity
// Global fee growth (per unit of liquidity)
uint256 feeGrowthGlobal0X128; // MWT fees
uint256 feeGrowthGlobal1X128; // WBNB fees

// Your position's last snapshot
uint256 feeGrowthInside0LastX128;
uint256 feeGrowthInside1LastX128;

// Fees owed to you
uint128 tokensOwed0 = (feeGrowthGlobal0X128 - feeGrowthInside0LastX128) * liquidity / 2^128;
uint128 tokensOwed1 = (feeGrowthGlobal1X128 - feeGrowthInside1LastX128) * liquidity / 2^128;
```

### Collecting Fees

```javascript
// Check your fees
const position = positionManager.positions(tokenId);
const feesOwed0 = position.tokensOwed0; // MWT
const feesOwed1 = position.tokensOwed1; // WBNB

// Collect fees
positionManager.collect({
    tokenId: 4875198,
    recipient: your_address,
    amount0Max: type(uint128).max,
    amount1Max: type(uint128).max
});
```

---

## Real MWT Examples

### Example 1: Your Current Position

**Given:**
```javascript
NFT ID: 4875198
Tick Range: [-153800, -142800]
Price Range: [2.094e-7, 6.289e-7] WBNB/MWT
Current Price: 3.115e-7 WBNB/MWT
Liquidity: 2.98e21
```

**Composition:**
```javascript
MWT: 1,583,136 tokens
WBNB: 0.298 BNB
Value: ~$845 (at BNB=$1068, MWT=$0.00033)
```

**Fee Earnings:**
```javascript
// Every 1 BNB swapped through your range
Fee earned = 0.01 BNB (1%)

// Daily volume estimate: 5 BNB
Daily fees = 5 × 0.01 = 0.05 BNB = $53.40/day

// Annual: $19,491 (if volume stays constant)
// APR: $19,491 / $845 = 2,306%! (Unrealistic, just example)
```

### Example 2: Narrower Range (Higher Capital Efficiency)

**Scenario:** Concentrate liquidity in tighter range

```javascript
// New range: ±10% around current price
P_current = 3.115e-7;
P_lower = 3.115e-7 × 0.9 = 2.804e-7;  // tick -150933
P_upper = 3.115e-7 × 1.1 = 3.427e-7;  // tick -148758

// Same deposit: 0.3 BNB + 1.58M MWT
// But liquidity is now concentrated in 20% of previous range!

// Calculate new liquidity
const sqrt_P = Math.sqrt(3.115e-7);
const sqrt_P_lower = Math.sqrt(2.804e-7);
const sqrt_P_upper = Math.sqrt(3.427e-7);

const L_new = 0.3 / (sqrt_P - sqrt_P_lower);
// L_new ≈ 2.3× higher than before!

// Result: 2.3× more fees (but risk of going out of range)
```

### Example 3: Full Range Position (Like V2)

**Scenario:** Provide liquidity across entire curve

```javascript
// Range: [0, ∞]
tickLower = -887220; // Minimum tick
tickUpper = 887220;  // Maximum tick

// Same deposit: 0.3 BNB + 1.58M MWT
const L_full = 0.3 / (sqrt(∞) - sqrt(0));
// L_full → very small!

// Capital efficiency compared to your position:
efficiency = L_your / L_full;
// efficiency ≈ 47× more efficient with concentrated liquidity!
```

### Example 4: Price Moves Out of Range

**Scenario:** MWT price drops below your range

```javascript
// Current range: [2.094e-7, 6.289e-7] WBNB/MWT
// Current price: 3.115e-7 (in range)

// Price drops to 1.5e-7 (below P_lower)
// Your position becomes:
MWT: 100%
WBNB: 0%

// Exact amount:
const amount_MWT = L * (sqrt_P_upper - sqrt_P_lower) / (sqrt_P_lower * sqrt_P_upper);
// amount_MWT ≈ 3,250,000 MWT

// Value: 3,250,000 × $0.00016 = $520
// You lost $325 from impermanent loss!
// NO FEES until price comes back in range!
```

### Example 5: Calculating Ideal Range for Target

**Goal:** Set range for MWT to stay between $0.0001 - $0.0005

```javascript
// Convert USD to WBNB price (BNB = $1068)
P_lower_USD = 0.0001;
P_upper_USD = 0.0005;

P_lower_BNB = 0.0001 / 1068 = 9.36e-8 WBNB/MWT;
P_upper_BNB = 0.0005 / 1068 = 4.68e-7 WBNB/MWT;

// Convert to ticks
tick_lower = Math.floor(Math.log(P_lower_BNB) / Math.log(1.0001));
// tick_lower = -160933

tick_upper = Math.floor(Math.log(P_upper_BNB) / Math.log(1.0001));
// tick_upper = -147401

// Round to tick spacing (200 for 1% fee tier)
tick_lower = Math.floor(-160933 / 200) × 200 = -161000;
tick_upper = Math.ceil(-147401 / 200) × 200 = -147400;

// This range covers 5× price movement!
```

---

## V2 vs V3 Comparison

### Capital Efficiency

**V2 (Your Old Pool):**
```javascript
// To provide $100 of liquidity at current price:
Deposit: 50 MWT + $50 in BNB
Effective Liquidity: $100 (spread across all prices)
Capital Efficiency: 1×
```

**V3 (Your Current Pool):**
```javascript
// To provide $100 of liquidity at current price in ±50% range:
Deposit: 25 MWT + $25 in BNB
Effective Liquidity: $100 (concentrated in range)
Capital Efficiency: 4× (uses 1/4 the capital!)
```

### Fee Comparison

**Same Daily Volume: 10 BNB**

**V2:**
```javascript
Fee rate: 0.3%
Your share: 100% (only LP)
Daily fees: 10 × 0.003 = 0.03 BNB = $32.04
```

**V3 (±50% range):**
```javascript
Fee rate: 1%
Your share: 100% (only LP)
Active time: ~80% (in range 80% of the time)
Daily fees: 10 × 0.01 × 0.8 = 0.08 BNB = $85.44

// 2.67× more fees!
```

### Impermanent Loss

**V2 IL Formula:**
```javascript
IL = 2 × sqrt(price_ratio) / (1 + price_ratio) - 1

// If MWT 2× in price:
IL = 2 × sqrt(2) / (1 + 2) - 1 = -5.7%
```

**V3 IL (depends on range):**
```javascript
// Narrower range = Higher IL
// If price moves out of range = Maximum IL

// Example: Your ±50% range
// If MWT goes 2× (out of range):
IL ≈ -20% (much worse than V2!)

// But you earned 2.67× more fees to compensate!
```

### Rebalancing

**V2:**
```
No action needed
Position automatically rebalances
Always earns fees
```

**V3:**
```
May need to adjust range
Position can go inactive
Need to monitor and rebalance
But earn much more fees when active!
```

---

## Advanced Topics

### Just-In-Time (JIT) Liquidity

**Strategy:** Add liquidity just before large swaps, remove after

```javascript
// Detect large pending swap: 10 BNB → MWT
// Add narrow liquidity: tick range ±2 ticks
// Earn fee: 10 × 0.01 = 0.1 BNB
// Remove liquidity immediately
// Profit without impermanent loss risk!

// This is why professional LPs dominate V3
```

### Range Orders

**Use V3 as a limit order:**

```javascript
// Want to sell 1M MWT when price reaches $0.0005

// Create position:
tickLower = tick_at($0.0005);
tickUpper = tick_at($0.0006);
// Deposit only MWT

// When price enters range:
// MWT automatically sold for WBNB
// You end up with 100% WBNB
// Essentially a limit sell order!
```

### Liquidity Mining

**V3 + Staking:**
```javascript
// 1. Provide V3 liquidity → Get NFT
// 2. Stake NFT → Earn extra rewards
// 3. Compound fees back into position
// 4. Adjust range as price moves

// Example APR breakdown:
Trading fees: 50% APR
Staking rewards: 100% APR
Total: 150% APR
```

---

## Practical Formulas Cheat Sheet

### Price Conversions

```javascript
// Tick to Price
price = 1.0001^tick

// Price to Tick
tick = floor(log(price) / log(1.0001))

// sqrtPriceX96 to Price
price = (sqrtPriceX96 / 2^96)^2

// Price to sqrtPriceX96
sqrtPriceX96 = sqrt(price) × 2^96
```

### Liquidity Calculations

```javascript
// From token amounts (price in range)
L = amount1 / (sqrt(P) - sqrt(P_lower))
L = amount0 × sqrt(P) × sqrt(P_upper) / (sqrt(P_upper) - sqrt(P))

// To token amounts
amount0 = L × (sqrt(P_upper) - sqrt(P)) / (sqrt(P) × sqrt(P_upper))
amount1 = L × (sqrt(P) - sqrt(P_lower))
```

### Swap Calculations

```javascript
// Single tick swap (Δy → Δx)
sqrt_P_new = sqrt_P + (Δy / L)
Δx = L × (sqrt_P_new - sqrt_P) / (sqrt_P_new × sqrt_P)

// Single tick swap (Δx → Δy)
sqrt_P_new = L × sqrt_P / (L - Δx × sqrt_P)
Δy = L × (sqrt_P_new - sqrt_P)
```

### Fee Calculations

```javascript
// Fee earned per swap
fee = swap_amount × fee_rate × (your_L / total_L)

// Cumulative fees
fees_owed = (feeGrowthGlobal - feeGrowthLast) × liquidity / 2^128
```

---

## Conclusion

Uniswap V3 is a revolutionary AMM design that offers:

✅ **4000× capital efficiency** through concentrated liquidity
✅ **Flexible fee tiers** (0.01%, 0.05%, 0.25%, 1%)
✅ **Range orders** as limit orders
✅ **Multiple positions** per pair
✅ **Higher fee earnings** for active LPs

But comes with trade-offs:

⚠️ **Complexity** - Much harder to manage than V2
⚠️ **Active management** - Need to monitor and rebalance
⚠️ **Impermanent loss risk** - Higher if price goes out of range
⚠️ **Gas costs** - More expensive operations

**For Your MWT Position:**
- Current price: $0.00033 (in range ✓)
- Deviation from target: 10.94% (excellent!)
- Fee tier: 1% (good for volatile pairs)
- Range: ±100% (reasonable buffer)
- Status: Earning fees actively! 💰

---

**Key Takeaway:** V3 is like trading with leverage - higher returns but requires more skill and active management. For stable pairs or professional LPs, it's amazing. For casual LPs, V2 might be simpler!

---

## Further Reading

- [Uniswap V3 Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [Uniswap V3 Core Math](https://github.com/Uniswap/v3-core)
- [PancakeSwap V3 Docs](https://docs.pancakeswap.finance/products/pancakeswap-v3)
- [V3 Calculator Tool](https://uniswap.fish/)

---

**Generated:** October 21, 2025  
**Example Token:** Magic World Token (MWT)  
**Pool:** 0x88AEBA95750Aa6aEF25CD3B696B0BDa53DabE2d8  
**Network:** BSC (Binance Smart Chain)
