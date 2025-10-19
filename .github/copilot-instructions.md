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
