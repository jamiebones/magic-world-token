# MWGFarmingPool Contract - Complete Line-by-Line Explanation (Part 2)

**Contract Version:** Post-Security Fixes  
**Date:** November 3, 2025  
**Part:** 2 of 3 (Lines 370-700)

---

## Table of Contents - Part 2

1. [Unstake Position Function](#unstake-position-function)
2. [Claim Rewards Functions](#claim-rewards-functions)
3. [Emergency Unstake](#emergency-unstake)
4. [Pool Update Function](#pool-update-function)
5. [View Functions](#view-functions)

---

## Unstake Position Function

### Lines 375-425: Complete Unstake Flow

```solidity
/**
 * @dev Unstake position and claim rewards
 */
function unstakePosition(uint256 tokenId) external nonReentrant {
    StakedPosition storage position = stakedPositions[tokenId];
    require(position.owner == msg.sender, "Not position owner");
    require(block.timestamp >= position.lockUntil, "Position locked");

    updatePool();

    // Calculate pending rewards
    uint256 pending = _calculatePendingRewards(position);

    // ==================== EFFECTS: Update all state first ====================

    // Update tracking
    totalStakedValue -= position.usdValue;
    userTotalValue[msg.sender] -= position.usdValue;
    _removeUserPosition(msg.sender, tokenId);

    // Delete position before external calls
    delete stakedPositions[tokenId];

    // ==================== INTERACTIONS: External calls last ====================

    // Transfer NFT back to user
    IERC721(positionManager).safeTransferFrom(
        address(this),
        msg.sender,
        tokenId
    );

    // Distribute rewards
    if (pending > 0) {
        _safeRewardTransfer(msg.sender, pending);
    }

    emit PositionUnstaked(msg.sender, tokenId, pending);
}
```

**Explanation:**

#### Lines 378-382: Function Declaration & Validation

- **Line 378:** `external nonReentrant` - External call with reentrancy protection
- **Line 379:** Load position from storage (using `storage` not `memory`)
  - `storage` means we're referencing the actual stored data
  - Changes to `position` would update the mapping (but we delete it later)
- **Line 380:** Verify caller is the position owner
  - Only person who staked can unstake
- **Line 381:** Verify lock period has expired
  - If locked until Dec 31, can't unstake before Dec 31
  - If `lockUntil == 0`, no lock, can unstake anytime

#### Lines 383-387: Update & Calculate Rewards

```solidity
updatePool();

// Calculate pending rewards
uint256 pending = _calculatePendingRewards(position);
```

**Explanation:**

- **Line 383:** Update global pool state first
  - Ensures `accRewardPerShare` is current
  - Critical for accurate reward calculation

- **Line 386:** Calculate all pending rewards for this position
  - Calls `_calculatePendingRewards()` internal function
  - Includes security check: validates position still has liquidity
  - Returns 0 if liquidity was removed

#### Lines 389-397: Effects - Update State

```solidity
// ==================== EFFECTS: Update all state first ====================

// Update tracking
totalStakedValue -= position.usdValue;
userTotalValue[msg.sender] -= position.usdValue;
_removeUserPosition(msg.sender, tokenId);

// Delete position before external calls
delete stakedPositions[tokenId];
```

**Explanation:**

**Checks-Effects-Interactions (CEI) Pattern:**
This is a critical security pattern to prevent reentrancy attacks.

- **Line 392:** Decrease global staked value
  - Removes this position's USD value from total

- **Line 393:** Decrease user's total value
  - Updates user's cumulative staked value

- **Line 394:** Remove token ID from user's position array
  - Calls helper function `_removeUserPosition()`
  - Finds token ID in array, removes it

- **Line 397:** Delete the entire position struct
  - Frees up storage (gas refund)
  - Sets `owner` back to `address(0)`
  - **Done BEFORE external calls for security**

**Why delete before external calls?**
- If NFT transfer called back into contract (reentrancy)
- Position is already deleted, so reentrant call would fail
- Prevents double-unstaking or other exploits

#### Lines 399-412: Interactions - External Calls

```solidity
// ==================== INTERACTIONS: External calls last ====================

// Transfer NFT back to user
IERC721(positionManager).safeTransferFrom(
    address(this),
    msg.sender,
    tokenId
);

// Distribute rewards
if (pending > 0) {
    _safeRewardTransfer(msg.sender, pending);
}

emit PositionUnstaked(msg.sender, tokenId, pending);
```

**Explanation:**

- **Lines 402-406:** Return NFT to user
  - Contract owned the NFT, now transferring back
  - User regains full control of their position
  - Can now remove liquidity, transfer, etc.

- **Lines 409-411:** Send rewards if any
  - Only if `pending > 0`
  - Calls `_safeRewardTransfer()` which handles accounting
  - Safe: won't revert if insufficient rewards, just sends what's available

- **Line 413:** Emit event with rewards earned

**Complete Flow Summary:**
1. ✅ Verify ownership and lock expiry
2. ✅ Update pool state
3. ✅ Calculate rewards
4. ✅ Update all state variables
5. ✅ Delete position
6. ✅ Transfer NFT back
7. ✅ Send rewards
8. ✅ Emit event

---

## Claim Rewards Functions

### Lines 417-451: Claim Specific Positions

```solidity
/**
 * @dev Claim rewards for specific positions
 */
function claimRewards(
    uint256[] calldata tokenIds
) external nonReentrant whenNotPaused {
    require(tokenIds.length > 0, "No positions specified");
    require(tokenIds.length <= MAX_BATCH_SIZE, "Batch size too large");

    updatePool();

    uint256 totalPending = 0;

    for (uint256 i = 0; i < tokenIds.length; i++) {
        uint256 tokenId = tokenIds[i];
        StakedPosition storage position = stakedPositions[tokenId];
        require(position.owner == msg.sender, "Not position owner");

        uint256 pending = _calculatePendingRewards(position);
        if (pending > 0) {
            totalPending += pending;
            position.rewardDebt =
                (position.usdValue *
                    position.boostMultiplier *
                    accRewardPerShare) /
                (PRECISION * PRECISION * BASE_MULTIPLIER);
        }
    }

    require(totalPending > 0, "No rewards available");
    _safeRewardTransfer(msg.sender, totalPending);

    emit RewardsClaimed(msg.sender, totalPending, tokenIds);
}
```

**Explanation:**

#### Lines 421-425: Function Declaration & Validation

- **Line 422:** `calldata` - Read-only array parameter (gas efficient)
  - Array stays in transaction data, not copied to memory
- **Line 423:** `whenNotPaused` - Blocked if contract is paused
- **Line 424:** Array must have at least 1 position
- **Line 425:** Array can't exceed 50 positions
  - Prevents gas limit DoS attack
  - If someone has 1000 positions, they claim in batches

#### Lines 427-429: Update Pool & Initialize Counter

```solidity
updatePool();

uint256 totalPending = 0;
```

**Explanation:**

- **Line 427:** Update global state before any reward calculations
- **Line 429:** Accumulator for total rewards across all positions

#### Lines 431-445: Loop Through Positions

```solidity
for (uint256 i = 0; i < tokenIds.length; i++) {
    uint256 tokenId = tokenIds[i];
    StakedPosition storage position = stakedPositions[tokenId];
    require(position.owner == msg.sender, "Not position owner");

    uint256 pending = _calculatePendingRewards(position);
    if (pending > 0) {
        totalPending += pending;
        position.rewardDebt =
            (position.usdValue *
                position.boostMultiplier *
                accRewardPerShare) /
            (PRECISION * PRECISION * BASE_MULTIPLIER);
    }
}
```

**Explanation:**

For each token ID in the array:

- **Line 432:** Get token ID from array
- **Line 433:** Load position from storage
- **Line 434:** Verify caller owns this position
  - Can't claim rewards for someone else's positions

- **Line 436:** Calculate pending rewards
  - Includes liquidity validation (security fix)
  - Returns 0 if liquidity was removed

- **Line 437:** If has rewards (> 0)
- **Line 438:** Add to total
- **Lines 439-443:** **Update reward debt**
  - This is critical!
  - Formula: `(usdValue * boost * accRewardPerShare) / (PRECISION² * BASE_MULTIPLIER)`
  - Sets debt to current accumulated rewards
  - Next time rewards calculated: `(new_accRewardPerShare - this_debt)`
  - Prevents double-claiming

**Why update rewardDebt?**
```solidity
// Example:
// User stakes $1000 with 1x multiplier
// accRewardPerShare = 100
// rewardDebt = 1000 * 1000 * 100 / (1e18 * 1e18 * 1000) = ...

// Time passes, accRewardPerShare increases to 200
// Pending rewards = (1000 * 1000 * 200) - rewardDebt
// User claims, we set rewardDebt = (1000 * 1000 * 200)

// More time passes, accRewardPerShare = 300
// Pending rewards = (1000 * 1000 * 300) - (1000 * 1000 * 200)
// Only rewards from 200→300 counted, not 0→200 again!
```

#### Lines 447-450: Transfer & Emit

```solidity
require(totalPending > 0, "No rewards available");
_safeRewardTransfer(msg.sender, totalPending);

emit RewardsClaimed(msg.sender, totalPending, tokenIds);
```

**Explanation:**

- **Line 447:** Revert if no rewards to claim
  - Saves gas vs. transferring 0 tokens
- **Line 448:** Send total rewards
  - Updates `totalRewardsDistributed`
  - Updates `userRewardsClaimed[msg.sender]`
- **Line 450:** Emit event with all token IDs claimed

### Lines 454-483: Claim All Rewards

```solidity
/**
 * @dev Claim all rewards for user
 */
function claimAllRewards() external nonReentrant whenNotPaused {
    uint256[] memory positions = userPositions[msg.sender];
    require(positions.length > 0, "No positions");

    updatePool();

    uint256 totalPending = 0;

    for (uint256 i = 0; i < positions.length; i++) {
        uint256 tokenId = positions[i];
        StakedPosition storage position = stakedPositions[tokenId];

        uint256 pending = _calculatePendingRewards(position);
        if (pending > 0) {
            totalPending += pending;
            position.rewardDebt =
                (position.usdValue *
                    position.boostMultiplier *
                    accRewardPerShare) /
                (PRECISION * PRECISION * BASE_MULTIPLIER);
        }
    }

    require(totalPending > 0, "No rewards available");
    _safeRewardTransfer(msg.sender, totalPending);

    emit RewardsClaimed(msg.sender, totalPending, positions);
}
```

**Explanation:**

**Difference from `claimRewards()`:**
- User doesn't specify token IDs
- Automatically claims from ALL staked positions

**Flow:**

- **Line 457:** Load all user's positions from storage
  - Gets array from `userPositions[msg.sender]` mapping

- **Line 458:** User must have at least 1 position

- **Line 460:** Update pool state

- **Lines 464-477:** Loop through ALL positions
  - Same logic as `claimRewards()`
  - Calculate pending, add to total, update debt

- **Lines 479-482:** Transfer rewards and emit event

**When to use which?**
- `claimRewards([123, 456])` - Claim from specific positions only
- `claimAllRewards()` - Claim from all positions at once (convenience)

---

## Emergency Unstake

### Lines 487-513: Emergency Withdrawal

```solidity
/**
 * @dev Emergency unstake (only when emergency withdraw enabled)
 */
function emergencyUnstake(uint256 tokenId) external nonReentrant {
    require(emergencyWithdrawEnabled, "Emergency not enabled");

    StakedPosition storage position = stakedPositions[tokenId];
    require(position.owner == msg.sender, "Not position owner");

    // ==================== EFFECTS: Update state first ====================

    // Update tracking (no rewards in emergency)
    totalStakedValue -= position.usdValue;
    userTotalValue[msg.sender] -= position.usdValue;
    _removeUserPosition(msg.sender, tokenId);

    // Delete position
    delete stakedPositions[tokenId];

    // ==================== INTERACTIONS: External call last ====================

    // Transfer NFT back
    IERC721(positionManager).safeTransferFrom(
        address(this),
        msg.sender,
        tokenId
    );
}
```

**Explanation:**

**Purpose:** Allow users to withdraw NFTs in emergency without claiming rewards

**Key Differences from Normal Unstake:**

1. ❌ **No lock check** - Can withdraw even if locked
2. ❌ **No reward calculation** - Rewards are forfeited
3. ❌ **No reward transfer** - User gets NFT but no MWG
4. ✅ **Only in emergency mode** - Admin must enable first

**Flow:**

- **Line 490:** Only works if admin enabled emergency mode
- **Line 492-493:** Verify ownership
- **Lines 497-502:** Update state (same as normal unstake)
  - Decrease staked values
  - Remove from user's position array
  - Delete position struct
- **Lines 506-511:** Return NFT to user
  - **No reward transfer!**

**When to use:**
- Critical bug discovered
- Oracle failure prevents reward calculation
- Need to migrate to new contract quickly
- User wants their NFT back immediately, willing to forfeit rewards

---

## Pool Update Function

### Lines 517-549: Update Pool State

```solidity
/**
 * @dev Update reward calculations
 */
function updatePool() public {
    if (block.timestamp <= lastRewardTimestamp || totalStakedValue == 0) {
        lastRewardTimestamp = block.timestamp;
        return;
    }

    uint256 endTime = block.timestamp > farmingEndTime
        ? farmingEndTime
        : block.timestamp;
    if (endTime <= lastRewardTimestamp) {
        return;
    }

    uint256 timeElapsed = endTime - lastRewardTimestamp;

    // Prevent overflow: check if calculation would overflow
    // rewardPerSecond is already "per USD staked", so we don't multiply by totalStakedValue
    // totalRewards = timeElapsed * rewardPerSecond (rewards per dollar)
    require(
        timeElapsed <= type(uint256).max / rewardPerSecond,
        "Time overflow"
    );
    uint256 rewardPerDollar = timeElapsed * rewardPerSecond;

    // accRewardPerShare tracks cumulative rewards per dollar staked
    accRewardPerShare += rewardPerDollar * PRECISION;
    lastRewardTimestamp = block.timestamp;

    // Update pool price info
    _updatePoolInfo();
}
```

**Explanation:**

**Purpose:** Calculate and accumulate rewards based on time elapsed

This is the heart of the reward calculation system!

#### Lines 520-523: Early Returns

```solidity
if (block.timestamp <= lastRewardTimestamp || totalStakedValue == 0) {
    lastRewardTimestamp = block.timestamp;
    return;
}
```

**Explanation:**

Two cases where we don't calculate rewards:

1. **Time hasn't advanced** (`block.timestamp <= lastRewardTimestamp`)
   - Multiple calls in same block
   - No time elapsed = no new rewards

2. **No stakes** (`totalStakedValue == 0`)
   - Nobody staked = nobody earns rewards
   - Prevents division by zero

Even in these cases, update `lastRewardTimestamp` to current time.

#### Lines 525-530: Determine End Time

```solidity
uint256 endTime = block.timestamp > farmingEndTime
    ? farmingEndTime
    : block.timestamp;
if (endTime <= lastRewardTimestamp) {
    return;
}
```

**Explanation:**

- **Lines 525-527:** Cap end time at farming end
  - If current time is after farming ended, use farmingEndTime
  - If current time is before farming ended, use current time
  - Example: Farming ends Dec 31, but it's Jan 5
    - Use Dec 31, not Jan 5
    - Rewards stopped accruing after Dec 31

- **Lines 528-530:** If end time already passed, nothing to do
  - Example: Farming ended Dec 31, last update was Jan 1
    - All rewards already calculated, nothing new to add

#### Lines 532-543: Calculate Rewards

```solidity
uint256 timeElapsed = endTime - lastRewardTimestamp;

// Prevent overflow: check if calculation would overflow
// rewardPerSecond is already "per USD staked", so we don't multiply by totalStakedValue
// totalRewards = timeElapsed * rewardPerSecond (rewards per dollar)
require(
    timeElapsed <= type(uint256).max / rewardPerSecond,
    "Time overflow"
);
uint256 rewardPerDollar = timeElapsed * rewardPerSecond;

// accRewardPerShare tracks cumulative rewards per dollar staked
accRewardPerShare += rewardPerDollar * PRECISION;
```

**Explanation:**

- **Line 532:** Calculate seconds elapsed
  - Example: Last update 1000, now 2000 → elapsed = 1000 seconds

- **Lines 537-540:** Overflow protection
  - Checks if `timeElapsed * rewardPerSecond` would overflow uint256
  - Extremely unlikely but good defensive programming

- **Line 541:** Calculate rewards per dollar
  - `rewardPerDollar = timeElapsed * rewardPerSecond`
  - Example:
    - Time elapsed: 1000 seconds
    - Reward rate: 0.01 MWG/second/dollar
    - Reward per dollar = 1000 * 0.01 = 10 MWG per dollar staked

- **Line 544:** Add to accumulated rewards
  - `accRewardPerShare += rewardPerDollar * PRECISION`
  - Multiply by PRECISION for fixed-point math
  - This is cumulative - always increasing!

**How accRewardPerShare works:**

```solidity
// Time 0: accRewardPerShare = 0
// Time 1000: accRewardPerShare = 0 + (1000 * 0.01e18 * 1e18) = 10e36
// Time 2000: accRewardPerShare = 10e36 + (1000 * 0.01e18 * 1e18) = 20e36
// Time 3000: accRewardPerShare = 20e36 + (1000 * 0.01e18 * 1e18) = 30e36

// Individual position with $1000 staked:
// Staked at time 1000 → rewardDebt = 1000 * 10e36 = 10,000e36
// At time 3000 → pending = (1000 * 30e36) - 10,000e36 = 20,000e36
// = Rewards for 2000 seconds (from time 1000 to 3000)
```

#### Lines 545-548: Finalize Update

```solidity
lastRewardTimestamp = block.timestamp;

// Update pool price info
_updatePoolInfo();
```

**Explanation:**

- **Line 545:** Record current time as last update
  - Next update will calculate from this point forward

- **Line 548:** Refresh pool price data
  - Calls internal function to fetch latest price from Uniswap pool
  - Updates `poolInfo` struct

---

## View Functions

View functions don't modify state - they just read and return data.

### Lines 553-558: Pending Rewards for Position

```solidity
/**
 * @dev Get pending rewards for a position
 */
function pendingRewards(uint256 tokenId) external view returns (uint256) {
    StakedPosition memory position = stakedPositions[tokenId];
    return _calculatePendingRewards(position);
}
```

**Explanation:**

**Purpose:** Check how many rewards a position has earned

- **Line 556:** Load position (using `memory` since view function)
- **Line 557:** Calculate pending rewards
  - Calls internal function with full calculation
  - Includes liquidity validation
  - Accounts for time since last pool update

**Usage:**
```javascript
// Check rewards for NFT #12345
const pending = await farmingPool.pendingRewards(12345);
console.log(`Pending rewards: ${ethers.utils.formatEther(pending)} MWG`);
```

### Lines 563-575: Pending Rewards for User

```solidity
/**
 * @dev Get all pending rewards for a user
 */
function pendingRewardsForUser(
    address user
) external view returns (uint256) {
    uint256[] memory positions = userPositions[user];
    uint256 totalPending = 0;

    for (uint256 i = 0; i < positions.length; i++) {
        StakedPosition memory position = stakedPositions[positions[i]];
        totalPending += _calculatePendingRewards(position);
    }

    return totalPending;
}
```

**Explanation:**

**Purpose:** Get total pending rewards across ALL user's positions

- **Line 568:** Load user's position array
- **Line 569:** Initialize accumulator
- **Lines 571-574:** Loop through all positions
  - Load each position
  - Calculate pending rewards
  - Add to total
- **Line 576:** Return sum

**Usage:**
```javascript
// Check total rewards for user
const pending = await farmingPool.pendingRewardsForUser(userAddress);
console.log(`Total pending: ${ethers.utils.formatEther(pending)} MWG`);
```

### Lines 580-585: Get User's Positions

```solidity
/**
 * @dev Get user's staked positions
 */
function getUserPositions(
    address user
) external view returns (uint256[] memory) {
    return userPositions[user];
}
```

**Explanation:**

**Purpose:** Get array of all token IDs staked by user

**Usage:**
```javascript
// Get all NFT IDs user has staked
const positions = await farmingPool.getUserPositions(userAddress);
console.log(`Staked NFTs: ${positions.join(', ')}`);
// Output: "Staked NFTs: 123, 456, 789"
```

### Lines 590-593: Available Rewards

```solidity
/**
 * @dev Get available rewards for distribution
 */
function getAvailableRewards() public view returns (uint256) {
    return totalRewardsDeposited - totalRewardsDistributed;
}
```

**Explanation:**

**Purpose:** Calculate how many MWG tokens remain for rewards

**Formula:**
```
Available = Total Deposited - Total Distributed
```

**Example:**
```
Admin deposited: 1,000,000 MWG
Users claimed:     300,000 MWG
Available:         700,000 MWG
```

**Used by:**
- `_safeRewardTransfer()` - Ensures doesn't send more than available
- `emergencyWithdrawRewards()` - Limits withdrawal amount
- Front-end - Shows remaining reward pool

### Lines 598-609: Calculate Current APR

```solidity
/**
 * @dev Calculate current APR
 */
function getCurrentAPR() external view returns (uint256) {
    if (totalStakedValue == 0) return 0;

    uint256 annualRewards = rewardPerSecond * 365 days * totalStakedValue;
    // Get MWG price in USD (assuming 1 MWG = $0.0003 for now)
    uint256 mwgPriceUsd = 3e14; // $0.0003 in wei
    uint256 annualRewardsUsd = (annualRewards * mwgPriceUsd) / 1e18;

    return (annualRewardsUsd * 10000) / totalStakedValue; // Return as basis points (1% = 100)
}
```

**Explanation:**

**Purpose:** Calculate Annual Percentage Rate (APR) for staking

**Flow:**

- **Line 600:** If no stakes, APR is 0

- **Line 602:** Calculate annual rewards in MWG
  - `rewardPerSecond * 365 days * totalStakedValue`
  - Example:
    - Rate: 0.01 MWG/sec/dollar
    - Total staked: $1,000,000
    - Annual: 0.01 * 31,536,000 * 1,000,000 = 315,360,000,000 MWG

- **Line 604:** MWG price hardcoded to $0.0003
  - In production, should fetch from oracle
  - `3e14 = 0.0003 * 1e18`

- **Line 605:** Convert MWG rewards to USD
  - `annualRewards * mwgPriceUsd / 1e18`
  - Example: 315B MWG * 0.0003 = $94.6M USD

- **Line 607:** Calculate APR in basis points
  - `(annualRewardsUsd * 10000) / totalStakedValue`
  - Multiply by 10000 to get basis points
  - 1% = 100 basis points, 10% = 1000, 100% = 10000
  - Example: $94.6M / $1M * 10000 = 946,000 basis points = 9460%

**Basis Points Conversion:**
```javascript
// In JavaScript:
const aprBasisPoints = await farmingPool.getCurrentAPR();
const aprPercent = aprBasisPoints / 100;
console.log(`APR: ${aprPercent}%`);
```

### Lines 614-617: Get Boost Multiplier

```solidity
/**
 * @dev Get boost multiplier for lock days
 */
function getBoostMultiplier(
    uint256 lockDays
) external pure returns (uint256) {
    return _calculateBoostMultiplier(lockDays);
}
```

**Explanation:**

**Purpose:** Check boost multiplier for a given lock period without staking

- **Line 616:** `pure` - Doesn't read state, just calculates
- **Line 617:** Calls internal function (we'll see this in Part 3)

**Usage:**
```javascript
// Check boost for 90-day lock
const boost = await farmingPool.getBoostMultiplier(90);
console.log(`90-day boost: ${boost / 1000}x`); // Output: "90-day boost: 1.25x"
```

### Lines 622-643: Get Farming Stats

```solidity
/**
 * @dev Get farming stats
 */
function getFarmingStats()
    external
    view
    returns (
        uint256 totalStaked,
        uint256 totalRewards,
        uint256 availableRewards,
        uint256 currentAPR,
        uint256 participantCount,
        bool isActive
    )
{
    totalStaked = totalStakedValue;
    totalRewards = totalRewardsDistributed;
    availableRewards = getAvailableRewards();
    currentAPR = this.getCurrentAPR();
    participantCount = 0; // Would need additional tracking to implement
    isActive =
        block.timestamp >= farmingStartTime &&
        block.timestamp < farmingEndTime &&
        !paused();
}
```

**Explanation:**

**Purpose:** Get comprehensive overview of farming pool state

**Returns:**

- **totalStaked** - Total USD value currently staked
- **totalRewards** - Total MWG distributed so far
- **availableRewards** - MWG remaining for distribution
- **currentAPR** - Current APR in basis points
- **participantCount** - Number of unique stakers (not implemented - returns 0)
- **isActive** - Whether farming is currently active

**isActive Logic:**

```solidity
isActive = 
    block.timestamp >= farmingStartTime  // Farming has started
    && block.timestamp < farmingEndTime  // Farming hasn't ended
    && !paused();                        // Not paused
```

**Usage:**
```javascript
const stats = await farmingPool.getFarmingStats();
console.log(`
  Total Staked: $${stats.totalStaked.toString()}
  Total Rewards: ${ethers.utils.formatEther(stats.totalRewards)} MWG
  Available: ${ethers.utils.formatEther(stats.availableRewards)} MWG
  APR: ${stats.currentAPR / 100}%
  Active: ${stats.isActive}
`);
```

---

## Summary of Part 2

We've covered:
- ✅ Complete unstake function with CEI pattern
- ✅ Claim rewards functions (specific positions and all positions)
- ✅ Emergency unstake functionality
- ✅ Core pool update mechanism (reward accumulation)
- ✅ All view functions for querying state

**Key Concepts Learned:**
1. **Checks-Effects-Interactions (CEI)** - Update state before external calls
2. **Reward Debt** - Prevents double-counting of rewards
3. **accRewardPerShare** - Cumulative rewards per dollar, always increasing
4. **Emergency Mode** - Users can exit without rewards in crisis
5. **Batch Operations** - Gas-limited to prevent DoS

**Next in Part 3:**
- Internal helper functions
- Security features (liquidity validation, TWAP oracle)
- Position value calculation with Uniswap V3 math
- Chainlink price feeds
- Boost multiplier calculation
- ERC721 receiver implementation

---

**Continue to Part 3 → [FARMING_CONTRACT_EXPLAINED_PART3.md](./FARMING_CONTRACT_EXPLAINED_PART3.md)**
