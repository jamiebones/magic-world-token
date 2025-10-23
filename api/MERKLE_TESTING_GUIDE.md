# Merkle Distribution API - Testing Guide

## Overview

The Merkle Distribution API provides a gas-efficient token distribution system using Merkle trees. This allows large-scale airdrops where users claim their own tokens by providing a Merkle proof, rather than having the admin send tokens to each recipient individually.

## Test Suite

The integration test suite (`test-merkle-integration.js`) provides comprehensive coverage of all Merkle API endpoints, including:

- **Validation Tests** - Validate allocations before creating distributions
- **Distribution Creation** - Create new Merkle distributions on-chain
- **Public Query Tests** - List and query distributions without authentication
- **Eligibility Tests** - Check if addresses are eligible for distributions
- **Proof Generation** - Generate Merkle proofs for on-chain claiming
- **User Queries** - Get all distributions for a specific user
- **Admin Operations** - Sync distributions, get leaves, finalize expired distributions

## Running Tests

### Prerequisites

1. **API Server Running**: Ensure the API server is running locally or on a test environment
   ```bash
   npm run dev
   ```

2. **MongoDB Connected**: The API must be connected to MongoDB

3. **API Key**: You need an admin API key with proper permissions
   - Set in `.env` as `ADMIN_API_KEY` or `API_KEY`
   - Must have `admin` permission level

4. **Blockchain Connection**: The API must be connected to BSC (testnet or mainnet)
   - Smart contracts deployed
   - Game contract has tokens in vaults for distribution

### Run Tests

```bash
# Using npm script
npm run test:merkle

# Or directly
node api/scripts/test-merkle-integration.js

# With custom API URL
API_BASE_URL=https://api.example.com npm run test:merkle

# With custom API key
ADMIN_API_KEY=mwt_your_key_here npm run test:merkle
```

### Environment Variables

The test suite uses these environment variables:

```bash
# API Configuration
API_BASE_URL=http://localhost:3000        # Default: http://localhost:3000
ADMIN_API_KEY=mwt_xxxxxxxxxxxxx           # Required: Admin API key
API_KEY=mwt_xxxxxxxxxxxxx                 # Alternative to ADMIN_API_KEY
```

## Test Categories

### 1. Validation Tests (3 tests)
- ✅ Validate valid allocations
- ✅ Reject invalid allocations
- ✅ Require auth for validation

### 2. Distribution Creation Tests (3 tests)
- ✅ Create distribution with valid data
- ✅ Reject invalid vault type
- ✅ Require authentication for creation

### 3. Public Query Tests (4 tests)
- ✅ List all distributions
- ✅ List distributions with filters
- ✅ Get distribution by ID
- ✅ Return 404 for non-existent distribution

### 4. Eligibility and Proof Tests (5 tests)
- ✅ Check eligibility for eligible address
- ✅ Check eligibility for non-eligible address
- ✅ Reject invalid address format
- ✅ Get Merkle proof for eligible address
- ✅ Handle proof request for non-eligible address

### 5. User Distributions Tests (2 tests)
- ✅ Get distributions for user
- ✅ Reject invalid address for user distributions

### 6. Admin Operations Tests (4 tests)
- ✅ Sync distribution from blockchain
- ✅ Require auth for sync
- ✅ Get distribution leaves (paginated)
- ✅ Require auth for leaves

**Total: 21 Tests**

## Expected Output

```
╔════════════════════════════════════════════════════════════════╗
║     MERKLE DISTRIBUTION API - INTEGRATION TEST SUITE           ║
╚════════════════════════════════════════════════════════════════╝

API Base URL: http://localhost:3000
API Key: mwt_adm123...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VALIDATION TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: Validate valid allocations
✅ PASSED

Testing: Reject invalid allocations
✅ PASSED

Testing: Require auth for validation
✅ PASSED

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DISTRIBUTION CREATION TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: Create distribution
✅ PASSED

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Passed:  21
❌ Failed:  0
⏭️  Skipped: 0
📊 Total:   21
📈 Pass Rate: 100.0%
```

## Common Test Scenarios

### Skipped Tests

Some tests may be skipped if prerequisites are not met:

```
⏭️  SKIPPED - No distribution ID available (distribution creation failed)
```

This happens when:
- **Insufficient vault balance**: The game contract doesn't have enough tokens
- **Blockchain connection issue**: Cannot communicate with BSC
- **Contract not initialized**: Game contract not properly set up

### Failed Tests

If tests fail, you'll see detailed error messages:

```
❌ FAILED - Expected 200, got 401: Unauthorized

Failed Tests:
  • Create distribution
    Expected 200, got 401: Unauthorized
```

Common failure reasons:
- **Invalid API key**: Check your `ADMIN_API_KEY` environment variable
- **Insufficient permissions**: API key doesn't have `admin` role
- **API server not running**: Start the API with `npm run dev`
- **MongoDB not connected**: Check MongoDB connection string
- **Blockchain errors**: Check BSC RPC connection and gas fees

## Test Data

The test suite uses these test addresses:

```javascript
testAddresses: [
    '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',   // 100 tokens
    '0x5B38Da6a701c568545dCfcB03FcB875f56beddC4',   // 200 tokens
    '0xAb8483F64d9C6d1EcF9b849Ae677dD3315835cb2'    // 150 tokens
]
```

Test distribution parameters:
- **Vault Type**: PLAYER_TASKS (50% allocation)
- **Duration**: 30 days
- **Total Allocation**: 450 tokens (100 + 200 + 150)
- **Title**: "Test Distribution - Integration Test"

## Interpreting Results

### Pass Rate

- **100%**: All systems operational
- **90-99%**: Minor issues, likely configuration or setup
- **< 90%**: Significant problems, review failed tests

### Exit Codes

- **0**: All tests passed
- **1**: One or more tests failed

This allows integration into CI/CD pipelines:

```bash
npm run test:merkle && echo "Deploy to production" || echo "Fix tests first"
```

## Debugging Failed Tests

### Enable Verbose Logging

Modify the test file to log full responses:

```javascript
console.log('Response:', JSON.stringify(response.data, null, 2));
```

### Check API Logs

Watch API logs while running tests:

```bash
# Terminal 1: Run API with logs
npm run dev

# Terminal 2: Run tests
npm run test:merkle
```

### Test Individual Endpoints

Use curl or Postman to manually test endpoints:

```bash
# List distributions
curl http://localhost:3000/api/merkle/distributions

# Check eligibility
curl http://localhost:3000/api/merkle/distributions/1/eligibility/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

# Create distribution (requires auth)
curl -X POST http://localhost:3000/api/merkle/distributions/create \
  -H "X-API-Key: mwt_your_key" \
  -H "Content-Type: application/json" \
  -d '{"allocations":[{"address":"0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb","amount":100}],"vaultType":"PLAYER_TASKS","durationInDays":30}'
```

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/test.yml
- name: Run Merkle Integration Tests
  env:
    API_BASE_URL: ${{ secrets.STAGING_API_URL }}
    ADMIN_API_KEY: ${{ secrets.ADMIN_API_KEY }}
  run: npm run test:merkle
```

## Related Documentation

- **API Documentation**: `/api-docs` endpoint (Swagger UI)
- **Merkle Distribution Guide**: See architecture documentation
- **Smart Contract Tests**: `test/MagicWorldGameMerkle.test.js`
- **Contract Deployment**: `docs/BSC_MAINNET_DEPLOYMENT.md`

## Troubleshooting

### "ADMIN_API_KEY environment variable is required"

Set the API key:
```bash
export ADMIN_API_KEY=mwt_your_admin_key
npm run test:merkle
```

### "Insufficient vault balance"

The game contract needs tokens in the vault:
1. Deploy contracts with initial supply
2. Transfer tokens to game contract
3. Initialize vault allocations
4. Grant distributor role to API wallet

### "Cannot connect to API"

Check:
1. API server is running (`npm run dev`)
2. API_BASE_URL is correct
3. Port 3000 is not blocked
4. MongoDB is connected

### All tests skip after creation fails

This is expected behavior. If distribution creation fails (usually due to insufficient vault balance), subsequent tests that depend on the distribution ID will skip gracefully.

To fix:
1. Ensure game contract has sufficient tokens
2. Check vault allocations are initialized
3. Verify API wallet has DISTRIBUTOR_ROLE

## Best Practices

1. **Run tests before deployment** - Ensure all endpoints work
2. **Test on testnet first** - Use BSC Testnet before mainnet
3. **Monitor test results** - Track pass rates over time
4. **Update tests with features** - Add tests for new endpoints
5. **Use in CI/CD** - Automate testing in deployment pipeline

## Support

If tests consistently fail:
1. Check API logs for detailed error messages
2. Verify environment configuration
3. Test blockchain connection separately
4. Review smart contract state
5. Check MongoDB connection and data

For questions or issues, refer to the main project documentation or contact the development team.
