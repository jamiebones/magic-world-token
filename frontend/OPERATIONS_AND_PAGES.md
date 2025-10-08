# Magic World Token - Contract Operations & Page Design

## Overview
This document lists all read and write operations available for the three smart contracts and provides design recommendations for implementing them in the Next.js frontend.

---

## 1. MagicWorldToken Contract

### Read Operations (No Gas Required)

| Function | Parameters | Returns | Description | UI Component |
|----------|-----------|---------|-------------|--------------|
| `name()` | None | `string` | Token name | Display in header/info card |
| `symbol()` | None | `string` | Token symbol | Display in header/info card |
| `decimals()` | None | `uint8` | Token decimals | Internal calculation |
| `totalSupply()` | None | `uint256` | Total token supply | Stats dashboard |
| `balanceOf(address)` | `address owner` | `uint256` | Token balance of address | Wallet balance display |
| `allowance(address,address)` | `address owner, address spender` | `uint256` | Approved spending amount | Approval management |
| `paused()` | None | `bool` | Contract pause status | Status indicator |
| `getMaxBatchSize()` | None | `uint256` | Maximum batch size | Batch operation UI |
| `hasRole(bytes32,address)` | `bytes32 role, address account` | `bool` | Check if address has role | Admin panel |
| `getRoleAdmin(bytes32)` | `bytes32 role` | `bytes32` | Get admin role for a role | Admin panel |

### Write Operations (Requires Gas & Signatures)

| Function | Parameters | Gas Impact | Required Role | Description | UI Component |
|----------|-----------|------------|---------------|-------------|--------------|
| `transfer(address,uint256)` | `address to, uint256 amount` | Medium | None | Transfer tokens | Transfer form |
| `approve(address,uint256)` | `address spender, uint256 amount` | Low | None | Approve spending | Approval form |
| `transferFrom(address,address,uint256)` | `address from, address to, uint256 amount` | Medium | None (with allowance) | Transfer on behalf | Advanced transfer |
| `batchTransfer(address[],uint256[])` | `address[] recipients, uint256[] amounts` | High | GAME_OPERATOR_ROLE | Batch transfer different amounts | Admin batch tool |
| `batchTransferEqual(address[],uint256)` | `address[] recipients, uint256 amount` | High | GAME_OPERATOR_ROLE | Batch transfer same amount | Admin batch tool |
| `pause()` | None | Low | PAUSE_ROLE | Pause contract | Admin emergency panel |
| `unpause()` | None | Low | PAUSE_ROLE | Unpause contract | Admin emergency panel |
| `grantRole(bytes32,address)` | `bytes32 role, address account` | Low | DEFAULT_ADMIN_ROLE | Grant role to address | Admin role management |
| `revokeRole(bytes32,address)` | `bytes32 role, address account` | Low | DEFAULT_ADMIN_ROLE | Revoke role from address | Admin role management |
| `transferAdmin(address)` | `address newAdmin` | Low | DEFAULT_ADMIN_ROLE | Transfer admin role | Admin transfer panel |

**Role Constants:**
- `DEFAULT_ADMIN_ROLE`: `0x00` (master admin)
- `GAME_OPERATOR_ROLE`: `keccak256("GAME_OPERATOR_ROLE")`
- `PAUSE_ROLE`: `keccak256("PAUSE_ROLE")`

---

## 2. MagicWorldGame Contract

### Read Operations (No Gas Required)

| Function | Parameters | Returns | Description | UI Component |
|----------|-----------|---------|-------------|--------------|
| `magicWorldToken()` | None | `address` | Token contract address | Info display |
| `dailyRewardLimit()` | None | `uint256` | Daily reward limit per player | Stats dashboard |
| `maxBatchSize()` | None | `uint256` | Maximum batch size | Config display |
| `cooldownPeriod()` | None | `uint256` | Cooldown period in seconds | Config display |
| `totalRewardsDistributed()` | None | `uint256` | Total rewards distributed | Stats dashboard |
| `totalPlayersRewarded()` | None | `uint256` | Total unique players | Stats dashboard |
| `currentDay()` | None | `uint256` | Current day counter | Stats display |
| `vaultsInitialized()` | None | `bool` | Vault initialization status | Status indicator |
| `vaults(AllocationType)` | `uint8 vaultType` | `(uint256,uint256,uint256)` | Vault details | Vault dashboard |
| `getPlayerStats(address)` | `address player` | `(uint256,uint256,uint256)` | Player statistics | Player profile |
| `getContractStats()` | None | `(uint256,uint256,uint256)` | Contract statistics | Stats dashboard |
| `getVaultInfo(AllocationType)` | `uint8 vaultType` | `(uint256,uint256,uint256)` | Single vault info | Vault detail view |
| `getAllVaultStats()` | None | `(tuple,tuple,tuple,tuple)` | All vault statistics | Vault overview |
| `isDistributor(address)` | `address account` | `bool` | Check distributor role | Role checker |
| `isGameAdmin(address)` | `address account` | `bool` | Check admin role | Role checker |
| `dailyRewardsReceived(address)` | `address player` | `uint256` | Daily rewards received | Player stats |
| `totalRewardsEarned(address)` | `address player` | `uint256` | Total rewards earned | Player stats |
| `lastMajorReward(address)` | `address player` | `uint256` | Last major reward timestamp | Player stats |

### Write Operations (Requires Gas & Signatures)

| Function | Parameters | Gas Impact | Required Role | Description | UI Component |
|----------|-----------|------------|---------------|-------------|--------------|
| `initializeVaults(uint256,uint256)` | `uint256 totalSupply, uint256 partnerAllocation` | Medium | DEFAULT_ADMIN_ROLE | Initialize vaults once | Setup wizard |
| `distributeFromVault(uint8,address[],uint256[],string)` | `AllocationType vaultType, address[] recipients, uint256[] amounts, string reason` | Very High | REWARD_DISTRIBUTOR_ROLE | Distribute rewards | Reward distribution form |
| `distributeEqualFromVault(uint8,address[],uint256,string)` | `AllocationType vaultType, address[] recipients, uint256 amount, string reason` | Very High | REWARD_DISTRIBUTOR_ROLE | Distribute equal rewards | Reward distribution form |
| `burnForPurchase(uint256,uint256)` | `uint256 amount, uint256 itemId` | Medium | None | Burn tokens for in-game item | In-game shop |
| `setDailyRewardLimit(uint256)` | `uint256 newLimit` | Low | GAME_ADMIN_ROLE | Update daily limit | Admin config panel |
| `setMaxBatchSize(uint256)` | `uint256 newSize` | Low | GAME_ADMIN_ROLE | Update max batch size | Admin config panel |
| `setCooldownPeriod(uint256)` | `uint256 newPeriod` | Low | GAME_ADMIN_ROLE | Update cooldown period | Admin config panel |
| `emergencyWithdraw(uint256)` | `uint256 amount` | Medium | DEFAULT_ADMIN_ROLE | Emergency withdraw | Admin emergency panel |
| `pause()` | None | Low | GAME_ADMIN_ROLE | Pause contract | Admin emergency panel |
| `unpause()` | None | Low | GAME_ADMIN_ROLE | Unpause contract | Admin emergency panel |
| `grantDistributorRole(address)` | `address account` | Low | DEFAULT_ADMIN_ROLE | Grant distributor role | Admin role management |
| `revokeDistributorRole(address)` | `address account` | Low | DEFAULT_ADMIN_ROLE | Revoke distributor role | Admin role management |
| `grantGameAdminRole(address)` | `address account` | Low | DEFAULT_ADMIN_ROLE | Grant game admin role | Admin role management |
| `revokeGameAdminRole(address)` | `address account` | Low | DEFAULT_ADMIN_ROLE | Revoke game admin role | Admin role management |
| `transferAdmin(address)` | `address newAdmin` | Low | DEFAULT_ADMIN_ROLE | Transfer admin role | Admin transfer panel |

**AllocationType Enum:**
- `PLAYER_TASKS`: `0` (50% allocation)
- `SOCIAL_FOLLOWERS`: `1` (5% allocation)
- `SOCIAL_POSTERS`: `2` (15% allocation)
- `ECOSYSTEM_FUND`: `3` (30% allocation)

---

## 3. PartnerVault Contract

### Read Operations (No Gas Required)

| Function | Parameters | Returns | Description | UI Component |
|----------|-----------|---------|-------------|--------------|
| `token()` | None | `address` | Token contract address | Info display |
| `LOCKUP_PERIOD()` | None | `uint256` | Lockup period (3 years) | Info display |
| `totalAllocated()` | None | `uint256` | Total allocated tokens | Stats display |
| `partnerAllocations(address)` | `address partner` | `(uint256,uint256,bool)` | Raw allocation data | Partner dashboard |
| `getPartnerAllocation(address)` | `address partner` | `(uint256,uint256,bool,uint256)` | Detailed allocation info | Partner profile |
| `getWithdrawableAmount(address)` | `address partner` | `uint256` | Withdrawable amount | Withdrawal button |
| `getTotalAllocated()` | None | `uint256` | Total allocated | Stats dashboard |
| `getVaultBalance()` | None | `uint256` | Current vault balance | Stats dashboard |
| `paused()` | None | `bool` | Contract pause status | Status indicator |
| `hasRole(bytes32,address)` | `bytes32 role, address account` | `bool` | Check role | Role checker |

### Write Operations (Requires Gas & Signatures)

| Function | Parameters | Gas Impact | Required Role | Description | UI Component |
|----------|-----------|------------|---------------|-------------|--------------|
| `allocateToPartner(address,uint256)` | `address partner, uint256 amount` | Medium | ADMIN_ROLE | Allocate to partner | Admin allocation form |
| `withdraw()` | None | Medium | None (partner only) | Withdraw after lockup | Partner withdrawal button |
| `emergencyWithdraw(address)` | `address partner` | Medium | ADMIN_ROLE (when paused) | Emergency withdraw for partner | Admin emergency panel |
| `pause()` | None | Low | ADMIN_ROLE | Pause contract | Admin emergency panel |
| `unpause()` | None | Low | ADMIN_ROLE | Unpause contract | Admin emergency panel |
| `grantRole(bytes32,address)` | `bytes32 role, address account` | Low | DEFAULT_ADMIN_ROLE | Grant role | Admin role management |
| `revokeRole(bytes32,address)` | `bytes32 role, address account` | Low | DEFAULT_ADMIN_ROLE | Revoke role | Admin role management |

**Role Constants:**
- `DEFAULT_ADMIN_ROLE`: `0x00`
- `ADMIN_ROLE`: `keccak256("ADMIN_ROLE")`

---

## Page Structure Design

### Recommended Page Architecture

```
/                          → Home/Dashboard
├── /wallet               → Wallet Management
│   ├── /balance         → View balances
│   ├── /transfer        → Transfer tokens
│   └── /approve         → Manage approvals
│
├── /game                 → Game Contract Operations
│   ├── /vaults          → Vault overview & stats
│   ├── /player-stats    → Player statistics
│   ├── /shop            → Burn tokens for items
│   └── /admin           → Admin operations (role-gated)
│       ├── /distribute  → Distribute rewards
│       ├── /config      → Update settings
│       └── /roles       → Role management
│
├── /partners             → Partner Vault Operations
│   ├── /dashboard       → Partner allocation info
│   ├── /withdraw        → Withdraw after lockup
│   └── /admin           → Admin operations (role-gated)
│       └── /allocate    → Allocate to partners
│
└── /admin                → Global Admin Panel
    ├── /overview        → All contracts overview
    ├── /emergency       → Emergency controls
    └── /roles           → Cross-contract roles
```

### Page Design Details

#### 1. Home Dashboard (`/`)
**Purpose:** Overview of entire ecosystem  
**Components:**
- Connected wallet info
- Token balance card
- Quick stats (total supply, rewards distributed, vaults)
- Contract status indicators
- Quick action buttons

**Read Operations:**
- `MagicWorldToken.balanceOf(userAddress)`
- `MagicWorldToken.totalSupply()`
- `MagicWorldGame.getContractStats()`
- `MagicWorldGame.getAllVaultStats()`
- `PartnerVault.getTotalAllocated()`

#### 2. Wallet Pages (`/wallet/*`)

##### `/wallet/balance`
**Purpose:** View detailed token balances and allowances  
**Components:**
- Token balance display
- Allowances list
- Recent transactions
- Transfer history

**Read Operations:**
- `MagicWorldToken.balanceOf(userAddress)`
- `MagicWorldToken.allowance(userAddress, spenderAddress)`

##### `/wallet/transfer`
**Purpose:** Transfer tokens to other addresses  
**Components:**
- Recipient address input
- Amount input (with balance validation)
- Transfer button
- Transaction status

**Write Operations:**
- `MagicWorldToken.transfer(to, amount)`

**Implementation:**
```typescript
// Use wagmi's useWriteContract hook
const { writeContract } = useWriteContract();

const handleTransfer = async (to: string, amount: bigint) => {
  await writeContract({
    address: CONTRACT_ADDRESSES.token,
    abi: MagicWorldTokenABI,
    functionName: 'transfer',
    args: [to, amount],
  });
};
```

##### `/wallet/approve`
**Purpose:** Manage spending approvals  
**Components:**
- Spender address input
- Amount input
- Current allowance display
- Approve/Revoke buttons

**Write Operations:**
- `MagicWorldToken.approve(spender, amount)`

#### 3. Game Contract Pages (`/game/*`)

##### `/game/vaults`
**Purpose:** Overview of all allocation vaults  
**Components:**
- 4 vault cards (Player Tasks, Social Followers, Social Posters, Ecosystem)
- Progress bars showing spent vs remaining
- Percentage allocations
- Real-time updates

**Read Operations:**
- `MagicWorldGame.getAllVaultStats()`
- `MagicWorldGame.vaultsInitialized()`

**Design:**
```typescript
// Vault card component
interface VaultCardProps {
  type: 'PLAYER_TASKS' | 'SOCIAL_FOLLOWERS' | 'SOCIAL_POSTERS' | 'ECOSYSTEM_FUND';
  totalAllocated: bigint;
  spent: bigint;
  remaining: bigint;
}

// Grid layout showing all 4 vaults
// Each card displays:
// - Vault name
// - Total allocated
// - Spent amount (with %)
// - Remaining amount (with %)
// - Progress bar visualization
```

##### `/game/player-stats`
**Purpose:** View player reward statistics  
**Components:**
- Current user stats card
- Search for other players
- Daily rewards received
- Total rewards earned
- Last reward timestamp
- Daily limit progress bar

**Read Operations:**
- `MagicWorldGame.getPlayerStats(playerAddress)`
- `MagicWorldGame.dailyRewardsReceived(playerAddress)`
- `MagicWorldGame.totalRewardsEarned(playerAddress)`
- `MagicWorldGame.dailyRewardLimit()`

##### `/game/shop`
**Purpose:** Burn tokens to purchase in-game items  
**Components:**
- Item catalog (could be fetched from API)
- Item cards with price and details
- Purchase button (burns tokens)
- Transaction confirmation modal

**Write Operations:**
- `MagicWorldToken.approve(gameContract, amount)` (first)
- `MagicWorldGame.burnForPurchase(amount, itemId)`

**Implementation:**
```typescript
// Two-step process
// 1. Approve game contract to spend tokens
const handleApprove = async (amount: bigint) => {
  await writeContract({
    address: CONTRACT_ADDRESSES.token,
    abi: MagicWorldTokenABI,
    functionName: 'approve',
    args: [CONTRACT_ADDRESSES.game, amount],
  });
};

// 2. Burn tokens for purchase
const handlePurchase = async (amount: bigint, itemId: bigint) => {
  await writeContract({
    address: CONTRACT_ADDRESSES.game,
    abi: MagicWorldGameABI,
    functionName: 'burnForPurchase',
    args: [amount, itemId],
  });
};
```

##### `/game/admin/distribute`
**Purpose:** Distribute rewards from vaults (role-gated)  
**Access:** REWARD_DISTRIBUTOR_ROLE only  
**Components:**
- Vault selector dropdown
- Recipient list (CSV upload or manual entry)
- Amount input (individual or equal for all)
- Reason text field
- Vault balance check
- Distribution button

**Read Operations:**
- `MagicWorldGame.getVaultInfo(vaultType)`
- `MagicWorldGame.isDistributor(userAddress)`

**Write Operations:**
- `MagicWorldGame.distributeFromVault(vaultType, recipients, amounts, reason)`
- `MagicWorldGame.distributeEqualFromVault(vaultType, recipients, amount, reason)`

##### `/game/admin/config`
**Purpose:** Update game configuration (role-gated)  
**Access:** GAME_ADMIN_ROLE only  
**Components:**
- Daily reward limit input
- Max batch size input
- Cooldown period input
- Save buttons for each setting

**Write Operations:**
- `MagicWorldGame.setDailyRewardLimit(newLimit)`
- `MagicWorldGame.setMaxBatchSize(newSize)`
- `MagicWorldGame.setCooldownPeriod(newPeriod)`

##### `/game/admin/roles`
**Purpose:** Manage roles for game contract  
**Access:** DEFAULT_ADMIN_ROLE only  
**Components:**
- Address input
- Role selector (Distributor, Game Admin)
- Grant/Revoke buttons
- Current role holders list

**Write Operations:**
- `MagicWorldGame.grantDistributorRole(account)`
- `MagicWorldGame.revokeDistributorRole(account)`
- `MagicWorldGame.grantGameAdminRole(account)`
- `MagicWorldGame.revokeGameAdminRole(account)`

#### 4. Partner Vault Pages (`/partners/*`)

##### `/partners/dashboard`
**Purpose:** View partner allocation details  
**Components:**
- Allocation info card
- Allocated amount
- Allocation date
- Withdrawable date (3 years later)
- Countdown timer to unlock
- Withdrawal status
- Withdraw button (enabled after lockup)

**Read Operations:**
- `PartnerVault.getPartnerAllocation(userAddress)`
- `PartnerVault.getWithdrawableAmount(userAddress)`
- `PartnerVault.LOCKUP_PERIOD()`

##### `/partners/withdraw`
**Purpose:** Withdraw allocated tokens after lockup  
**Components:**
- Eligibility check display
- Withdrawable amount
- Countdown timer (if not eligible yet)
- Withdraw button
- Transaction confirmation

**Read Operations:**
- `PartnerVault.getWithdrawableAmount(userAddress)`

**Write Operations:**
- `PartnerVault.withdraw()`

**Implementation:**
```typescript
const handleWithdraw = async () => {
  await writeContract({
    address: CONTRACT_ADDRESSES.partnerVault,
    abi: PartnerVaultABI,
    functionName: 'withdraw',
  });
};
```

##### `/partners/admin/allocate`
**Purpose:** Allocate tokens to partners (role-gated)  
**Access:** ADMIN_ROLE only  
**Components:**
- Partner address input
- Amount input
- Allocation button
- Existing allocations list
- Total allocated display

**Read Operations:**
- `PartnerVault.getTotalAllocated()`
- `PartnerVault.getVaultBalance()`

**Write Operations:**
- `PartnerVault.allocateToPartner(partner, amount)`

#### 5. Global Admin Pages (`/admin/*`)

##### `/admin/overview`
**Purpose:** Cross-contract administrative overview  
**Access:** DEFAULT_ADMIN_ROLE on any contract  
**Components:**
- All contracts status
- Pause state indicators
- Role assignments across contracts
- Quick actions panel

**Read Operations:**
- `MagicWorldToken.paused()`
- `MagicWorldGame.paused()`
- `PartnerVault.paused()`
- Role checks on all contracts

##### `/admin/emergency`
**Purpose:** Emergency controls for all contracts  
**Access:** Appropriate admin roles  
**Components:**
- Pause/Unpause buttons for each contract
- Emergency withdraw from Game contract
- Status indicators
- Confirmation modals

**Write Operations:**
- `MagicWorldToken.pause()` / `unpause()`
- `MagicWorldGame.pause()` / `unpause()`
- `PartnerVault.pause()` / `unpause()`
- `MagicWorldGame.emergencyWithdraw(amount)`
- `PartnerVault.emergencyWithdraw(partner)` (when paused)

---

## Implementation Priority

### Phase 1: Essential User Features
1. Home dashboard with basic stats
2. Wallet balance display
3. Token transfer functionality
4. Vault overview page
5. Player stats page

### Phase 2: Partner Features
1. Partner dashboard with allocation info
2. Withdrawal functionality with countdown timer
3. Partner admin allocation page

### Phase 3: Game Operations
1. In-game shop (burn for purchase)
2. Player statistics detailed view
3. Vault detailed monitoring

### Phase 4: Administrative Features
1. Reward distribution interface
2. Game configuration panel
3. Role management across contracts
4. Emergency controls panel

### Phase 5: Advanced Features
1. Batch operations UI
2. Transaction history tracking
3. Real-time event monitoring
4. Analytics dashboards
5. CSV upload for bulk operations

---

## Technical Implementation Notes

### Custom Hooks to Create

```typescript
// Token contract hooks
useTokenBalance(address)
useTokenAllowance(owner, spender)
useTransfer()
useApprove()
useBatchTransfer() // Admin only

// Game contract hooks
useVaultStats()
usePlayerStats(address)
useDistributeRewards() // Role-gated
useBurnForPurchase()
useGameConfig()
useUpdateGameConfig() // Admin only

// Partner vault hooks
usePartnerAllocation(address)
useWithdrawableAmount(address)
usePartnerWithdraw()
useAllocateToPartner() // Admin only

// Role checking hooks
useHasRole(contractAddress, role, account)
useIsDistributor(address)
useIsGameAdmin(address)
useIsPartnerAdmin(address)
```

### State Management Considerations

- Use React Query for caching read operations
- Implement optimistic updates for write operations
- Add transaction status tracking
- Store recent transactions in local storage
- Implement error handling with user-friendly messages

### Security Considerations

- Always validate user has required role before showing admin UI
- Disable buttons when user lacks permissions
- Show clear error messages for failed transactions
- Implement transaction confirmation modals for critical operations
- Add gas estimation before transactions
- Validate inputs before sending transactions

---

## Next Steps

1. Create custom hooks for contract interactions
2. Build reusable UI components (VaultCard, StatsCard, etc.)
3. Implement role-based route protection
4. Add transaction notification system
5. Create admin panels with appropriate access control
6. Add comprehensive error handling
7. Implement loading states and skeletons
8. Add transaction history tracking
9. Create responsive layouts for all pages
10. Add comprehensive testing
