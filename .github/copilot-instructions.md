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
