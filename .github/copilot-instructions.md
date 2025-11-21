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

---

## MWG Order Book System

### Overview

Order book system for clients to exchange MWG tokens for BNB without AMM slippage. Admin pays clients with MWG, clients receive BNB at agreed rates.

### Core Flow

**Primary Use Case: Admin Pays Client**
1. Client creates BUY order (deposits BNB, wants MWG)
2. Admin sees order in dashboard
3. Admin fills order (sends MWG, receives BNB)
4. Atomic swap executed (client gets MWG, admin gets BNB)

### Implementation Status

#### Phase 1: Smart Contract Development (Days 1-2) - ✅ COMPLETED

**Task 1.1: Create MWGOrderBook.sol** - ✅ COMPLETED
- Location: `contracts/MWGOrderBook.sol`
- Features:
  - ✅ Order struct with all necessary fields (including feeAtCreation for fee protection)
  - ✅ Buy/Sell order creation functions (anyone can create)
  - ✅ Order filling (partial and full fills supported)
  - ✅ Order cancellation with fund refunds
  - ✅ Order expiration handling (1-hour grace period)
  - ✅ Fee mechanism (0-10% in basis points, MWG fees burned, BNB fees to recipient)
  - ✅ Events for all actions (OrderCreated, OrderFilled, OrderCancelled, WithdrawalClaimed)
- Key Functions:
  - ✅ `createBuyOrder(uint256 mwgAmount, uint256 pricePerMWG, uint256 expirySeconds) external payable`
  - ✅ `createSellOrder(uint256 mwgAmount, uint256 pricePerMWG, uint256 expirySeconds) external`
  - ✅ `fillBuyOrder(uint256 orderId, uint256 mwgAmount) external`
  - ✅ `fillSellOrder(uint256 orderId, uint256 mwgAmount) external payable`
  - ✅ `cancelOrder(uint256 orderId) external`
  - ✅ `getActiveOrders(uint256 offset, uint256 limit) external view` (paginated max 100)
  - ✅ `getUserOrders(address user) external view returns (uint256[] memory)`
  - ✅ `withdraw() external` (pull-over-push pattern)

**Task 1.2: Security Features** - ✅ COMPLETED
- ✅ Reentrancy guards (OpenZeppelin ReentrancyGuard)
- ✅ Access control (ADMIN_ROLE, PAUSE_ROLE)
- ✅ Minimum order amounts (100 MWG, 0.0001 BNB)
- ✅ Maximum order expiration (30 days)
- ✅ Safe math operations (Solidity 0.8.20)
- ✅ Input validation throughout
- ✅ CEI pattern enforced (Checks-Effects-Interactions)
- ✅ Pull-over-push pattern for BNB transfers (prevents locked funds)
- ✅ Self-fill prevention
- ✅ Fee protection (stored at order creation)
- ✅ Rounding exploit prevention
- ✅ DOS prevention (pagination)
- ✅ Grief attack prevention (1-hour grace period)
- ✅ MWG fee burning to dead address (0x...dEaD)

**Task 1.3: Testing** - ✅ COMPLETED
- Location: `test/MWGOrderBook.test.js`
- Test Coverage: 54 tests across 12 categories (100% pass rate)
- Test Cases:
  - ✅ Create buy order with BNB deposit
  - ✅ Create sell order with MWG deposit
  - ✅ Fill buy order successfully (complete & partial)
  - ✅ Fill sell order successfully (MWG fee burning validated)
  - ✅ Partial order fills (multiple fills on same order)
  - ✅ Cancel active order (BNB/MWG refunds)
  - ✅ Prevent double filling
  - ✅ Order expiration (with grace period testing)
  - ✅ Insufficient balance errors
  - ✅ Price calculation accuracy
  - ✅ Event emissions (all events tested)
  - ✅ Access control (admin functions)
  - ✅ Self-fill prevention
  - ✅ Fee change protection (feeAtCreation)
  - ✅ Pull-over-push withdrawal pattern
  - ✅ Rounding to zero prevention
  - ✅ Pagination DOS prevention

**Task 1.4: Deployment Script** - ✅ COMPLETED
- Location: `scripts/deploy-orderbook.js`, `scripts/verify-orderbook.js`
- Script Actions:
  - ✅ Deploy MWGOrderBook contract
  - ✅ Set MWG token address (from deployment files)
  - ✅ Configure minimum order amounts
  - ✅ Set fee parameters (0% initially)
  - ✅ Grant roles from environment variables (ORDER_BOOK_ADMIN_ADDRESS, ORDER_BOOK_PAUSE_ADDRESS)
  - ✅ Revoke deployer permissions (security)
  - ✅ Auto-verify on BSCScan
  - ✅ Save deployment info to `deployments/orderbook-{network}.json`

**Phase 1 Deliverables:**
- ✅ MWGOrderBook.sol contract (production-ready with all security features)
- ✅ Complete test suite (54 tests, 100% pass rate)
- ✅ Deployment script with role management
- ✅ Contract deployed to BSC testnet: `0xeD32ec534306c2474e2110EF0B1E79e655f45dDA`
- ✅ Contract verified (manual verification available if needed)
- ⏳ Contract deployed to BSC mainnet (pending Phase 2-6 completion)

---

#### Phase 2: Backend API Development (Days 3-4) - ⏳ PENDING (User Decision: Database API Implementation Required)

**IMPORTANT NOTE:** User has decided to pivot from blockchain event queries to database-backed API due to `useWatchContractEvent` limitation (only captures NEW events, not historical data). Backend API with event listener service is required before frontend can display historical orders and trades.

**Database API Implementation Plan:**

**1. Database Schema (MongoDB Collections)**
- `orders` collection:
  - Fields: orderId (indexed), txHash, user (indexed), orderType, mwgAmount, bnbAmount, pricePerMWG, filled, remaining, status, createdAt, expiresAt, feeAtCreation, blockNumber
  - Indexes: orderId (unique), user, status, orderType, createdAt
- `order_fills` collection:
  - Fields: fillId, orderId (indexed), filler (indexed), mwgAmount, bnbAmount, txHash, blockNumber, timestamp, fee
  - Indexes: orderId, filler, timestamp
- `order_withdrawals` collection:
  - Fields: withdrawalId, user (indexed), amount, amountType (BNB/MWG), txHash, blockNumber, timestamp
  - Indexes: user, timestamp

**2. Event Listener Service**
- Location: `api/src/orderbook/services/eventListener.js`
- Real-time service listening to MWGOrderBook contract events
- Event Handlers:
  - `handleOrderCreatedEvent()` - Insert into orders collection
  - `handleOrderFilledEvent()` - Insert into order_fills, update orders collection
  - `handleOrderCancelledEvent()` - Update orders status to cancelled
  - `handleWithdrawalClaimedEvent()` - Insert into order_withdrawals
- Features: Error handling, retry logic, checkpoint tracking, reconnection

**3. Database Models (Mongoose)**
- Location: `api/src/orderbook/models/`
- `Order.js` - Order schema with validation
- `OrderFill.js` - Fill schema with relationships
- `Withdrawal.js` - Withdrawal schema

**4. API Routes**
- Location: `api/src/routes/orderbook.js`
- Public Endpoints:
  - `GET /api/orderbook/orders` - Get active orders (paginated, filtered by type)
  - `GET /api/orderbook/orders/:orderId` - Get specific order details
  - `GET /api/orderbook/fills` - Get all fills (paginated, filtered)
  - `GET /api/orderbook/fills/:orderId` - Get fills for specific order
  - `GET /api/orderbook/stats` - Get order book statistics
  - `GET /api/orderbook/recent-activity` - Get recent events (limit parameter)
  - `GET /api/orderbook/best-prices` - Get best buy/sell prices
  - `GET /api/orderbook/user/:address/orders` - Get user's orders
- Admin Endpoints:
  - `GET /api/orderbook/admin/all-orders` - Get all orders with filters
  - `GET /api/orderbook/admin/analytics` - Detailed analytics
  - `POST /api/orderbook/admin/sync` - Trigger historical sync

**5. Service Layer**
- Location: `api/src/orderbook/services/orderBookService.js`
- Functions:
  - `getActiveOrders(orderType, limit, offset)` - Query active orders
  - `getOrderDetails(orderId)` - Get order with fill history
  - `getUserOrders(address, status)` - Get user's orders
  - `getOrderFills(orderId)` - Get fills for order
  - `getRecentActivity(limit)` - Get recent events across all types
  - `getOrderBookStats()` - Calculate statistics (total orders, volume, etc.)
  - `getBestPrices()` - Get best bid/ask from database

**6. Sync & Maintenance**
- Location: `api/src/orderbook/services/syncService.js`
- `syncHistoricalEvents(fromBlock, toBlock)` - Backfill historical events
- `updateExpiredOrders()` - Cron job to mark expired orders (runs every hour)
- `reconcileOrderStates()` - Verify database matches blockchain state
- Checkpoint tracking to resume interrupted syncs

**7. Utilities**
- Location: `api/src/orderbook/utils/`
- `formatters.js` - Format blockchain data for database
- `validators.js` - Validate API inputs
- `aggregations.js` - MongoDB aggregation pipelines for stats

**8. Configuration**
- Environment Variables:
  ```
  ORDERBOOK_CONTRACT_ADDRESS_TESTNET=0xe9Cd180b882830f9cbc9200eb40Ee2a5844649a6
  ORDERBOOK_CONTRACT_ADDRESS_MAINNET=<pending_deployment>
  ORDERBOOK_START_BLOCK_TESTNET=<deployment_block>
  BSC_TESTNET_RPC=<rpc_url>
  BSC_MAINNET_RPC=<rpc_url>
  ```
- Add to `api/contracts/abis/MWGOrderBook.json`

**9. Integration with Existing API**
- Add routes to main Express app
- Add event listener as background service (PM2 process)
- Add health check endpoint for monitoring
- Add logging integration

**10. Testing**
- Unit tests for models (validation, schema)
- Integration tests for API endpoints
- Event listener tests with mock events
- Historical sync tests

**Implementation Timeline: 7 Days**
- ✅ Day 1: Database Models & Schema (COMPLETED)
- ✅ Day 2: Event Listener Service (COMPLETED - with memory leak fixes & singleton pattern)
- ✅ Day 3: Service Layer (COMPLETED)
- ✅ Day 4: API Routes (COMPLETED)
- ⏳ Day 5: Integration with Express App (IN PROGRESS)
- Day 6: Testing
- Day 7: Deployment

**Phase 2 Status:**
- ✅ Day 1 Complete: Database models created (Order, OrderFill, Withdrawal, SyncCheckpoint) in `/api/src/models/`
- ✅ Day 2 Complete: Event listener service with real-time monitoring in `/api/src/services/`
  - OrderBookEventListener class for real-time event watching
  - **Memory leak fixes**: ✅ pollingIntervalId & reconnectTimeoutId tracking
  - **Singleton pattern**: ✅ Implemented via getInstance() static method
  - ❌ Sync service removed (not needed for fresh implementation)
- ✅ Day 3 Complete: Order book service layer with all business logic in `/api/src/services/orderBookService.js`
  - 15+ service methods for querying orders, fills, stats, analytics
- ✅ Day 4 Complete: API Routes in `/api/src/routes/orderbook.js`
  - 12 public endpoints for orders, fills, stats, prices, user data
  - 3 admin endpoints for search, analytics, sync
  - Input validation middleware in `/api/src/utils/validators.js`
- ⏳ Day 5 In Progress: Integration with Express App
  - ✅ Imported orderbook routes in server.js
  - ✅ Added /api/orderbook endpoint
  - ✅ OrderBookEventListener initialization on server start (conditional)
  - ✅ Graceful shutdown handler for event listener
  - ✅ Environment variables added to .env.example (ORDERBOOK_ENABLED, contract addresses, polling config)
  - ✅ Health check endpoint updated with orderbook listener status
  - ✅ Services index.js exports all services
  - ⏳ TODO: Test API endpoints
  - ⏳ TODO: Test event listener initialization
  - ⏳ TODO: Test graceful shutdown
- ⏳ Frontend development paused until backend API is ready
- ⏳ All implementation details documented above

---

#### Phase 3: Frontend Development (Days 5-7) - ✅ COMPLETED

**COMPLETION STATUS: 100% (13/13 major items completed)**

**Task 3.1: Order Book Page Structure** - ✅ COMPLETED
- Location: `frontend/src/app/orderbook/`
- Pages:
  - ✅ `/orderbook` - Main order book view (page.tsx created)
  - ✅ `/orderbook/create` - Create buy order (page.tsx created)
  - ✅ `/orderbook/my-orders` - User's orders (page.tsx created)
  - ✅ `/orderbook/trades` - Trade history (page.tsx created)
  - ✅ `/orderbook/admin` - Admin management (page.tsx created)

**Task 3.2: Shared Components** - ✅ COMPLETED
- Location: `frontend/src/components/orderbook/`
- ✅ `OrderBookDisplay.tsx` - Visual order book with bid/ask spread
- ✅ `CreateBuyOrderForm.tsx` - Client creates buy order with validations
- ✅ `OrderCard.tsx` - Display single order with action buttons
- ✅ `FillOrderModal.tsx` - Admin fills order (includes MWG approval flow)
- ✅ `TradeHistoryTable.tsx` - Display executed trades with filters

**Task 3.3: Custom Hooks** - ✅ COMPLETED
- Location: `frontend/src/hooks/orderbook/`
- ✅ `useOrderBook.ts` - 15+ hooks for fetching order book data, stats, prices, user orders
  - Hooks: useOrderBookStats, useActiveOrders, useBestBuyPrice, useBestSellPrice, useOrderBookPaused, useOrder, useUserOrders, usePendingWithdrawal, useOrderBookFee, useMinimumOrderAmounts, useUserOrderCount, and more
- ✅ `useOrderBookActions.ts` - 10+ hooks for transactions
  - Hooks: useCreateBuyOrder, useCreateSellOrder, useFillBuyOrder, useFillSellOrder, useCancelOrder, useWithdraw, useMWGBalance, useMWGAllowance, useApproveMWG, useSetFee, useSetMinimumAmounts, useSetPaused, and more
- ✅ `useOrderBookEvents.ts` - Event listeners with metadata
  - Hooks: useOrderCreatedEvents, useOrderFilledEvents, useOrderCancelledEvents, useWithdrawalClaimedEvents, useRecentActivity, useUserActivity
  - Note: Event hooks only capture NEW events from current block onwards (limitation discovered)
- ✅ `useOrderBookToasts.ts` - Toast notification utilities
  - Functions: showSuccessToast, showErrorToast, showInfoToast, showLoadingToast, handleTransactionToast, and more

**Task 3.4: Page Implementation** - ✅ COMPLETED

**Page 1: `/orderbook` - Main Order Book View** ✅
- ✅ Order book display component with bid/ask spread visualization
- ✅ Real-time order updates via event listeners (useRecentActivity)
- ✅ Best bid/ask price display with spread percentage
- ✅ Statistics cards (Active Orders, Buy Orders, Sell Orders, Spread)
- ✅ Recent activity feed with event type icons and timestamps
- ✅ Quick action buttons (Create Buy Order, My Orders, Trade History)
- ✅ Click-to-fill functionality via FillOrderModal
- ✅ Paused contract banner with warning message
- ✅ Connect wallet CTA for non-connected users
- ✅ Responsive design with Tailwind CSS

**Page 2: `/orderbook/create` - Create Buy Order** ✅
- ✅ Create buy order form with validations (MWG amount, price, expiry)
- ✅ BNB deposit auto-calculation based on price × amount
- ✅ Fee calculation and display (applied to MWG amount)
- ✅ Expiry time selector with presets (1 hour, 6 hours, 24 hours, 7 days, 30 days)
- ✅ Order preview section before confirmation
- ✅ Best sell price suggestion display
- ✅ Transaction status tracking with toast notifications
- ✅ Success/error notifications with auto-redirect to My Orders
- ✅ Input validation (minimum amounts, expiry limits)
- ✅ Loading states during transaction
- ✅ Responsive mobile design

**Page 3: `/orderbook/my-orders` - User's Orders** ✅
- ✅ Active orders list (user's open buy/sell orders)
- ✅ Order details cards with all information (ID, type, amounts, price, status, expiry)
- ✅ Cancel order functionality with confirmation modal
- ✅ Order status indicators with color coding (active, partially filled, expired, filled, cancelled)
- ✅ Filter/sort options via tabs (Active, Filled, Cancelled)
- ✅ Order history section for completed/cancelled orders
- ✅ Pending withdrawals section (pull-over-push pattern)
- ✅ Withdraw button for unclaimed BNB/MWG with toast feedback
- ✅ Countdown timers for order expiration
- ✅ Empty state messages for each tab
- ✅ Responsive card grid layout

**Page 4: `/orderbook/trades` - Trade History** ✅
- ✅ Recent fills table displaying all platform trades
- ✅ Fill details (Order ID, Filler, MWG Amount, BNB Amount, Price, Timestamp)
- ✅ Filter by tab (All Fills, My Fills as Filler, My Orders Filled)
- ✅ Real-time updates via useOrderFilledEvents
- ✅ Transaction links with copy-to-clipboard functionality
- ✅ BSCScan transaction link for each fill
- ✅ Address truncation with copy feature
- ✅ Responsive table design
- ✅ Empty state when no fills found
- ✅ Statistics cards (Total Fills, Total Volume MWG, Total Volume BNB)
- Note: Shows only NEW fills captured during session due to event watcher limitation

**Page 5: `/orderbook/admin` - Admin Management** ✅
- ✅ Role-based access control (simplified admin check via hasRole)
- ✅ Four-tab interface (Overview, Orders, Configuration, Emergency)
- ✅ **Overview Tab:**
  - Platform statistics (Total Orders, Active Buy/Sell, Total Fills, Total Volume)
  - Recent activity feed with real-time events
  - Quick action buttons
- ✅ **Orders Tab:**
  - All orders table (both buy and sell)
  - Filter by type (All, Buy, Sell) and status (All, Active, Filled, Cancelled, Expired)
  - Fill order button opening FillOrderModal
  - Emergency cancel order with confirmation
  - Order details display with all fields
- ✅ **Configuration Tab:**
  - Fee configuration panel (update 0-10% fee with validation)
  - Minimum order amounts configuration (MWG & BNB)
  - Pause/unpause contract toggle with confirmation
  - Current settings display
- ✅ **Emergency Tab:**
  - Emergency controls with warnings
  - Pause contract functionality
  - Emergency cancel order capability
  - Status indicators
- ✅ Toast notifications throughout all actions
- ✅ Loading states for all operations
- ✅ Error handling and validation
- ✅ Responsive design

**Task 3.5: Real-time Updates** - ✅ COMPLETED
- ✅ Event listeners using wagmi's useWatchContractEvent
- ✅ New order creation notifications via toast
- ✅ Order fill notifications with details
- ✅ Real-time activity feed on main page
- ✅ Auto-refresh of order lists on events
- ⚠️ **Limitation Discovered:** Event watchers only capture NEW events from current block onwards, not historical events
- 💡 **Solution Required:** Database API implementation (see Phase 2)

**Task 3.6: Navigation Integration** - ✅ COMPLETED
- ✅ Added 5 order book links to SideNav component:
  - `/orderbook` - Order Book (public)
  - `/orderbook/create` - Create Order (public)
  - `/orderbook/my-orders` - My Orders (public)
  - `/orderbook/trades` - Trades (public)
  - `/orderbook/admin` - Admin (admin only)
- ✅ ORDER_BOOK contract address configured in `frontend/src/config/contracts.ts`
- ✅ ORDER_BOOK_CONFIG constants defined (MAX_BATCH_SIZE, MIN_MWG_ORDER, MIN_BNB_ORDER, etc.)
- ✅ ABI file present at `/frontend/src/abis/MWGOrderBook.json`
- ✅ Updated `.env.example` with NEXT_PUBLIC_ORDER_BOOK_ADDRESS
- ✅ Icons added for each navigation link

**Phase 3 Deliverables - ALL COMPLETED:**
- ✅ 5 complete pages with full functionality (100%)
- ✅ 5 shared components with toast integration (100%)
- ✅ 25+ custom hooks across 4 files (100%)
- ✅ Real-time updates via event listeners (100%)
- ✅ Mobile responsive design with Tailwind CSS (100%)
- ✅ Comprehensive loading states & error handling (100%)
- ✅ Toast notifications throughout all components (100%)
- ✅ Role-based access control for admin pages (100%)
- ✅ Zero TypeScript compilation errors (100%)
- ✅ Navigation fully integrated (100%)

**Frontend Implementation Summary:**

**Total Components Created:** 10
1. `/app/orderbook/page.tsx` - Main order book page
2. `/app/orderbook/create/page.tsx` - Create buy order page
3. `/app/orderbook/my-orders/page.tsx` - My orders page
4. `/app/orderbook/trades/page.tsx` - Trade history page
5. `/app/orderbook/admin/page.tsx` - Admin dashboard page
6. `/components/orderbook/OrderBookDisplay.tsx` - Order book visualization
7. `/components/orderbook/CreateBuyOrderForm.tsx` - Buy order form
8. `/components/orderbook/OrderCard.tsx` - Order display card
9. `/components/orderbook/FillOrderModal.tsx` - Fill order modal with MWG approval
10. `/components/orderbook/TradeHistoryTable.tsx` - Trade history table

**Total Hooks Created:** 4 files (25+ individual hooks)
1. `/hooks/orderbook/useOrderBook.ts` - Data fetching hooks
2. `/hooks/orderbook/useOrderBookActions.ts` - Transaction hooks
3. `/hooks/orderbook/useOrderBookEvents.ts` - Event listener hooks
4. `/hooks/orderbook/useOrderBookToasts.ts` - Toast notification helpers

**Key Features Implemented:**
- ✅ Complete order lifecycle (create, view, fill, cancel)
- ✅ Two-step approval flow for filling buy orders (approve MWG → fill)
- ✅ Real-time event notifications
- ✅ Pending withdrawal management (pull-over-push pattern)
- ✅ Admin controls with role validation
- ✅ Comprehensive error handling
- ✅ Mobile-first responsive design
- ✅ Toast notifications for all user actions
- ✅ Transaction status tracking
- ✅ Order expiration countdowns
- ✅ Best price suggestions
- ✅ Fee calculations and displays

**Known Limitations & Required Next Steps:**
- ⚠️ Event watchers only capture NEW events (not historical)
- ⚠️ Recent Activity and Trade History show empty for past events
- 💡 **Solution:** Phase 2 Database API implementation required
- 💡 **Blocker:** Frontend cannot display historical data until backend API with event listener is deployed
- 📋 **Action Item:** Proceed with Phase 2 implementation (7-day plan documented)

**Testing Notes:**
- ✅ All pages load without errors
- ✅ All components render correctly
- ✅ All hooks function properly
- ✅ Wallet connection working
- ✅ Transaction submissions working
- ✅ Event listeners capturing new events
- ⏳ Historical data retrieval pending backend API
- ⏳ End-to-end fill order flow tested (requires MWG tokens)

**Phase 3 Final Status: ✅ COMPLETED (100%)**
- All 13 major deliverables completed
- Frontend fully functional for real-time operations
- Ready for Phase 2 backend API integration
- No blocking issues (historical data limitation known and documented)

---

#### Phase 4: Integration & Testing (Day 8) - ❌ NOT STARTED

**Task 4.1: End-to-End Testing** - ❌
- ❌ Scenario 1: Client creates & admin fills
- ❌ Scenario 2: Admin creates & client fills
- ❌ Scenario 3: Partial fills
- ❌ Scenario 4: Order cancellation
- ❌ Scenario 5: Order expiration

**Task 4.2: Security Testing** - ❌
- ❌ Reentrancy attack prevention
- ❌ Integer overflow/underflow
- ❌ Unauthorized access tests
- ❌ Double-spend prevention
- ❌ Front-running mitigation

**Task 4.3: Performance Testing** - ❌
- ❌ Order book with 1000+ orders
- ❌ Multiple simultaneous fills
- ❌ Event listener under load
- ❌ API response times
- ❌ Frontend rendering performance

**Phase 4 Deliverables:**
- ❌ All test scenarios passed
- ❌ Security audit completed
- ❌ Performance benchmarks met

---

#### Phase 5: Deployment & Documentation (Day 9) - ❌ NOT STARTED

**Task 5.1: Smart Contract Deployment** - ❌
- ❌ Deploy to BSC testnet
- ❌ Verify on BSCScan (testnet)
- ❌ Integration testing
- ❌ Deploy to BSC mainnet
- ❌ Verify on BSCScan (mainnet)

**Task 5.2: Backend Deployment** - ❌
- ❌ Add contract ABI
- ❌ Update environment variables
- ❌ Deploy to Railway
- ❌ Start event listener service
- ❌ Verify API endpoints

**Task 5.3: Frontend Deployment** - ❌
- ❌ Update contract addresses
- ❌ Build production bundle
- ❌ Deploy to hosting
- ❌ Test on production

**Task 5.4: Documentation** - ❌
- ❌ Client user guide
- ❌ Admin user guide
- ❌ Developer documentation
- ❌ API documentation

**Phase 5 Deliverables:**
- ❌ Contracts deployed to mainnet
- ❌ Backend deployed and running
- ❌ Frontend deployed and accessible
- ❌ Complete documentation

---

#### Phase 6: Monitoring & Optimization (Day 10) - ❌ NOT STARTED

**Task 6.1: Monitoring Setup** - ❌
- ❌ Smart contract monitoring
- ❌ Backend monitoring
- ❌ Frontend monitoring

**Task 6.2: Analytics Dashboard** - ❌
- ❌ Order metrics
- ❌ Trade volume tracking
- ❌ Price trend analysis
- ❌ User activity monitoring

**Task 6.3: Optimization** - ❌
- ❌ Gas optimization
- ❌ Database optimization
- ❌ Frontend optimization

**Phase 6 Deliverables:**
- ❌ Monitoring dashboards active
- ❌ Analytics tracking
- ❌ Performance optimizations applied

---

### File Structure

```
contracts/
├── MWGOrderBook.sol                    # ✅ CREATED
└── interfaces/
    └── IMWGOrderBook.sol               # ⏳ PENDING

scripts/
├── deploy-orderbook.js                 # ✅ CREATED
└── verify-orderbook.js                 # ✅ CREATED

test/
└── MWGOrderBook.test.js                # ✅ CREATED (54 tests passing)

deployments/
└── orderbook-bscTestnet.json           # ✅ CREATED

api/src/orderbook/
├── models/
│   ├── Order.js                        # ❌ NOT CREATED
│   └── Trade.js                        # ❌ NOT CREATED
├── services/
│   ├── orderBookService.js             # ❌ NOT CREATED
│   └── eventListener.js                # ❌ NOT CREATED
├── routes/
│   └── orderbook.js                    # ❌ NOT CREATED
└── contracts/
    ├── MWGOrderBook.json               # ❌ NOT CREATED
    └── orderBookContract.js            # ❌ NOT CREATED

frontend/src/
├── app/orderbook/
│   ├── page.tsx                        # ❌ NOT CREATED
│   ├── create/
│   │   └── page.tsx                    # ❌ NOT CREATED
│   ├── my-orders/
│   │   └── page.tsx                    # ❌ NOT CREATED
│   ├── trades/
│   │   └── page.tsx                    # ❌ NOT CREATED
│   └── admin/
│       └── page.tsx                    # ❌ NOT CREATED
├── components/orderbook/
│   ├── OrderBookDisplay.tsx            # ❌ NOT CREATED
│   ├── CreateBuyOrderForm.tsx          # ❌ NOT CREATED
│   ├── OrderCard.tsx                   # ❌ NOT CREATED
│   ├── FillOrderModal.tsx              # ❌ NOT CREATED
│   └── TradeHistoryTable.tsx           # ❌ NOT CREATED
└── hooks/orderbook/
    ├── useOrderBook.ts                 # ❌ NOT CREATED
    ├── useOrderBookActions.ts          # ❌ NOT CREATED
    └── useOrderBookEvents.ts           # ❌ NOT CREATED

docs/
└── ORDERBOOK_IMPLEMENTATION_PLAN.md    # ✅ CREATED
```

### Success Criteria

**Smart Contract:**
- ❌ Deployed to BSC mainnet
- ❌ Verified on BSCScan
- ❌ All tests passing
- ❌ Security audit clean
- ❌ Gas costs optimized

**Backend:**
- ❌ Event listener syncing in real-time
- ❌ API response time < 200ms
- ❌ 99.9% uptime
- ❌ All endpoints documented
- ❌ Error handling robust

**Frontend:**
- ❌ Mobile responsive
- ❌ Intuitive UX
- ❌ Fast load times (< 2s)
- ❌ Real-time updates working
- ❌ Transaction confirmations clear

**Business Goals:**
- ❌ Zero slippage payments
- ❌ Transparent pricing
- ❌ Client self-service enabled
- ❌ Admin workflow streamlined
- ❌ Cost savings vs AMM documented

---

**Last Updated:** November 20, 2025  
**Overall Progress:** 16.7% (1/6 phases complete)  
**Current Phase:** Phase 1 - ✅ COMPLETED  
**Next Task:** Phase 2 - Backend API Development

**Phase 1 Summary:**
- ✅ Smart contract created with all security features (CEI, pull-over-push, self-fill prevention, fee protection, pagination, grief prevention)
- ✅ 54 tests passing (100% pass rate)
- ✅ Deployed to BSC Testnet: `0xeD32ec534306c2474e2110EF0B1E79e655f45dDA`
- ✅ Admin permissions properly configured and deployer revoked
- ✅ Contract verification complete (manual verification available)
- ✅ Phase 1 FULLY COMPLETE - Ready for Phase 2

**Phase 3 Frontend Preview:**
- 5 pages total: Main Order Book, Create Order, My Orders, Trade History, Admin Dashboard
- 5 shared components: OrderBookDisplay, CreateBuyOrderForm, OrderCard, FillOrderModal, TradeHistoryTable
- 3 custom hooks: useOrderBook, useOrderBookActions, useOrderBookEvents
- Total: 13 major frontend work items
