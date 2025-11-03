# MWGFarmingPool Contract - Complete Line-by-Line Explanation (Part 1)

**Contract Version:** Post-Security Fixes  
**Date:** November 3, 2025  
**Part:** 1 of 2 (Lines 1-550)

---

## Table of Contents - Part 1

1. [Contract Overview](#contract-overview)
2. [Imports & Dependencies](#imports--dependencies)
3. [Contract Declaration & Inheritance](#contract-declaration--inheritance)
4. [Constants & Roles](#constants--roles)
5. [Immutable Variables](#immutable-variables)
6. [State Variables](#state-variables)
7. [Data Structures](#data-structures)
8. [Mappings](#mappings)
9. [Events](#events)
10. [Constructor](#constructor)
11. [Admin Functions](#admin-functions)
12. [User Staking Functions](#user-staking-functions)

---

## Contract Overview

**Purpose:** The MWGFarmingPool contract allows users to stake their Uniswap V3 (PancakeSwap V3) NFT positions representing MWG/BNB liquidity pairs and earn MWG token rewards proportional to their staked value.

**Key Concepts:**
- **Liquidity Farming:** Users earn rewards based on the USD value of their staked positions
- **Lock Periods:** Longer locks = higher reward multipliers (up to 2x)
- **Security Features:** TWAP oracle, liquidity validation, reentrancy protection
- **NFT Custody:** Contract holds the V3 position NFTs while staked

---

## Imports & Dependencies

### Lines 1-13: Import Statements

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./interfaces/IPancakeSwapV3.sol";
import "./libraries/LiquidityAmounts.sol";
import "./libraries/TickMath.sol";
```

**Explanation:**

- **Line 1:** MIT license - open source, permissive
- **Line 2:** Solidity version ^0.8.19 (0.8.19 or higher, below 0.9.0)
- **Line 4:** `ReentrancyGuard` - Prevents reentrancy attacks where external calls could re-enter the contract
- **Line 5:** `AccessControl` - Role-based permission system (admin, reward manager, pause roles)
- **Line 6:** `IERC721Receiver` - Required to receive NFT tokens (Uniswap V3 positions are ERC721)
- **Line 7:** `IERC721` - Interface for interacting with NFT contracts
- **Line 8:** `IERC20` - Interface for ERC20 tokens (MWG rewards)
- **Line 9:** `SafeERC20` - Safe wrappers for token transfers (prevents issues with non-standard tokens)
- **Line 10:** `Pausable` - Emergency pause functionality
- **Line 11:** Custom PancakeSwap V3 interfaces (position manager, pool, factory)
- **Line 12-13:** Uniswap V3 math libraries for calculating liquidity amounts and tick conversions

---

## Contract Declaration & Inheritance

### Lines 15-30: Contract Declaration

```solidity
/**
 * @title MWGFarmingPool
 * @dev Liquidity farming contract for MWG/BNB PancakeSwap V3 positions
 *
 * Features:
 * - Stake PancakeSwap V3 NFT positions
 * - Earn MWG rewards based on liquidity provided
 * - Lock periods for bonus rewards (up to 2x multiplier)
 * - Emergency controls and admin functions
 * - Position value calculation using Chainlink price feeds
 */
contract MWGFarmingPool is
    AccessControl,
    ReentrancyGuard,
    Pausable,
    IERC721Receiver
{
    using SafeERC20 for IERC20;
```

**Explanation:**

- **Lines 15-25:** NatSpec documentation explaining contract purpose
- **Line 26:** Contract name: `MWGFarmingPool`
- **Lines 27-31:** Multiple inheritance:
  - `AccessControl` - Role-based permissions
  - `ReentrancyGuard` - Protection against reentrancy attacks
  - `Pausable` - Can be paused in emergencies
  - `IERC721Receiver` - Can receive NFT tokens
- **Line 32:** Using `SafeERC20` library for all `IERC20` token operations

---

## Constants & Roles

### Lines 34-43: Role Definitions

```solidity
// ==================== CONSTANTS & ROLES ====================

bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
bytes32 public constant REWARD_MANAGER_ROLE =
    keccak256("REWARD_MANAGER_ROLE");
bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
```

**Explanation:**

- **Line 37:** `ADMIN_ROLE` - Can set reward rates, extend farming, enable emergency mode
- **Lines 38-39:** `REWARD_MANAGER_ROLE` - Can deposit rewards into the contract
- **Line 40:** `PAUSE_ROLE` - Can pause/unpause the contract in emergencies

**How roles work:**
- Roles are represented as `bytes32` hashes
- Multiple addresses can have the same role
- `DEFAULT_ADMIN_ROLE` (inherited) can grant/revoke all other roles

### Lines 42-46: Mathematical Constants

```solidity
uint256 private constant PRECISION = 1e18;
uint256 private constant BASE_MULTIPLIER = 1000;
uint256 private constant MAX_LOCK_DAYS = 365;
uint256 private constant MAX_BATCH_SIZE = 50; // Prevent DoS attacks
uint32 private constant TWAP_PERIOD = 1800; // 30 minutes TWAP for price manipulation resistance
```

**Explanation:**

- **Line 42:** `PRECISION = 1e18` (1,000,000,000,000,000,000)
  - Used for fixed-point arithmetic
  - 18 decimals match Ethereum token standard
  - Example: To represent 1.5, store as `1.5 * 1e18 = 1500000000000000000`

- **Line 43:** `BASE_MULTIPLIER = 1000`
  - Base reward multiplier (1000 = 1x, 2000 = 2x)
  - Allows fractional multipliers (1100 = 1.1x, 1250 = 1.25x)

- **Line 44:** `MAX_LOCK_DAYS = 365`
  - Maximum lock period is 1 year
  - Prevents users from locking forever

- **Line 45:** `MAX_BATCH_SIZE = 50`
  - Maximum positions to process in one transaction
  - Prevents gas limit DoS attacks

- **Line 46:** `TWAP_PERIOD = 1800` (30 minutes in seconds)
  - Time-Weighted Average Price window
  - Prevents flash loan price manipulation
  - 30 minutes is long enough that manipulation becomes expensive

---

## Immutable Variables

### Lines 48-56: Immutable Contract Addresses

```solidity
address public immutable positionManager;
address public immutable factory;
address public immutable mwgToken;
address public immutable wbnb;
address public immutable targetPool;

// Price feeds for USD value calculation
address public immutable bnbUsdFeed; // Chainlink BNB/USD feed
```

**Explanation:**

**Why immutable?**
- Set once in constructor, never change
- Gas savings (stored in bytecode, not storage)
- Security (cannot be modified by admin)

**Variables:**

- **Line 48:** `positionManager` - Uniswap V3 NonfungiblePositionManager address
  - Manages NFT positions (mint, burn, increase/decrease liquidity)
  
- **Line 49:** `factory` - Uniswap V3 Factory address
  - Used to verify pool addresses are legitimate

- **Line 50:** `mwgToken` - MWG ERC20 token address
  - The reward token users earn

- **Line 51:** `wbnb` - Wrapped BNB address
  - Used to identify BNB side of MWG/BNB pair

- **Line 52:** `targetPool` - Specific MWG/BNB V3 pool address
  - Only positions from THIS pool are accepted
  - Prevents users from staking wrong pools

- **Line 55:** `bnbUsdFeed` - Chainlink BNB/USD price feed
  - Converts BNB values to USD for consistent reward calculations
  - Example: If BNB = $300, and you stake 10 BNB worth, you earn rewards based on $3000

---

## State Variables

### Lines 60-71: Farming Configuration

```solidity
// ==================== STATE VARIABLES ====================

// Farming configuration
uint256 public rewardPerSecond; // MWG tokens per second per USD staked
uint256 public totalStakedValue; // Total USD value staked
uint256 public lastRewardTimestamp;
uint256 public farmingStartTime;
uint256 public farmingEndTime;

// Reward tracking
uint256 public accRewardPerShare; // Accumulated rewards per share
uint256 public totalRewardsDeposited;
uint256 public totalRewardsDistributed;

// Emergency controls
bool public emergencyWithdrawEnabled;
```

**Explanation:**

**Farming Configuration:**

- **Line 63:** `rewardPerSecond` - How many MWG tokens per second per dollar staked
  - Example: If set to `0.01 * 1e18`, each $1 staked earns 0.01 MWG per second
  - Adjustable by admin to control reward rate

- **Line 64:** `totalStakedValue` - Sum of all staked positions' USD value
  - Used to calculate global reward distribution
  - Increases when users stake, decreases when they unstake

- **Line 65:** `lastRewardTimestamp` - Last time rewards were calculated
  - Updated by `updatePool()` function
  - Used to calculate time elapsed for reward accrual

- **Line 66:** `farmingStartTime` - When farming begins
  - Set in constructor
  - Users can't stake before this time

- **Line 67:** `farmingEndTime` - When farming ends
  - Set in constructor + farming duration
  - Can be extended by admin
  - Rewards stop accruing after this time

**Reward Tracking:**

- **Line 70:** `accRewardPerShare` - Cumulative rewards per dollar staked
  - Increases over time as rewards accrue
  - Used to calculate individual position rewards
  - Formula: `accRewardPerShare += (timeElapsed * rewardPerSecond * PRECISION)`

- **Line 71:** `totalRewardsDeposited` - Total MWG tokens deposited for rewards
  - Increased by `depositRewards()`
  - Decreased by `emergencyWithdrawRewards()` (security fix)

- **Line 72:** `totalRewardsDistributed` - Total MWG claimed by users
  - Increased when users claim rewards
  - `availableRewards = totalRewardsDeposited - totalRewardsDistributed`

**Emergency Controls:**

- **Line 75:** `emergencyWithdrawEnabled` - Emergency mode flag
  - Default: `false`
  - Once enabled by admin, cannot be disabled (one-way switch)
  - Allows users to withdraw NFTs without claiming rewards
  - Admin can withdraw remaining rewards

---

## Data Structures

### Lines 79-92: StakedPosition Struct

```solidity
// ==================== STRUCTS ====================

struct StakedPosition {
    uint256 tokenId; // V3 NFT token ID
    uint128 liquidity; // Position liquidity
    uint256 usdValue; // USD value when staked
    uint256 rewardDebt; // Rewards already accounted for
    uint256 stakedAt; // Timestamp when staked
    uint256 lockUntil; // Lock expiry timestamp (0 if no lock)
    uint256 boostMultiplier; // Reward multiplier (1000 = 1x)
    address owner; // Position owner
    int24 tickLower; // Position tick range
    int24 tickUpper;
}
```

**Explanation:**

This struct stores all information about a staked position:

- **Line 82:** `tokenId` - The NFT token ID (unique identifier)
  - Example: `12345` refers to NFT #12345

- **Line 83:** `liquidity` - The amount of liquidity in the position
  - Type: `uint128` (Uniswap V3 standard)
  - This is the "L" value in Uniswap V3 math
  - Stored to detect if user removes liquidity (security fix)

- **Line 84:** `usdValue` - Position value in USD when staked
  - Locked at staking time (doesn't change with price)
  - Example: If you stake when BNB = $300, and your position has 10 BNB worth of liquidity, `usdValue = $3000`
  - Used to calculate reward share

- **Line 85:** `rewardDebt` - Rewards already accounted for
  - Used in reward calculation to avoid double-counting
  - Formula: `pendingRewards = (usdValue * accRewardPerShare) - rewardDebt`
  - Updated when rewards are claimed

- **Line 86:** `stakedAt` - Unix timestamp when position was staked
  - Used for tracking, analytics

- **Line 87:** `lockUntil` - Unix timestamp when lock expires
  - `0` means no lock (can unstake anytime)
  - Example: If you lock for 30 days on Nov 1, `lockUntil = Nov 1 + 30 days`

- **Line 88:** `boostMultiplier` - Reward boost from locking
  - Range: 1000 (1x) to 2000 (2x)
  - Example: 1500 = 1.5x rewards
  - Longer locks = higher multiplier

- **Line 89:** `owner` - Address that staked this position
  - Only owner can unstake and claim rewards
  - Verified in all user functions

- **Lines 90-91:** `tickLower`, `tickUpper` - Price range of position
  - Uniswap V3 positions have specific price ranges
  - Type: `int24` (can be negative)
  - Used to calculate token amounts from liquidity

### Lines 94-98: PoolInfo Struct

```solidity
struct PoolInfo {
    uint160 sqrtPriceX96; // Current pool price
    int24 currentTick; // Current pool tick
    uint256 lastUpdated; // Last price update
}
```

**Explanation:**

Tracks current pool state:

- **Line 95:** `sqrtPriceX96` - Square root of price in Q96 format
  - Uniswap V3 stores prices as sqrt(price) * 2^96
  - Type: `uint160` (Uniswap standard)
  - Example: If price is 100, sqrtPriceX96 ≈ 10 * 2^96

- **Line 96:** `currentTick` - Current tick of the pool
  - Ticks represent discrete price points
  - Type: `int24` (can be negative)
  - Price = 1.0001^tick

- **Line 97:** `lastUpdated` - Timestamp of last price fetch
  - Used for monitoring/debugging
  - Updated even if price fetch fails

---

## Mappings

### Lines 102-106: Storage Mappings

```solidity
// ==================== MAPPINGS ====================

mapping(uint256 => StakedPosition) public stakedPositions;
mapping(address => uint256[]) public userPositions;
mapping(address => uint256) public userTotalValue; // Total USD value per user
mapping(address => uint256) public userRewardsClaimed; // Total rewards claimed per user

PoolInfo public poolInfo;
```
**Explanation:**

- **Line 103:** `stakedPositions` - Token ID → Position data
  - Key: NFT token ID (uint256)
  - Value: `StakedPosition` struct
  - Example: `stakedPositions[12345]` returns all data for NFT #12345
  - If `owner == address(0)`, position is not staked

- **Line 104:** `userPositions` - User address → Array of token IDs
  - Key: User address
  - Value: Array of all token IDs they've staked
  - Example: `userPositions[alice]` might return `[123, 456, 789]`
  - Used to iterate over user's positions

- **Line 105:** `userTotalValue` - User address → Total USD value staked
  - Cumulative USD value of all their staked positions
  - Example: If Alice stakes 3 positions worth $1000, $2000, $500, her total is $3500

- **Line 106:** `userRewardsClaimed` - User address → Total rewards claimed
  - Lifetime total of MWG claimed by this user
  - Used for analytics, tracking

- **Line 108:** `poolInfo` - Single instance of PoolInfo struct
  - Not a mapping, just one global instance
  - Stores current pool price data

---

## Events

### Lines 112-142: Event Definitions

```solidity
// ==================== EVENTS ====================

event PositionStaked(
    address indexed user,
    uint256 indexed tokenId,
    uint256 usdValue,
    uint256 lockDays,
    uint256 boostMultiplier
);

event PositionUnstaked(
    address indexed user,
    uint256 indexed tokenId,
    uint256 rewards
);

event RewardsClaimed(
    address indexed user,
    uint256 amount,
    uint256[] tokenIds
);

event RewardRateUpdated(uint256 newRate);
event RewardsDeposited(uint256 amount);
event FarmingPeriodExtended(uint256 newEndTime);
event EmergencyWithdrawEnabled();
event PoolPriceUpdateFailed(uint256 timestamp);
event PositionValueCalculationFailed(
    uint256 indexed tokenId,
    uint256 fallbackValue
);
```

**Explanation:**

Events are emitted for off-chain monitoring and indexing:

- **Lines 114-120:** `PositionStaked` - Emitted when user stakes
  - `indexed` parameters can be filtered in event logs
  - Records: who staked, which NFT, value, lock period, multiplier

- **Lines 122-126:** `PositionUnstaked` - Emitted when user unstakes
  - Records: who unstaked, which NFT, rewards earned

- **Lines 128-132:** `RewardsClaimed` - Emitted when rewards claimed
  - Records: who claimed, amount, which positions
  - `tokenIds` array shows all positions claimed from

- **Line 134:** `RewardRateUpdated` - Admin changed reward rate
- **Line 135:** `RewardsDeposited` - Rewards added to pool
- **Line 136:** `FarmingPeriodExtended` - Admin extended farming period
- **Line 137:** `EmergencyWithdrawEnabled` - Emergency mode activated
- **Line 138:** `PoolPriceUpdateFailed` - Price fetch failed (monitoring)
- **Lines 139-142:** `PositionValueCalculationFailed` - Valuation error (monitoring)

---

## Constructor

### Lines 146-192: Contract Initialization

```solidity
// ==================== CONSTRUCTOR ====================

constructor(
    address _positionManager,
    address _factory,
    address _mwgToken,
    address _wbnb,
    address _targetPool,
    address _bnbUsdFeed,
    uint256 _initialRewardPerSecond,
    uint256 _farmingDuration
) {
```

**Parameters:**
- `_positionManager` - Uniswap V3 NonfungiblePositionManager address
- `_factory` - Uniswap V3 Factory address
- `_mwgToken` - MWG token address
- `_wbnb` - Wrapped BNB address
- `_targetPool` - MWG/BNB pool address
- `_bnbUsdFeed` - Chainlink BNB/USD feed
- `_initialRewardPerSecond` - Starting reward rate
- `_farmingDuration` - How long farming lasts (in seconds)

### Lines 157-171: Input Validation

```solidity
    require(_positionManager != address(0), "Invalid position manager");
    require(_factory != address(0), "Invalid factory");
    require(_mwgToken != address(0), "Invalid MWG token");
    require(_wbnb != address(0), "Invalid WBNB");
    require(_targetPool != address(0), "Invalid target pool");
    require(_bnbUsdFeed != address(0), "Invalid price feed");
    require(_farmingDuration > 0, "Invalid farming duration");
    require(_farmingDuration <= 5 * 365 days, "Farming duration too long");
    require(
        _initialRewardPerSecond <= PRECISION,
        "Initial reward rate too high"
    );
```

**Explanation:**

Each `require` validates input:

- **Lines 157-162:** Check all addresses are not zero address
  - Prevents deployment with missing addresses
  - Zero address would break contract

- **Line 163:** Duration must be positive
- **Line 164:** Duration max 5 years
  - Prevents admin from setting 100-year farming periods
  
- **Lines 165-168:** Reward rate max 1 MWG per second per dollar
  - Prevents typos (admin accidentally sets rate too high)
  - Example: At 1 MWG/sec/dollar, $1M staked = 1M MWG per second = wildly high

### Lines 170-186: State Initialization

```solidity
    positionManager = _positionManager;
    factory = _factory;
    mwgToken = _mwgToken;
    wbnb = _wbnb;
    targetPool = _targetPool;
    bnbUsdFeed = _bnbUsdFeed;

    rewardPerSecond = _initialRewardPerSecond;
    farmingStartTime = block.timestamp;
    farmingEndTime = block.timestamp + _farmingDuration;
    lastRewardTimestamp = block.timestamp;

    // Setup roles
    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(ADMIN_ROLE, msg.sender);
    _grantRole(REWARD_MANAGER_ROLE, msg.sender);
    _grantRole(PAUSE_ROLE, msg.sender);

    // Initialize pool info
    _updatePoolInfo();
}
```

**Explanation:**

- **Lines 170-175:** Set immutable addresses
- **Line 177:** Set initial reward rate
- **Line 178:** Farming starts NOW
- **Line 179:** Farming ends NOW + duration
- **Line 180:** Last reward calculation = NOW

- **Lines 183-186:** Grant all roles to deployer
  - Deployer becomes admin, can deposit rewards, pause contract
  - Later, deployer can grant roles to other addresses
  - Deployer can revoke their own roles if desired

- **Line 189:** Fetch current pool price
  - Initializes `poolInfo` struct
  - Ensures price data is available

---

## Admin Functions

### Lines 196-205: Deposit Rewards

```solidity
/**
 * @dev Deposit MWG tokens for farming rewards
 */
function depositRewards(
    uint256 amount
) external onlyRole(REWARD_MANAGER_ROLE) {
    require(amount > 0, "Amount must be > 0");

    IERC20(mwgToken).safeTransferFrom(msg.sender, address(this), amount);
    totalRewardsDeposited += amount;

    emit RewardsDeposited(amount);
}
```

**Explanation:**

**Purpose:** Add MWG tokens to the reward pool

**Flow:**
1. **Line 197:** Only `REWARD_MANAGER_ROLE` can call
2. **Line 201:** Validate amount > 0
3. **Line 203:** Transfer MWG from caller to contract
   - Uses `safeTransferFrom` for safety
   - Caller must have approved contract to spend their MWG
4. **Line 204:** Increase total deposited counter
5. **Line 206:** Emit event for tracking

**Example:**
```solidity
// Admin wants to add 1,000,000 MWG for rewards
// First approve: mwgToken.approve(farmingPool, 1000000e18)
// Then deposit: farmingPool.depositRewards(1000000e18)
```

### Lines 210-222: Set Reward Rate

```solidity
/**
 * @dev Set new reward rate (rewards per second per USD staked)
 */
function setRewardRate(
    uint256 _rewardPerSecond
) external onlyRole(ADMIN_ROLE) {
    // Validate reasonable reward rate (prevent admin mistakes)
    // Max: 1 MWG per second per dollar (very generous)
    require(_rewardPerSecond <= 1e18, "Reward rate too high");

    updatePool();
    rewardPerSecond = _rewardPerSecond;
    emit RewardRateUpdated(_rewardPerSecond);
}
```

**Explanation:**

**Purpose:** Adjust reward distribution rate

**Flow:**
1. **Line 213:** Only `ADMIN_ROLE` can call
2. **Line 217:** Validate rate ≤ 1e18 (1 MWG per second per dollar)
3. **Line 219:** `updatePool()` - Calculate rewards with OLD rate first
   - Critical: Must update before changing rate
   - Ensures users get correct rewards for time before change
4. **Line 220:** Set new rate
5. **Line 221:** Emit event

**Example:**
```solidity
// Current rate: 0.01 MWG per second per dollar
// Want to double it to 0.02
farmingPool.setRewardRate(0.02e18);

// Now users earn 2x more rewards per second
```

**Why update first?**
- Ensures fairness: rewards from 0-T calculated at old rate, T+ at new rate
- Without this, past rewards would be calculated at new rate (unfair)

### Lines 226-240: Extend Farming Period

```solidity
/**
 * @dev Extend farming period
 */
function extendFarming(
    uint256 additionalSeconds
) external onlyRole(ADMIN_ROLE) {
    require(additionalSeconds > 0, "Invalid extension");
    // Prevent extending too far into future (max 5 years from now)
    require(
        farmingEndTime + additionalSeconds <=
            block.timestamp + 5 * 365 days,
        "Extension too long"
    );
    farmingEndTime += additionalSeconds;
    emit FarmingPeriodExtended(farmingEndTime);
}
```

**Explanation:**

**Purpose:** Extend farming beyond original end time

**Flow:**
1. **Line 231:** Only admin
2. **Line 232:** Must extend by positive amount
3. **Lines 234-237:** New end time can't be > 5 years from now
   - Prevents admin from extending to year 3000
4. **Line 238:** Add time to end time
5. **Line 239:** Emit event

**Example:**
```solidity
// Original end: Dec 31, 2025
// Want to extend 90 days
farmingPool.extendFarming(90 days);
// New end: March 31, 2026
```

### Lines 244-248: Enable Emergency Withdraw

```solidity
/**
 * @dev Enable emergency withdraw (irreversible)
 */
function enableEmergencyWithdraw() external onlyRole(ADMIN_ROLE) {
    emergencyWithdrawEnabled = true;
    emit EmergencyWithdrawEnabled();
}
```

**Explanation:**

**Purpose:** Activate emergency mode (one-way switch)

**When to use:**
- Critical bug discovered
- Oracle failure
- Need to migrate to new contract

**Effects:**
- Users can `emergencyUnstake()` without claiming rewards
- Admin can withdraw remaining rewards
- Cannot be reversed!

### Lines 252-262: Emergency Withdraw Rewards

```solidity
/**
 * @dev Emergency withdraw remaining rewards
 * SECURITY FIX: Updates accounting to prevent broken state
 */
function emergencyWithdrawRewards(
    uint256 amount
) external onlyRole(ADMIN_ROLE) {
    require(emergencyWithdrawEnabled, "Emergency withdraw not enabled");
    require(amount <= getAvailableRewards(), "Insufficient rewards");

    // SECURITY FIX: Update accounting before transfer
    totalRewardsDeposited -= amount;
    IERC20(mwgToken).safeTransfer(msg.sender, amount);
}
```

**Explanation:**

**Purpose:** Admin withdraws remaining MWG in emergency

**Flow:**
1. **Line 259:** Only admin
2. **Line 260:** Emergency mode must be enabled
3. **Line 261:** Can't withdraw more than available
4. **Line 264:** **SECURITY FIX** - Decrease totalRewardsDeposited
   - This was the bug we fixed!
   - Without this, `getAvailableRewards()` would return wrong value
5. **Line 265:** Transfer MWG to admin

**Why the security fix matters:**
```solidity
// OLD CODE (BUGGY):
IERC20(mwgToken).safeTransfer(msg.sender, amount);
// totalRewardsDeposited NOT updated!

// Result: getAvailableRewards() returns inflated value
// Users try to claim more than exists, transactions revert

// NEW CODE (FIXED):
totalRewardsDeposited -= amount; // Update accounting
IERC20(mwgToken).safeTransfer(msg.sender, amount);
// Now getAvailableRewards() returns correct value!
```

### Lines 266-274: Pause/Unpause

```solidity
/**
 * @dev Pause/unpause contract
 */
function setPaused(bool _paused) external onlyRole(PAUSE_ROLE) {
    if (_paused) {
        _pause();
    } else {
        _unpause();
    }
}
```

**Explanation:**

**Purpose:** Emergency pause functionality

**Flow:**
1. **Line 269:** Only `PAUSE_ROLE` can call
2. **Lines 270-274:** If true, pause; if false, unpause

**When paused:**
- `stakePosition()` blocked (has `whenNotPaused` modifier)
- `claimRewards()` blocked
- `claimAllRewards()` blocked
- `unstakePosition()` still works (users can exit)

---

## User Staking Functions

### Lines 278-369: Stake Position Function

This is the most complex function - let's break it down section by section.

#### Lines 278-285: Function Declaration & Initial Checks

```solidity
/**
 * @dev Stake a PancakeSwap V3 NFT position
 * @param tokenId The NFT token ID to stake
 * @param lockDays Number of days to lock (0-365, affects reward multiplier)
 */
function stakePosition(
    uint256 tokenId,
    uint256 lockDays
) external nonReentrant whenNotPaused {
    require(block.timestamp >= farmingStartTime, "Farming not started");
    require(block.timestamp < farmingEndTime, "Farming ended");
    require(lockDays <= MAX_LOCK_DAYS, "Lock period too long");
```

**Explanation:**

- **Line 283:** `external` - Can only be called from outside contract
- **Line 283:** `nonReentrant` - Prevents reentrancy attacks
  - If staking calls external contract, that contract can't call back into stake
- **Line 283:** `whenNotPaused` - Blocked if contract is paused
- **Line 284:** Check farming has started
- **Line 285:** Check farming hasn't ended
- **Line 286:** Lock days can't exceed 365

#### Lines 288-296: Ownership & Position Data Validation

```solidity
    // Prevent double-staking
    require(
        stakedPositions[tokenId].owner == address(0),
        "Position already staked"
    );

    // Verify ownership
    // aderyn-fp-next-line(reentrancy-state-change)
    require(
        IERC721(positionManager).ownerOf(tokenId) == msg.sender,
        "Not owner"
    );
```

**Explanation:**

- **Lines 289-292:** Check position not already staked
  - If `owner == address(0)`, position is free
  - If `owner != address(0)`, already staked by someone

- **Lines 295-298:** Verify caller owns the NFT
  - Calls `ownerOf()` on position manager
  - Only owner can stake their own NFT

#### Lines 300-315: Fetch Position Data

```solidity
    // Get position details
    // aderyn-fp-next-line(reentrancy-state-change)
    (
        ,
        ,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        ,
        ,
        ,

    ) = INonfungiblePositionManager(positionManager).positions(tokenId);
```

**Explanation:**

Calls `positions(tokenId)` on Uniswap V3 Position Manager, which returns 12 values:
1. `nonce` (ignored with `,`)
2. `operator` (ignored)
3. **`token0`** - First token in pair
4. **`token1`** - Second token in pair
5. **`fee`** - Fee tier (500, 3000, 10000)
6. **`tickLower`** - Lower price bound
7. **`tickUpper`** - Upper price bound
8. **`liquidity`** - Amount of liquidity
9. `feeGrowthInside0LastX128` (ignored)
10. `feeGrowthInside1LastX128` (ignored)
11. `tokensOwed0` (ignored)
12. `tokensOwed1` (ignored)

We only need token addresses, fee tier, tick range, and liquidity.

#### Lines 317-319: Pool & Liquidity Validation

```solidity
    // Verify this is the target MWG/BNB pool
    require(_isTargetPool(token0, token1, fee), "Invalid pool");
    require(liquidity > 0, "No liquidity");
```

**Explanation:**

- **Line 318:** Verify position is from correct pool
  - Calls `_isTargetPool()` helper function
  - Prevents staking positions from wrong pools (e.g., ETH/USDC)
  
- **Line 319:** Verify position has liquidity
  - Empty positions not allowed

#### Lines 321-329: Calculate Position Value

```solidity
    // Calculate position USD value
    uint256 usdValue = _calculatePositionValue(
        token0,
        token1,
        tickLower,
        tickUpper,
        liquidity
    );
    require(usdValue > 0, "Position has no value");
```

**Explanation:**

- **Lines 322-328:** Calculate position's value in USD
  - Calls internal function `_calculatePositionValue()`
  - Takes token amounts, converts to BNB, converts to USD
  - Uses Chainlink oracle for BNB/USD price
  - Uses TWAP for MWG/BNB price (security fix)

- **Line 329:** Ensure position has value

#### Lines 331-337: Calculate Boost & Lock

```solidity
    // Calculate boost multiplier based on lock period
    uint256 boostMultiplier = _calculateBoostMultiplier(lockDays);
    uint256 lockUntil = lockDays > 0
        ? block.timestamp + (lockDays * 1 days)
        : 0;

    // Update pool before staking
    updatePool();
```

**Explanation:**

- **Line 332:** Calculate reward boost from lock period
  - 0 days = 1x (1000)
  - 7 days = 1.05x (1050)
  - 30 days = 1.1x (1100)
  - 90 days = 1.25x (1250)
  - 180 days = 1.5x (1500)
  - 365 days = 2x (2000)

- **Lines 333-335:** Calculate lock expiry timestamp
  - If lockDays > 0: current time + lock days
  - If lockDays = 0: no lock (0)

- **Line 338:** Update global pool state
  - Calculate accumulated rewards before adding new stake
  - Critical for correct reward calculations

#### Lines 339-351: Create Staked Position

```solidity
    // Create staked position first
    stakedPositions[tokenId] = StakedPosition({
        tokenId: tokenId,
        liquidity: liquidity,
        usdValue: usdValue,
        rewardDebt: (usdValue * boostMultiplier * accRewardPerShare) /
            (PRECISION * PRECISION * BASE_MULTIPLIER),
        stakedAt: block.timestamp,
        lockUntil: lockUntil,
        boostMultiplier: boostMultiplier,
        owner: msg.sender,
        tickLower: tickLower,
        tickUpper: tickUpper
    });
```

**Explanation:**

Creates new `StakedPosition` struct in storage:

- **Line 341:** Store token ID
- **Line 342:** Store original liquidity (for detection of removal)
- **Line 343:** Store USD value (locked at stake time)
- **Lines 344-345:** Calculate initial reward debt
  - Formula: `(value * boost * accRewardPerShare) / (PRECISION * PRECISION * BASE_MULTIPLIER)`
  - Ensures user doesn't get rewards for time before they staked
  - Divided by PRECISION twice because both boost and accRewardPerShare use PRECISION
- **Line 346:** Record stake timestamp
- **Line 347:** Record lock expiry
- **Line 348:** Store boost multiplier
- **Line 349:** Record owner
- **Lines 350-351:** Store tick range

#### Lines 353-357: Update Tracking

```solidity
    // Update tracking
    userPositions[msg.sender].push(tokenId);
    userTotalValue[msg.sender] += usdValue;
    totalStakedValue += usdValue;
```

**Explanation:**

- **Line 354:** Add token ID to user's position array
  - Allows iterating over user's positions later
  
- **Line 355:** Add to user's total value
  - Used for analytics

- **Line 356:** Add to global total value
  - Used in reward calculations

#### Lines 359-365: Transfer NFT & Emit Event

```solidity
    // Transfer NFT to contract
    IERC721(positionManager).safeTransferFrom(
        msg.sender,
        address(this),
        tokenId
    );

    emit PositionStaked(
        msg.sender,
        tokenId,
        usdValue,
        lockDays,
        boostMultiplier
    );
}
```

**Explanation:**

- **Lines 360-364:** Transfer NFT from user to contract
  - Uses `safeTransferFrom` for safety
  - Contract now holds the NFT
  - User cannot use NFT elsewhere while staked
  - **This is why vulnerability #5 doesn't exist!**

- **Lines 367-373:** Emit event for off-chain tracking

**Security Note:** NFT transfer happens AFTER all state updates (Checks-Effects-Interactions pattern).

---

## Summary of Part 1

We've covered:
- ✅ Contract structure and inheritance
- ✅ All constants, roles, and state variables
- ✅ Data structures (StakedPosition, PoolInfo)
- ✅ Storage mappings
- ✅ Events
- ✅ Constructor and initialization
- ✅ All admin functions (deposit, rate setting, pause, emergency)
- ✅ Complete stake function flow

**Next in Part 2:**
- Unstake function
- Claim rewards functions
- View functions (pending rewards, APR, stats)
- Internal calculation functions (TWAP, position value, boost multiplier)
- Security features (liquidity validation, TWAP oracle)
- ERC721 receiver

---

**Continue to Part 2 → [FARMING_CONTRACT_EXPLAINED_PART2.md](./FARMING_CONTRACT_EXPLAINED_PART2.md)**
