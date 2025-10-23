# Understanding Your MWT Position Tick Range

## Your Position Details

```javascript
NFT Position ID: 4875198
Tick Range: [-153800, -142800]
Current Tick: -149826
Status: ✅ IN RANGE (earning fees!)
```

---

## What Are Ticks?

Think of ticks as **price levels** on a ladder. Each tick represents a specific price point where:
- Moving up 1 tick = **0.01% price increase**
- Moving down 1 tick = **0.01% price decrease**

**Formula:**
```javascript
price = 1.0001^tick

// Each tick is a 0.01% (1 basis point) price change
```

---

## Your Tick Range Explained

### Lower Bound: Tick -153800

This is the **minimum price** where your position is active.

**Calculation:**
```javascript
tick_lower = -153800

// Convert to price (WBNB per MWT)
price_lower = 1.0001^(-153800)
price_lower = 0.0000002094 WBNB per MWT

// Convert to USD (assuming BNB = $1068)
price_lower_usd = 0.0000002094 × 1068
price_lower_usd = $0.0002236

// In human terms:
// 1 MWT = $0.000224
```

**What this means:**
- If MWT price drops below **$0.000224**, your position becomes **100% MWT**
- You stop earning fees
- Your liquidity becomes inactive

### Upper Bound: Tick -142800

This is the **maximum price** where your position is active.

**Calculation:**
```javascript
tick_upper = -142800

// Convert to price (WBNB per MWT)
price_upper = 1.0001^(-142800)
price_upper = 0.0000006289 WBNB per MWT

// Convert to USD (assuming BNB = $1068)
price_upper_usd = 0.0000006289 × 1068
price_upper_usd = $0.0006717

// In human terms:
// 1 MWT = $0.000672
```

**What this means:**
- If MWT price rises above **$0.000672**, your position becomes **100% WBNB**
- You stop earning fees
- Your liquidity becomes inactive

### Current Position: Tick -149826

This is where the price is **right now**.

**Calculation:**
```javascript
tick_current = -149826

// Convert to price (WBNB per MWT)
price_current = 1.0001^(-149826)
price_current = 0.0000003115 WBNB per MWT

// Convert to USD (assuming BNB = $1068)
price_current_usd = 0.0000003115 × 1068
price_current_usd = $0.0003327

// In human terms:
// 1 MWT = $0.000333
```

**Status:**
```javascript
tick_lower < tick_current < tick_upper
-153800   <   -149826    <   -142800

✅ YOU ARE IN RANGE!
✅ EARNING FEES ON EVERY SWAP!
✅ POSITION IS ACTIVE!
```

---

## Visual Representation

```
Price Scale (USD per MWT):
|
|  $0.000672 ◄─── UPPER BOUND (tick -142800)
|      ▲
|      │ If price goes here, you have 100% WBNB
|      │ and STOP earning fees
|      │
|  $0.000333 ◄─── CURRENT PRICE (tick -149826) ✅ YOU ARE HERE
|      │
|      │ THIS IS YOUR ACTIVE RANGE
|      │ You earn fees on all swaps in this range
|      │
|  $0.000224 ◄─── LOWER BOUND (tick -153800)
|      ▼
|  If price goes here, you have 100% MWT
|  and STOP earning fees
|
```

---

## What's Inside Your Range?

### Current Composition

At the current price ($0.000333), your position holds:

```javascript
MWT Amount: ~1,583,136 MWT
WBNB Amount: ~0.298 BNB

// How it's calculated:
const L = 2.98e21; // Your liquidity
const sqrt_P = Math.sqrt(3.115e-7);
const sqrt_P_lower = Math.sqrt(2.094e-7);
const sqrt_P_upper = Math.sqrt(6.289e-7);

// MWT in position
const mwt = L × (sqrt_P_upper - sqrt_P) / (sqrt_P × sqrt_P_upper);
// mwt ≈ 1,583,136 MWT

// WBNB in position
const wbnb = L × (sqrt_P - sqrt_P_lower);
// wbnb ≈ 0.298 BNB
```

### Value Breakdown

```javascript
// MWT portion
MWT value = 1,583,136 × $0.000333 = $527.22

// WBNB portion
WBNB value = 0.298 × $1068 = $318.26

// Total position value
Total = $527.22 + $318.26 = $845.48
```

---

## Price Movement Scenarios

### Scenario 1: Price Moves Up (MWT Gets More Expensive)

```javascript
// Price goes from $0.000333 → $0.000500
// Tick moves from -149826 → -146974

// Your position AUTOMATICALLY rebalances:
// ❌ MWT decreases: 1,583,136 → ~1,200,000 MWT
// ✅ WBNB increases: 0.298 → ~0.360 BNB

// The protocol sells MWT for WBNB as price rises!
// This happens WITHOUT any action from you!
```

**Why does this happen?**

As price increases, traders want to buy MWT, so they give you WBNB. Your position automatically provides MWT to buyers and accumulates WBNB.

### Scenario 2: Price Moves Down (MWT Gets Cheaper)

```javascript
// Price goes from $0.000333 → $0.000250
// Tick moves from -149826 → -152606

// Your position AUTOMATICALLY rebalances:
// ✅ MWT increases: 1,583,136 → ~2,000,000 MWT
// ❌ WBNB decreases: 0.298 → ~0.180 BNB

// The protocol sells WBNB for MWT as price falls!
// This happens WITHOUT any action from you!
```

**Why does this happen?**

As price decreases, traders want to sell MWT, so they give you MWT. Your position automatically provides WBNB to sellers and accumulates MWT.

### Scenario 3: Price Goes Below Range

```javascript
// Price drops below $0.000224 (tick < -153800)
// Your position becomes:

MWT: 100%     ← All your capital is now MWT
WBNB: 0%      ← No WBNB left

// Exact amounts:
const amount_mwt = L × (sqrt_P_upper - sqrt_P_lower) / (sqrt_P_lower × sqrt_P_upper);
// amount_mwt ≈ 3,250,000 MWT

// Value: 3,250,000 × $0.000200 = $650
// You lost money due to impermanent loss!

❌ NOT EARNING FEES! (position inactive)
❌ Need to adjust range or wait for price to come back
```

### Scenario 4: Price Goes Above Range

```javascript
// Price rises above $0.000672 (tick > -142800)
// Your position becomes:

MWT: 0%       ← No MWT left
WBNB: 100%    ← All your capital is now WBNB

// Exact amounts:
const amount_wbnb = L × (sqrt_P_upper - sqrt_P_lower);
// amount_wbnb ≈ 0.54 BNB

// Value: 0.54 × $1068 = $576.72
// You missed out on MWT gains!

❌ NOT EARNING FEES! (position inactive)
❌ Need to adjust range or wait for price to come back
```

---

## Why These Specific Ticks?

### Tick Spacing

Your pool has a **1% fee tier**, which means:
- Tick spacing: **200 ticks**
- Valid ticks: ..., -154000, -153800, -153600, -153400, ...

You can only create positions at multiples of 200!

```javascript
// These are VALID:
tick_lower = -153800 ✅ (divisible by 200)
tick_upper = -142800 ✅ (divisible by 200)

// These would be INVALID:
tick_lower = -153799 ❌ (not divisible by 200)
tick_upper = -142750 ❌ (not divisible by 200)
```

### Range Width

Your range covers:

```javascript
// Tick difference
tick_width = tick_upper - tick_lower
tick_width = -142800 - (-153800)
tick_width = 11,000 ticks

// Price ratio
price_ratio = price_upper / price_lower
price_ratio = 0.0000006289 / 0.0000002094
price_ratio = 3.00×

// In percentage:
range = (price_upper / price_lower - 1) × 100
range = (3.00 - 1) × 100 = 200%

// Your range covers ±100% around center price
```

**What this means:**
- Price can **triple** (3×) from lower to upper bound
- Price can drop **67%** and still be in range
- This is a **wide range** = lower fees but safer

---

## How You Earn Fees

### Fee Accumulation

Every time someone swaps in your range:

```javascript
// Example swap: Someone trades 1 BNB for MWT
const swap_amount = 1.0; // BNB
const fee_rate = 0.01;   // 1% fee tier

// Total fee collected
const total_fee = swap_amount × fee_rate;
// total_fee = 0.01 BNB

// Your share (if you're the only LP)
const your_liquidity = 2.98e21;
const total_liquidity = 2.98e21; // You're the only one!
const your_share = your_liquidity / total_liquidity;
// your_share = 100%!

// Your fee
const your_fee = total_fee × your_share;
// your_fee = 0.01 BNB = $10.68
```

### Fee Rate by Range Width

**Key Insight:** Narrower range = Higher fees per dollar

```javascript
// Your current range: ±100% (wide)
// Capital efficiency: ~47×
// If 10 BNB traded daily: 10 × 0.01 = 0.1 BNB fees/day = $106.80/day

// If you used ±20% range (narrow):
// Capital efficiency: ~235×
// If 10 BNB traded daily: 10 × 0.01 = 0.1 BNB fees/day = $106.80/day
// BUT, you're 5× more likely to go out of range!

// Trade-off:
// Wide range = Lower fees per dollar but safer
// Narrow range = Higher fees per dollar but riskier
```

---

## Distance from Target

Your target peg is **$0.0003**, and you're at **$0.000333**:

```javascript
// Current status
const current_price = 0.000333;
const target_price = 0.0003;
const lower_bound = 0.000224;
const upper_bound = 0.000672;

// Position relative to range
const range_size = upper_bound - lower_bound;
const position_in_range = (current_price - lower_bound) / range_size;
// position_in_range = 24.4%

// You're in the LOWER QUARTER of your range
// This means more MWT than WBNB in your position
```

**Visual Position:**

```
[Lower Bound]─────────────────────────────────[Upper Bound]
$0.000224                                     $0.000672
    ├──────────┤ YOU ARE HERE ($0.000333)
    0%        24.4%                          100%
    
    ◄─────────────────────────────────────────►
    More MWT                           More WBNB
```

---

## What Happens as Price Changes?

### Real-Time Rebalancing

```javascript
// Starting point (current):
Price: $0.000333
MWT: 1,583,136 (74.5% of value)
WBNB: 0.298 (25.5% of value)

// If price moves to $0.000400 (center of range):
Price: $0.000400
MWT: 1,300,000 (65% of value)
WBNB: 0.350 (35% of value)

// If price moves to $0.000550 (near upper):
Price: $0.000550
MWT: 800,000 (44% of value)
WBNB: 0.450 (56% of value)

// Notice: As price increases, you hold more WBNB!
// This is AUTOMATIC rebalancing by the protocol!
```

---

## Managing Your Position

### When to Adjust Range?

**Adjust if:**
- ❌ Price consistently outside range (not earning fees)
- ❌ Price hugging upper/lower bound (might exit soon)
- ❌ Your price target changed (e.g., new peg at $0.001)

**Keep current range if:**
- ✅ Price stays within range most of the time
- ✅ Earning consistent fees
- ✅ Range matches your price expectations

### How to Adjust?

```javascript
// Option 1: Remove and recreate
1. Remove liquidity from current position (NFT #4875198)
2. Create new position with different tick range
3. Gas cost: ~$2-5

// Option 2: Add second position
1. Keep current position
2. Create new position with different range
3. Diversify your liquidity!
```

---

## Key Takeaways

1. **Your Range:** $0.000224 - $0.000672 (3× price movement)
2. **Current Price:** $0.000333 (24.4% through range)
3. **Status:** ✅ In range, earning fees!
4. **Composition:** 74.5% MWT, 25.5% WBNB (by value)
5. **Safety:** Wide range protects against volatility
6. **Fee Rate:** 1% per swap (100 basis points)

**Bottom Line:** Your position is **well-configured** for a volatile token like MWT. The wide range gives you buffer against price swings while still earning good fees!

---

## Advanced: Tick Math Reference

### Key Formulas

```javascript
// Tick to Price
price = 1.0001^tick

// Price to Tick
tick = Math.floor(Math.log(price) / Math.log(1.0001))

// Tick to sqrtPrice
sqrtPrice = sqrt(1.0001^tick)
sqrtPrice = 1.00005^tick

// Adjacent tick price difference (0.01%)
price_diff = price × 0.0001
```

### Your Specific Values

```javascript
// Lower bound
tick = -153800
price = 1.0001^(-153800) = 2.094e-7 WBNB/MWT
sqrtPrice = 4.576e-4

// Current
tick = -149826
price = 1.0001^(-149826) = 3.115e-7 WBNB/MWT
sqrtPrice = 5.581e-4
sqrtPriceX96 = 44219313113930648073605858

// Upper bound
tick = -142800
price = 1.0001^(-142800) = 6.289e-7 WBNB/MWT
sqrtPrice = 7.930e-4
```

---

**TL;DR:** Your tick range [-153800, -142800] means your liquidity is active when MWT trades between **$0.000224 and $0.000672**. You're currently at **$0.000333** (middle of range), earning fees on every swap! 💰
