# Magic World Token - AI Development Guide

## Project Overview

A play-to-earn ERC20 token system deployed on Polygon, designed for casual players with gas-efficient batch operations and role-based access control. Features a comprehensive token allocation and vault system for transparent fund management.

## Architecture

- **Token Contract:** `MagicWorldToken.sol` - ERC20 with batch transfers and RBAC
- **Game Contract:** `MagicWorldGame.sol` - Manages P2E distribution with vault system
- **Partner Vault:** `PartnerVault.sol` - Time-locked vault for partner allocations
- **Network:** Polygon (low gas costs for frequent micro-transactions)
- **Supply:** Fixed supply, non-upgradeable contracts
- **Framework:** Hardhat for development, testing, and deployment

## Token Allocation Plan

- **Partners:** 10% of tokens, withdrawable after 3 years from PartnerVault
- **Player Tasks:** 50% of tokens for gameplay rewards
- **Social Media Followers:** 5% of tokens for community engagement
- **Social Media Posters:** 15% of tokens for content creation
- **Ecosystem Fund:** 30% of tokens for development and operations

## Key Components

### Token Contract Features

- OpenZeppelin ERC20 base with AccessControl and Pausable
- Batch transfer functions: `batchTransfer()` and `batchTransferEqual()`
- Role-based permissions: `GAME_OPERATOR_ROLE`, `PAUSE_ROLE`
- Gas-optimized for frequent small rewards to casual players

### Game Contract Responsibilities

- Implements vault system for token allocation management
- Manages P2E reward distribution with vault balance checks
- Rate limiting and anti-abuse mechanisms
- Integration point for off-chain game servers via role-based access

### Partner Vault Contract

- Holds 10% of total token supply for partners
- Time-locked withdrawals (3-year vesting period)
- Individual partner allocation tracking
- Secure withdrawal mechanism with lockup enforcement

### Vault System Architecture

- **Allocation Types**: PLAYER_TASKS (50%), SOCIAL_FOLLOWERS (5%), SOCIAL_POSTERS (15%), ECOSYSTEM_FUND (30%)
- **Vault Tracking**: Each allocation has total, spent, and remaining balances
- **Distribution Control**: All token distributions deduct from appropriate vaults
- **Transparency**: Public view functions for vault status monitoring

## Development Patterns

### Role Management

```solidity
// Standard OpenZeppelin AccessControl pattern
bytes32 public constant GAME_OPERATOR_ROLE = keccak256("GAME_OPERATOR_ROLE");
bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");

// Grant operator role to game servers
grantRole(GAME_OPERATOR_ROLE, gameServerAddress);

// Batch transfers require GAME_OPERATOR_ROLE
function batchTransfer(address[] recipients, uint256[] amounts)
    external onlyRole(GAME_OPERATOR_ROLE) whenNotPaused
```

### Vault Management Patterns

```solidity
// Vault allocation types
enum AllocationType {
    PLAYER_TASKS,      // 50% - Gameplay rewards
    SOCIAL_FOLLOWERS,  // 5% - Community engagement
    SOCIAL_POSTERS,    // 15% - Content creation
    ECOSYSTEM_FUND     // 30% - Development & operations
}

// Vault structure for tracking allocations
struct AllocationVault {
    uint256 totalAllocated;
    uint256 spent;
    uint256 remaining;
}

// Check vault balance before distribution
function distributeFromVault(AllocationType vaultType, address[] recipients, uint256[] amounts)
    external onlyRole(GAME_OPERATOR_ROLE) whenNotPaused
{
    AllocationVault storage vault = vaults[vaultType];
    uint256 totalAmount = 0;
    for (uint256 i = 0; i < amounts.length; i++) {
        totalAmount += amounts[i];
    }

    require(vault.remaining >= totalAmount, "Insufficient vault balance");

    // Deduct from vault
    vault.spent += totalAmount;
    vault.remaining -= totalAmount;

    // Distribute tokens
    // ... distribution logic
}
```

### Partner Vault Patterns

```solidity
// Partner allocation with time locks
struct PartnerAllocation {
    uint256 amount;
    uint256 allocatedAt;
    bool withdrawn;
}

// Time-locked withdrawal (3 years)
function withdraw() external {
    PartnerAllocation storage allocation = partnerAllocations[msg.sender];
    require(allocation.amount > 0, "No allocation found");
    require(!allocation.withdrawn, "Already withdrawn");
    require(block.timestamp >= allocation.allocatedAt + 3 years, "Lockup period not ended");

    allocation.withdrawn = true;
    token.transfer(msg.sender, allocation.amount);
}
```

### Contract Deployment Pattern

1. Deploy Token Contract with fixed total supply
2. Deploy Game Contract with Token Contract address
3. Deploy Partner Vault Contract
4. Transfer 10% of tokens to Partner Vault
5. Initialize Game Contract vaults with remaining 90%
6. Grant GAME_OPERATOR_ROLE to Game Contract
7. Renounce admin role from deployer (optional security measure)

## Hardhat Development Workflow

### Key Commands

```bash
# Install dependencies
npm install

# Compile contracts
npx hardhat compile

# Run tests
npx hardhat test

# Deploy to Polygon testnet
npx hardhat run scripts/deploy.js --network polygonAmoy

# Deploy to Polygon mainnet
npx hardhat run scripts/deploy.js --network polygon

# Verify contracts on Polygonscan
npx hardhat verify --network polygon <CONTRACT_ADDRESS>
```

### Testing Strategy

- Unit tests for all role permissions and access controls
- Gas optimization tests for batch operations
- Integration tests between Token and Game contracts
- Stress tests for maximum batch sizes on Polygon
- Edge case tests for fixed supply constraints

### Network Configuration

- **Development:** Hardhat local network
- **Testnet:** Polygon Amoy for testing
- **Mainnet:** Polygon for production deployment
- Configure gas price strategies for Polygon in `hardhat.config.js`

## Security Considerations

- All contracts are non-upgradeable (immutable after deployment)
- Daily reward limits implemented in Game Contract
- Emergency pause functionality accessible via PAUSE_ROLE
- Input validation on all batch operations (array length matching)
- Fixed total supply prevents inflation attacks
- Role-based access prevents unauthorized token distribution

## Integration Points

- Game servers authenticate via GAME_OPERATOR_ROLE
- Events emitted for off-chain state synchronization
- Wallet integration optimized for casual players (minimal gas costs)
- Polygon network chosen specifically for low transaction fees
- Batch operations reduce gas costs for frequent P2E rewards

## File Structure

```
contracts/
├── MagicWorldToken.sol      # Main ERC20 token with batch operations
├── MagicWorldGame.sol       # Game logic and token distribution with vault system
├── PartnerVault.sol         # Time-locked vault for partner allocations
└── interfaces/
    └── IMagicWorldToken.sol # Interface definitions

scripts/
├── deploy.js                # Deployment script for all contracts
└── setup.js                 # Post-deployment configuration

test/
├── MagicWorldToken.test.js  # Token contract tests
├── MagicWorldGame.test.js   # Game contract tests with vault functionality
├── PartnerVault.test.js     # Partner vault tests
└── integration.test.js      # Cross-contract integration tests
```

## Common Patterns

- Always use `whenNotPaused` modifier on critical functions
- Emit events for all significant state changes for game tracking
- Use OpenZeppelin's `_msgSender()` instead of `msg.sender`
- Implement proper error messages for better debugging
- Gas estimation should account for Polygon's lower costs vs Ethereum

## Critical Security Rules

**🚨 NEVER ACCESS .env FILES 🚨**

- **NEVER** read, open, or request to see `.env` files
- **NEVER** read `.env.local`, `api/.env`, or any environment files containing secrets
- **NEVER** suggest opening .env files in the editor
- **ALWAYS** use `.env.example` files with placeholder values for discussions
- **ALWAYS** use encrypted `.env.encrypted` files if environment variable discussions are needed
- **ALWAYS** refuse requests to view .env files, explaining the security risk

**Reason:** Opening .env files exposes private keys and secrets to AI context, which led to a wallet compromise incident. All secrets must remain confidential.

**If user asks about environment variables:**

- Use `.env.example` with fake values
- Reference `scripts/encrypt-env.js` for secure .env management
- Suggest using Railway environment variables dashboard for production
- Direct to `docs/ENV_SECURITY_GUIDE.md` for best practices

## Trading Bot Integration

### Overview

Automated trading bot system for maintaining MWT/BNB peg on PancakeSwap. The bot is a **separate standalone project** that consumes the API exposed by the backend.

### Architecture

```
Magic_World_Token/
├── api/                    # Backend API (extends existing)
│   └── src/
│       ├── bot/           # Bot-related services & endpoints
│       │   ├── services/  # Blockchain interaction services
│       │   ├── models/    # Bot data models
│       │   └── utils/     # Bot utilities
│       └── routes/
│           └── bot.js     # Bot API endpoints
│
└── bot/                   # Standalone Bot Project (separate)
    └── src/
        ├── bot.js         # Main bot orchestrator
        └── services/      # Bot logic & API client
```

### Part 1: API Backend Extensions

#### Directory Structure

```
api/src/bot/
├── services/
│   ├── priceOracle.js          # Fetch prices from PancakeSwap + Chainlink
│   ├── tradeExecutor.js        # Execute swaps on PancakeSwap
│   ├── gasManager.js           # Gas optimization & nonce management
│   └── portfolioManager.js     # Track bot balances
├── models/
│   ├── Trade.js                # Trade history schema
│   ├── PriceHistory.js         # Price data schema
│   └── BotConfig.js            # Bot configuration schema
└── utils/
    └── calculations.js         # Price calculations & formulas
```

#### API Endpoints (api/src/routes/bot.js)

**Price Endpoints:**

- `POST /api/bot/prices/current` - Get current MWT prices (BNB/USD/BTC)
- `POST /api/bot/prices/deviation` - Get peg deviation
- `POST /api/bot/liquidity` - Get liquidity depth

**Trade Endpoints:**

- `POST /api/bot/trade/execute` - Execute trade (BUY/SELL)
- `POST /api/bot/trade/estimate` - Estimate trade output
- `GET /api/bot/trade/history` - Get trade history

**Portfolio Endpoints:**

- `GET /api/bot/balances` - Get bot wallet balances
- `GET /api/bot/portfolio/status` - Get portfolio summary

**Configuration Endpoints:**

- `GET /api/bot/config` - Get bot configuration
- `PUT /api/bot/config` - Update bot configuration

**Safety Endpoints:**

- `GET /api/bot/safety/status` - Get safety check status
- `GET /api/bot/health` - Health check
- `POST /api/bot/emergency/pause` - Emergency pause

#### Required Contract ABIs

Add to `api/contracts/abis/`:

1. **IPancakeRouter.json** - PancakeSwap Router V2

   - Router Address (BSC): `0x10ED43C718714eb63d5aA57B78B54704E256024E`
   - Functions: `swapExactETHForTokens`, `swapExactTokensForETH`, `getAmountsOut`

2. **IPancakePair.json** - PancakeSwap Pair

   - MWT/BNB Pair: `0x9f55c42d54e07daa717f6458c8c5ed480b7592f0`
   - Functions: `getReserves`, `token0`, `token1`

3. **IChainlinkAggregator.json** - Chainlink Price Feeds
   - BNB/USD Feed: `0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE`
   - BTC/USD Feed: `0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf`
   - Functions: `latestRoundData`, `decimals`

#### Environment Variables

```bash
# Trading Bot Wallet (API-side)
BOT_WALLET_ADDRESS=0x...
BOT_WALLET_PRIVATE_KEY=0x...

# PancakeSwap Contracts
PANCAKE_ROUTER_ADDRESS=0x10ED43C718714eb63d5aA57B78B54704E256024E
MWT_BNB_PAIR_ADDRESS=0x9f55c42d54e07daa717f6458c8c5ed480b7592f0
WBNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c

# Chainlink Oracles
CHAINLINK_BNB_USD_FEED=0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE
CHAINLINK_BTC_USD_FEED=0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf

# Bot Configuration
TARGET_PEG_USD=0.01
BOT_ENABLED=false
```

#### Key Services

**PriceOracle Service:**

- Fetch MWT/BNB price from PancakeSwap pair reserves
- Fetch BNB/USD and BTC/USD from Chainlink oracles
- Calculate derived prices: MWT/USD, MWT/BTC
- Cache prices (1-minute duration) to reduce RPC calls
- Validate prices for anomalies

**Price Calculation Formulas:**

```javascript
// MWT/BNB from pair reserves
mwtBnbPrice = bnbReserve / mwtReserve

// MWT/USD
mwtUsdPrice = mwtBnbPrice × bnbUsdPrice

// MWT/BTC
mwtBtcPrice = (mwtBnbPrice × bnbUsdPrice) ÷ btcUsdPrice

// Satoshis
satoshis = mwtBtcPrice × 100000000
```

**TradeExecutor Service:**

- Execute BUY: `swapExactETHForTokens` (BNB → MWT)
- Execute SELL: `swapExactTokensForETH` (MWT → BNB)
- Manage token approvals
- Optimize gas prices based on urgency
- Handle nonce management
- Retry logic with exponential backoff

**Database Models:**

1. **Trade Model:** Track all executed trades
   - Fields: txHash, action, amounts, price, gas, status, profitLoss
2. **PriceHistory Model:** Historical price data
   - Fields: mwtBnb, bnbUsd, btcUsd, mwtUsd, mwtBtc, liquidity, deviation
3. **BotConfig Model:** Bot configuration
   - Fields: enabled, targetPeg, thresholds, limits, slippage, cooldown

#### Implementation Phases

**Phase 1.1: Setup & ABIs (Day 1-2)**

- Add PancakeSwap Router ABI
- Add PancakeSwap Pair ABI
- Add Chainlink Aggregator ABI
- Create directory structure

**Phase 1.2: Price Oracle (Day 3-4)**

- Implement `PriceOracle` service
- Add price caching
- Add price validation
- Test on BSC mainnet

**Phase 1.3: Trade Executor (Day 5-6)**

- Implement `TradeExecutor` service
- Add approval management
- Add gas optimization
- Test swaps on testnet

**Phase 1.4: Database Models (Day 7)**

- Create Trade model
- Create PriceHistory model
- Create BotConfig model

**Phase 1.5: API Routes (Day 8-9)**

- Implement all bot endpoints
- Add authentication/authorization
- Add rate limiting
- Test all endpoints

**Phase 1.6: Testing & Documentation (Day 10)**

- Integration tests
- API documentation
- Deployment preparation

### Part 2: Bot Project (Separate Implementation)

The bot project will be a standalone Node.js application that:

- Communicates with the API via HTTP
- Implements trading strategies
- Monitors prices continuously
- Makes autonomous trading decisions
- Handles safety checks and circuit breakers

See separate bot implementation guide for details.

## MWG Farming Pool Frontend

### Overview

Liquidity farming frontend for MWGFarmingPool.sol contract. Users stake PancakeSwap V3 NFT positions (MWG/BNB) to earn MWG rewards with lock period multipliers up to 2x.

### Contract Integration Points

**Smart Contract:** `MWGFarmingPool.sol` (BSC Mainnet)

**Key Features:**

- Stake PancakeSwap V3 NFT positions
- Earn MWG rewards based on USD value staked
- Lock periods for bonus rewards (1x-2x multiplier)
- TWAP oracle for price manipulation resistance
- Emergency controls and admin functions

**Lock Period Multipliers:**

- No Lock: 1.0x (BASE_MULTIPLIER = 1000)
- 7 days: 1.05x
- 30 days: 1.1x
- 90 days: 1.25x
- 180 days: 1.5x
- 365 days: 2.0x (MAX_LOCK_DAYS)

### Frontend Pages Structure

Following Next.js App Router pattern (same as `/frontend/src/app/`)

#### Page 1: `/farming` - Farming Dashboard

**Purpose:** Main entry point, farming overview and stats

**Components:**

```typescript
// Display data from getFarmingStats()
- Farming Stats Cards:
  - Total Value Locked (totalStakedValue in USD)
  - Current APR (from getCurrentAPR() - returns basis points)
  - Total Rewards Distributed (totalRewardsDistributed)
  - Available Rewards (getAvailableRewards())
  - Farm Status (active/paused/ended based on farmingStartTime/farmingEndTime)

- Lock Period Multipliers Chart:
  - Visual display of all boost tiers
  - Show boost calculation: getBoostMultiplier(lockDays)

- Quick Action Buttons:
  - "Stake Position" → /farming/stake
  - "View My Positions" → /farming/positions
  - "Claim Rewards" (if user has positions with pending > 0)

- Recent Activity Feed:
  - Listen to events: PositionStaked, PositionUnstaked, RewardsClaimed
  - Real-time updates using wagmi useWatchContractEvent
```

**Contract Calls:**

- `getFarmingStats()` → (totalStaked, totalRewards, availableRewards, currentAPR, participantCount, isActive)
- Event listeners for live updates

---

#### Page 2: `/farming/stake` - Stake NFT Position

**Purpose:** Stake PancakeSwap V3 NFT positions

**Flow:**

1. Fetch user's V3 NFT positions from PancakeSwap Position Manager
2. Filter for MWG/BNB pool positions (verify pool address matches targetPool)
3. Show position details with USD value preview
4. Select lock period (0-365 days)
5. Preview boost multiplier and estimated rewards
6. Approve NFT transfer (if needed)
7. Call `stakePosition(tokenId, lockDays)`

**Components:**

```typescript
- NFT Position Selector:
  - Fetch from INonfungiblePositionManager.positions(tokenId)
  - Filter positions where pool == targetPool
  - Display: tokenId, liquidity, tickRange, USD value estimate

- Lock Period Configuration:
  - Dropdown: 0, 7, 30, 90, 180, 365 days
  - Real-time boost multiplier display (getBoostMultiplier(lockDays))
  - Lock end date calculation
  - Estimated APR with boost: currentAPR × (boostMultiplier/1000)

- Position Value Preview:
  - Calculate estimated USD value (client-side estimation)
  - Contract will recalculate on-chain during stake

- Approval & Stake Flow:
  - Check NFT approval for farming contract
  - Button: Approve NFT (setApprovalForAll)
  - Button: Stake Position (stakePosition(tokenId, lockDays))
```

**Contract Calls:**

- `getBoostMultiplier(lockDays)` → returns multiplier (1000-2000)
- `stakePosition(tokenId, lockDays)` → stakes position
- Events: `PositionStaked(user, tokenId, usdValue, lockDays, boostMultiplier)`

**External Contracts:**

- PancakeSwap Position Manager: `ownerOf(tokenId)`, `positions(tokenId)`
- Check approval: `isApprovedForAll(owner, farmingContract)`
- Set approval: `setApprovalForAll(farmingContract, true)`

---

#### Page 3: `/farming/positions` - My Staked Positions

**Purpose:** View and manage all staked positions

**Components:**

```typescript
- Position Cards Grid:
  - For each tokenId in getUserPositions(address):
    - Fetch StakedPosition struct from stakedPositions(tokenId)
    - Display:
      - Token ID with PancakeSwap NFT image
      - USD value staked (position.usdValue)
      - Current liquidity (position.liquidity)
      - Staked date (position.stakedAt)
      - Lock status: locked/unlocked
      - Lock end countdown (if position.lockUntil > now)
      - Boost multiplier (position.boostMultiplier / 1000 = 1.25x)
      - Pending rewards (pendingRewards(tokenId))
      - Action buttons based on state

- Position Summary Cards:
  - Total positions: getUserPositions(user).length
  - Total staked value: userTotalValue[user]
  - Total pending rewards: pendingRewardsForUser(user)
  - Total claimed: userRewardsClaimed[user]

- Position Actions:
  - Claim button: enabled if pending > 0
  - Unstake button: enabled if block.timestamp >= lockUntil
  - Emergency unstake: shown if emergencyWithdrawEnabled == true
```

**Contract Calls:**

- `getUserPositions(address)` → uint256[] tokenIds
- `stakedPositions(tokenId)` → StakedPosition struct
- `pendingRewards(tokenId)` → uint256 pending
- `pendingRewardsForUser(address)` → uint256 totalPending
- `userTotalValue[address]` → uint256 totalUSD
- `userRewardsClaimed[address]` → uint256 claimed

---

#### Page 4: `/farming/rewards` - Rewards Management

**Purpose:** Claim rewards from staked positions

**Components:**

```typescript
- Claim All Section:
  - Total pending: pendingRewardsForUser(user)
  - Button: "Claim All Rewards" → claimAllRewards()
  - Gas estimate display

- Selective Claim Section:
  - Checkbox list of positions with pending > 0
  - Select positions to claim
  - Button: "Claim Selected" → claimRewards(selectedTokenIds[])
  - Validate: tokenIds.length <= MAX_BATCH_SIZE (50)

- Rewards History Table:
  - Listen to RewardsClaimed events filtered by user
  - Display: timestamp, amount, tokenIds, txHash
  - Link to BSCScan for transaction details

- Rewards Statistics:
  - Total claimed lifetime: userRewardsClaimed[user]
  - Average daily earnings calculation
  - Projected earnings based on current APR
```

**Contract Calls:**

- `pendingRewardsForUser(address)` → uint256
- `claimRewards(uint256[] tokenIds)` → claims specific positions
- `claimAllRewards()` → claims all positions
- Events: `RewardsClaimed(user, amount, tokenIds[])`

**Validation:**

- MAX_BATCH_SIZE = 50 (prevent DoS)
- Check tokenIds.length before calling

---

#### Page 5: `/farming/unstake` - Unstake Positions

**Purpose:** Unstake NFT positions and withdraw

**Components:**

```typescript
- Unlocked Positions List:
  - Filter positions where lockUntil <= block.timestamp
  - Show position details
  - Display pending rewards that will be claimed

- Locked Positions List:
  - Show countdown to unlock: lockUntil - block.timestamp
  - Display time remaining in days/hours

- Unstake Flow:
  - Select position to unstake
  - Preview: NFT returned + rewards claimed
  - Warning: Position will be removed from farming
  - Button: "Unstake Position" → unstakePosition(tokenId)

- Emergency Unstake (if enabled):
  - Show only if emergencyWithdrawEnabled == true
  - Warning: No rewards will be claimed
  - Require confirmation
  - Button: "Emergency Unstake" → emergencyUnstake(tokenId)
```

**Contract Calls:**

- `unstakePosition(tokenId)` → unstakes and claims rewards
- `emergencyUnstake(tokenId)` → unstakes without rewards
- `emergencyWithdrawEnabled` → bool
- Events: `PositionUnstaked(user, tokenId, rewards)`

**Effects:**

- NFT transferred back to user
- Rewards transferred (if not emergency)
- Position removed from stakedPositions
- userTotalValue decreased

---

#### Page 6: `/farming/analytics` - Farming Analytics

**Purpose:** Historical data and performance metrics

**Components:**

```typescript
- APR History Chart:
  - Track getCurrentAPR() over time
  - Line chart showing APR trends
  - Use recharts or chart.js

- TVL Chart:
  - Track totalStakedValue over time
  - Show user's contribution percentage

- Rewards Distribution Chart:
  - Daily/weekly rewards distributed
  - User's share of total rewards

- Position Performance Table:
  - Individual position ROI calculation
  - Compare different lock periods
  - Boost multiplier effectiveness

- Pool Health Metrics:
  - Available rewards: getAvailableRewards()
  - Reward depletion rate: calculate based on rewardPerSecond
  - Days until farming ends: (farmingEndTime - now) / 86400
  - Projected pool exhaustion timeline
```

**Data Sources:**

- Periodic polling of contract state
- Store historical data in local state/database
- Events for transaction history

---

#### Page 7: `/farming/calculator` - Rewards Calculator

**Purpose:** Estimate earnings before staking

**Components:**

```typescript
- Input Section:
  - USD value slider (100-10000 USD)
  - Lock period dropdown (0-365 days)
  - Current APR display (live from getCurrentAPR())

- Calculation Engine:
  - Base APR from contract
  - Apply boost multiplier: APR × (boostMultiplier/1000)
  - Calculate daily: (stakeValue × boostedAPR / 36500)
  - Calculate weekly: daily × 7
  - Calculate monthly: daily × 30
  - Calculate until unlock: daily × lockDays

- Results Display:
  - Estimated daily rewards (MWG + USD value)
  - Weekly rewards
  - Monthly rewards
  - Total until lock ends

- Comparison Table:
  - Side-by-side comparison of all lock periods
  - Show ROI for each tier
  - Highlight optimal lock period
```

**Contract Calls:**

- `getCurrentAPR()` → uint256 (basis points)
- `getBoostMultiplier(lockDays)` → uint256 (for each tier)

**Calculations:**

```javascript
// APR is in basis points (10000 = 100%)
baseAPR = getCurrentAPR() / 10000; // Convert to decimal
boost = getBoostMultiplier(lockDays) / 1000; // 1000 = 1x
boostedAPR = baseAPR * boost;

// Daily rewards in MWG
dailyRewardsMWG = (stakeValueUSD * boostedAPR) / 365;

// Convert to USD using current MWG price
dailyRewardsUSD = dailyRewardsMWG * mwgPriceUSD;
```

---

#### Page 8: `/farming/admin` - Admin Dashboard

**Purpose:** Admin controls (protected by roles)

**Role Requirements:**

- `ADMIN_ROLE` - Full admin access
- `REWARD_MANAGER_ROLE` - Deposit rewards, set rates
- `PAUSE_ROLE` - Pause/unpause contract

**Sections:**

**8a. Rewards Management (REWARD_MANAGER_ROLE)**

```typescript
- Deposit Rewards:
  - Input: amount (MWG tokens)
  - Current balance: totalRewardsDeposited - totalRewardsDistributed
  - Button: "Deposit Rewards" → depositRewards(amount)
  - Requires: MWG token approval first

- Set Reward Rate:
  - Current rate: rewardPerSecond (display in MWG/day)
  - Input: new rate (with validation <= 1e18)
  - APR impact calculator: show how APR changes
  - Button: "Update Rate" → setRewardRate(newRate)

- Extend Farming Period:
  - Current end: farmingEndTime (display date)
  - Input: additional seconds/days
  - Preview: new end date
  - Validation: max 5 years from now
  - Button: "Extend Period" → extendFarming(additionalSeconds)
```

**8b. Emergency Controls (ADMIN_ROLE)**

```typescript
- Pause Contract:
  - Current status: paused() → bool
  - Toggle button: setPaused(true/false)
  - Warning: Disables staking/claiming when paused

- Enable Emergency Withdraw:
  - Status: emergencyWithdrawEnabled
  - Warning: IRREVERSIBLE action
  - Confirmation modal required
  - Button: "Enable Emergency" → enableEmergencyWithdraw()

- Emergency Withdraw Rewards:
  - Only if emergencyWithdrawEnabled == true
  - Available: getAvailableRewards()
  - Input: amount to withdraw
  - Button: "Withdraw" → emergencyWithdrawRewards(amount)
```

**8c. Monitoring Dashboard**

```typescript
- Contract Health Metrics:
  - Total staked: totalStakedValue (USD)
  - Rewards deposited: totalRewardsDeposited
  - Rewards distributed: totalRewardsDistributed
  - Available rewards: getAvailableRewards()
  - Reward rate: rewardPerSecond (MWG/second)
  - Depletion timeline: estimate based on current rate

- User Statistics:
  - Total participants: track unique stakers
  - Average position value: totalStaked / positionCount
  - Total positions staked: count

- Recent Transactions Feed:
  - Live event listener for all contract events
  - Filter by event type
  - Display user, amount, timestamp, txHash
```

**Contract Calls:**

- `depositRewards(amount)` - REWARD_MANAGER_ROLE
- `setRewardRate(rate)` - ADMIN_ROLE
- `extendFarming(seconds)` - ADMIN_ROLE
- `setPaused(bool)` - PAUSE_ROLE
- `enableEmergencyWithdraw()` - ADMIN_ROLE (irreversible)
- `emergencyWithdrawRewards(amount)` - ADMIN_ROLE
- All view functions for monitoring

---

### Shared Components to Create

```typescript
// /components/farming/

1. FarmingStatsCard.tsx
   - Props: title, value, change, icon, trend
   - Reusable card for metrics display

2. PositionCard.tsx
   - Props: position (StakedPosition), onClaim, onUnstake
   - Display individual position details
   - Action buttons based on state

3. LockPeriodSelector.tsx
   - Props: selectedDays, onChange
   - Dropdown with all lock tiers
   - Show multiplier for each option

4. RewardsDisplay.tsx
   - Props: pendingAmount, onClaim
   - Format MWG amount with USD value
   - Claim button with loading state

5. APRBadge.tsx
   - Props: apr (basis points)
   - Colored badge based on APR value
   - Tooltip with calculation breakdown

6. CountdownTimer.tsx
   - Props: targetTimestamp
   - Live countdown display
   - Format: "X days Y hours Z minutes"

7. BoostMultiplierBadge.tsx
   - Props: multiplier (1000-2000)
   - Visual indicator (1.0x - 2.0x)
   - Color coding by boost level

8. TransactionHistory.tsx
   - Props: events[], filterBy
   - Table with pagination
   - Sort by date, filter by type

9. EmergencyBanner.tsx
   - Props: isActive (emergencyWithdrawEnabled)
   - Warning banner when emergency mode active
   - Sticky position at top

10. FarmingChart.tsx
    - Props: data[], type (APR/TVL/Rewards)
    - Wrapper for recharts
    - Responsive design
```

---

### Custom Hooks to Create

```typescript
// /hooks/farming/

1. useFarmingPool.ts
   - useFarmingStats() → getFarmingStats() data
   - useRewardRate() → rewardPerSecond
   - useFarmingPeriod() → start/end timestamps
   - useEmergencyStatus() → emergencyWithdrawEnabled
   - usePaused() → paused() status

2. useStakedPositions.ts
   - useUserPositions(address) → getUserPositions()
   - usePositionDetails(tokenId) → stakedPositions mapping
   - usePositionPendingRewards(tokenId) → pendingRewards()
   - useUserTotalValue(address) → userTotalValue mapping
   - useUserRewardsClaimed(address) → userRewardsClaimed mapping

3. useFarmingActions.ts
   - useStakePosition() → transaction hook for stakePosition()
   - useUnstakePosition() → transaction hook for unstakePosition()
   - useClaimRewards() → transaction hook for claimRewards()
   - useClaimAllRewards() → transaction hook for claimAllRewards()
   - useEmergencyUnstake() → transaction hook for emergencyUnstake()

4. useFarmingAdmin.ts (protected)
   - useDepositRewards() → depositRewards() transaction
   - useSetRewardRate() → setRewardRate() transaction
   - useExtendFarming() → extendFarming() transaction
   - useSetPaused() → setPaused() transaction
   - useEnableEmergency() → enableEmergencyWithdraw() transaction
   - useEmergencyWithdrawRewards() → emergencyWithdrawRewards() transaction

5. useFarmingEvents.ts
   - useFarmingEvents() → watch all contract events
   - usePositionStakedEvents() → filter PositionStaked
   - useRewardsClaimedEvents() → filter RewardsClaimed
   - usePositionUnstakedEvents() → filter PositionUnstaked
   - useRecentActivity(limit) → parse events for activity feed

6. useNFTPositions.ts
   - useUserNFTPositions() → fetch from Position Manager
   - useNFTApproval() → check/set approval
   - usePositionValue(tokenId) → estimate USD value
   - useFilterMWGPositions() → filter for MWG/BNB pool

7. useFarmingCalculations.ts
   - useAPRCalculation(stakeValue, lockDays) → estimated rewards
   - useBoostMultiplier(lockDays) → getBoostMultiplier()
   - useLockEndDate(lockDays) → calculate unlock timestamp
   - useRewardProjection(position) → future earnings estimate
```

---

### Contract ABIs Required

Add to `/abis/`:

```typescript
1. MWGFarmingPool.json
   - Full ABI for farming contract
   - All view/write functions
   - All events

2. INonfungiblePositionManager.json
   - PancakeSwap V3 Position Manager
   - Functions: positions(), ownerOf(), isApprovedForAll(), setApprovalForAll()

3. IUniswapV3Pool.json
   - For direct pool queries (if needed)
   - Functions: slot0(), observe()
```

---

### Configuration Updates

**Add to `/config/contracts.ts`:**

```typescript
export const CONTRACT_ADDRESSES = {
  // ... existing contracts
  FARMING_POOL: "0x..." as Address, // MWGFarmingPool address
  PANCAKE_POSITION_MANAGER:
    "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364" as Address, // PancakeSwap V3
  MWG_BNB_POOL: "0x..." as Address, // Target pool address
};

export const FARMING_CONFIG = {
  MAX_BATCH_SIZE: 50,
  MAX_LOCK_DAYS: 365,
  BASE_MULTIPLIER: 1000,
  LOCK_TIERS: [
    { days: 0, multiplier: 1000, label: "No Lock", boost: "1.0x" },
    { days: 7, multiplier: 1050, label: "1 Week", boost: "1.05x" },
    { days: 30, multiplier: 1100, label: "1 Month", boost: "1.1x" },
    { days: 90, multiplier: 1250, label: "3 Months", boost: "1.25x" },
    { days: 180, multiplier: 1500, label: "6 Months", boost: "1.5x" },
    { days: 365, multiplier: 2000, label: "1 Year", boost: "2.0x" },
  ],
};
```

---

### Navigation Updates

**Update `/components/SideNav.tsx`:**

```typescript
const navLinks: NavLink[] = [
  // ... existing links
  {
    href: "/farming",
    label: "Farming",
    showAlways: true,
    icon: <FarmingIcon />, // Add farming icon
  },
  {
    href: "/farming/positions",
    label: "My Positions",
    showAlways: true,
    icon: <PositionsIcon />,
  },
  {
    href: "/farming/admin",
    label: "Farming Admin",
    requiresAdmin: true,
    icon: <AdminIcon />,
  },
];
```

---

### Implementation Phases - Step by Step

**Phase 1: Project Setup (Day 1)**

1. Create farming directory structure
2. Add contract ABIs
3. Update contract addresses config
4. Create farming types/interfaces
5. Set up basic routing structure

**Phase 2: Core Hooks (Day 2-3)** 6. Implement useFarmingPool hook 7. Implement useStakedPositions hook 8. Implement useFarmingActions hook 9. Implement useNFTPositions hook 10. Add error handling and loading states

**Phase 3: Shared Components (Day 4-5)** 11. Create FarmingStatsCard component 12. Create PositionCard component 13. Create LockPeriodSelector component 14. Create RewardsDisplay component 15. Create APRBadge component 16. Create CountdownTimer component 17. Create BoostMultiplierBadge component

**Phase 4: Main Pages (Day 6-10)** 18. Implement /farming (Dashboard) page 19. Implement /farming/stake page 20. Implement /farming/positions page 21. Implement /farming/rewards page 22. Implement /farming/unstake page 23. Add event listeners for live updates

**Phase 5: Analytics & Calculator (Day 11-12)** 24. Implement /farming/analytics page 25. Implement /farming/calculator page 26. Add chart components 27. Add historical data tracking

**Phase 6: Admin Pages (Day 13-14)** 28. Implement /farming/admin page 29. Add role-based access control 30. Implement rewards management section 31. Implement emergency controls section 32. Add monitoring dashboard

**Phase 7: Polish & Testing (Day 15-16)** 33. Add loading skeletons 34. Implement error boundaries 35. Add toast notifications 36. Mobile responsive design 37. Cross-browser testing 38. Gas optimization checks

**Phase 8: Integration Testing (Day 17-18)** 39. Test with real contract on testnet 40. Test all transaction flows 41. Test edge cases (locked positions, emergency mode) 42. Test event listeners 43. Performance optimization

**Phase 9: Documentation (Day 19)** 44. Add inline code comments 45. Create user guide 46. Document admin functions 47. Create troubleshooting guide

**Phase 10: Deployment (Day 20)** 48. Deploy to production 49. Monitor for issues 50. Collect user feedback 51. Iterate based on feedback
