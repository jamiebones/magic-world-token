# Merkle Distribution Frontend

This frontend provides a user-friendly interface for managing and claiming Merkle tree-based token distributions.

## Features

### For Users
- **View Eligible Distributions**: See all distributions you're eligible for
- **Check Allocation**: View your token allocation for each distribution
- **Generate Merkle Proof**: Get cryptographic proof to claim tokens on-chain
- **Track Status**: Monitor claim status and distribution timeline

### For Admins
- **Create Distributions**: Set up new gas-efficient token distributions
- **Manage Distributions**: View and monitor all distributions
- **Sync from Blockchain**: Update distribution data from on-chain state
- **View Distribution Leaves**: Inspect all allocations in a distribution

## Pages

### Public Pages

#### `/distributions`
- Lists all distributions the connected wallet is eligible for
- Shows distribution status, amounts, and timelines
- Requires wallet connection

#### `/distributions/[id]`
- Detailed view of a specific distribution
- Shows eligibility status and allocation
- Allows generating Merkle proof for claiming
- Displays timeline and progress

### Admin Pages

#### `/admin/merkle`
- Lists all distributions (admin view)
- Filter by status and vault type
- Quick access to create new distributions

#### `/admin/merkle/create`
- Form to create new distributions
- CSV-style allocation input
- Real-time validation
- Supports all vault types (PLAYER_TASKS, SOCIAL_FOLLOWERS, SOCIAL_POSTERS, ECOSYSTEM_FUND)

#### `/admin/merkle/[id]`
- Admin view of distribution details
- Sync distribution from blockchain
- View all distribution leaves
- Admin-only operations

## API Integration

The frontend communicates with the backend API at `NEXT_PUBLIC_API_BASE_URL`.

### Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
NEXT_PUBLIC_API_KEY=your_api_key_here
```

### API Client

Location: `src/lib/merkleAPI.ts`

Provides methods for:
- `validateAllocations()` - Validate allocation data before creating
- `createDistribution()` - Create new distribution
- `getDistributions()` - List all distributions with filters
- `getDistribution(id)` - Get specific distribution details
- `getUserDistributions(address)` - Get distributions for user
- `checkEligibility(id, address)` - Check if address is eligible
- `getProof(id, address)` - Get Merkle proof for claiming
- `syncDistribution(id)` - Sync from blockchain (admin)
- `getDistributionLeaves(id)` - Get all leaves (admin)

## React Hooks

Location: `src/hooks/useMerkleDistribution.ts`

### Public Hooks

#### `useDistributions(filters?)`
```typescript
const { distributions, loading, error, pagination, refetch } = useDistributions({
  status: 'active',
  vaultType: 'PLAYER_TASKS'
});
```

#### `useDistribution(distributionId)`
```typescript
const { distribution, loading, error, refetch } = useDistribution(1);
```

#### `useUserDistributions()`
```typescript
const { distributions, loading, error, refetch } = useUserDistributions();
```

#### `useDistributionEligibility(distributionId)`
```typescript
const { eligibility, loading, error, refetch } = useDistributionEligibility(1);
```

#### `useMerkleProof(distributionId)`
```typescript
const { proof, loading, error, getProof } = useMerkleProof(1);

// Manually fetch proof
await getProof();
```

### Admin Hooks

#### `useCreateDistribution()`
```typescript
const { validateAllocations, createDistribution, loading, error } = useCreateDistribution();

// Validate first
const validation = await validateAllocations([
  { address: '0x...', amount: 100 }
]);

// Then create
const result = await createDistribution({
  allocations: [...],
  vaultType: 'PLAYER_TASKS',
  durationInDays: 30,
  title: 'Weekly Rewards'
});
```

#### `useMerkleAdmin()`
```typescript
const { syncDistribution, getDistributionLeaves, loading, error } = useMerkleAdmin();

// Sync from blockchain
await syncDistribution(1);

// Get all leaves
const leaves = await getDistributionLeaves(1);
```

## Types

Location: `src/types/merkle.ts`

### Key Types

```typescript
enum VaultType {
  PLAYER_TASKS = 'PLAYER_TASKS',
  SOCIAL_FOLLOWERS = 'SOCIAL_FOLLOWERS',
  SOCIAL_POSTERS = 'SOCIAL_POSTERS',
  ECOSYSTEM_FUND = 'ECOSYSTEM_FUND',
}

enum DistributionStatus {
  PENDING = 'pending',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

interface Allocation {
  address: string;
  amount: number;
}

interface MerkleDistribution {
  distributionId: number;
  merkleRoot: string;
  vaultType: VaultType;
  totalAmount: number;
  totalRecipients: number;
  claimedCount: number;
  startTime: number;
  endTime: number;
  status: DistributionStatus;
  // ... more fields
}

interface MerkleProof {
  address: string;
  amount: number;
  proof: string[];
  index: number;
}
```

## Creating a Distribution

### Step 1: Prepare Allocations

Create a CSV-style list:
```
0x1234567890123456789012345678901234567890, 100
0xabcdefabcdefabcdefabcdefabcdefabcdefabcd, 250
0x9876543210987654321098765432109876543210, 75
```

### Step 2: Fill Form

1. Navigate to `/admin/merkle/create`
2. Enter title and description (optional)
3. Select vault type (PLAYER_TASKS, SOCIAL_FOLLOWERS, etc.)
4. Set duration in days
5. Paste allocations
6. Click "Validate" to check data
7. Click "Create Distribution" to submit

### Step 3: Wait for Confirmation

The transaction will be submitted to the blockchain. Once confirmed, you'll be redirected to the distribution details page.

## Claiming Tokens

### For Users

1. Go to `/distributions` to see your eligible distributions
2. Click on a distribution to view details
3. Click "Generate Merkle Proof to Claim"
4. Use the proof to call the `claim()` function on the Game contract

### Proof Structure

The Merkle proof contains:
- `address` - Your wallet address
- `amount` - Your token allocation
- `proof` - Array of hashes to verify your inclusion
- `index` - Your position in the Merkle tree

## UI Components

### Color Scheme

- **Primary**: Purple gradient (`from-purple-400 to-pink-600`)
- **Success**: Green (`text-green-400`)
- **Warning**: Yellow (`text-yellow-400`)
- **Error**: Red (`text-red-400`)
- **Info**: Blue (`text-blue-400`)

### Status Badges

```tsx
// Active distribution
<span className="bg-green-500/20 text-green-300">ACTIVE</span>

// Pending distribution
<span className="bg-yellow-500/20 text-yellow-300">PENDING</span>

// Completed distribution
<span className="bg-gray-500/20 text-gray-300">COMPLETED</span>

// Cancelled distribution
<span className="bg-red-500/20 text-red-300">CANCELLED</span>
```

## Security

- All API calls require authentication via `X-API-Key` header
- API key is stored in environment variables
- Admin operations require special permissions
- Wallet connection required for user-specific data

## Error Handling

All hooks return an `error` field with user-friendly messages:

```typescript
const { error } = useDistributions();

if (error) {
  // Display error to user
  console.error(error);
}
```

## Testing

To test the Merkle functionality:

1. Ensure API server is running on port 3000
2. Set `NEXT_PUBLIC_API_KEY` in `.env.local`
3. Connect wallet with admin permissions
4. Create a test distribution
5. Check eligibility from a different wallet
6. Generate proof and verify

## Troubleshooting

### "Failed to fetch distributions"
- Check API_BASE_URL is correct
- Ensure API server is running
- Verify API_KEY has correct permissions

### "Not eligible for this distribution"
- Check if your wallet address is in the allocation list
- Verify the distribution is active
- Ensure you're connected with the correct wallet

### "Validation failed"
- Check allocation format (address, amount)
- Verify all addresses are valid Ethereum addresses
- Ensure amounts are positive numbers

## Future Enhancements

- [ ] Batch claiming for multiple distributions
- [ ] CSV export of distribution data
- [ ] Email notifications for new distributions
- [ ] Mobile-responsive improvements
- [ ] Dark/light theme toggle
- [ ] Multi-language support
