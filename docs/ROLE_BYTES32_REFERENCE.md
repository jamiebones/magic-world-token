# Role Bytes32 Reference Guide

## Understanding Role Format for `revokeRole(bytes32 role, address account)`

### How Roles Work in OpenZeppelin AccessControl

Roles are stored as `bytes32` values. There are two types:

1. **DEFAULT_ADMIN_ROLE**: Special zero value
2. **Named roles**: Hash of the role name using keccak256

---

## Role Values for MagicWorldToken (0x73331cb65cfb32b609178B75F70e00216b788401)

### DEFAULT_ADMIN_ROLE
```
bytes32: 0x0000000000000000000000000000000000000000000000000000000000000000
```
- This is the master admin role
- Can grant/revoke all other roles
- Always zero bytes

### GAME_OPERATOR_ROLE
```
bytes32: 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848
Calculation: keccak256("GAME_OPERATOR_ROLE")
```

### PAUSE_ROLE
```
bytes32: 0x139c2898040ef16910dc9f44dc697df79363da767d8bc92f2e310312b816e46d
Calculation: keccak256("PAUSE_ROLE")
```

---

## How to Calculate Role Bytes32

### Method 1: Using ethers.js

```javascript
const { ethers } = require('ethers');

// For named roles
const GAME_OPERATOR_ROLE = ethers.id('GAME_OPERATOR_ROLE');
const PAUSE_ROLE = ethers.id('PAUSE_ROLE');

// For DEFAULT_ADMIN_ROLE
const DEFAULT_ADMIN_ROLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

console.log('GAME_OPERATOR_ROLE:', GAME_OPERATOR_ROLE);
console.log('PAUSE_ROLE:', PAUSE_ROLE);
console.log('DEFAULT_ADMIN_ROLE:', DEFAULT_ADMIN_ROLE);
```

### Method 2: Using Solidity

```solidity
bytes32 public constant GAME_OPERATOR_ROLE = keccak256("GAME_OPERATOR_ROLE");
bytes32 public constant PAUSE_ROLE = keccak256("PAUSE_ROLE");
bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00;
```

### Method 3: Using cast (Foundry)

```bash
# For named roles
cast keccak "GAME_OPERATOR_ROLE"
cast keccak "PAUSE_ROLE"

# Output:
# 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848
# 0x139c2898040ef16910dc9f44dc697df79363da767d8bc92f2e310312b816e46d
```

### Method 4: Online Keccak256 Calculator

Use: https://emn178.github.io/online-tools/keccak_256.html

Input: `GAME_OPERATOR_ROLE`
Output: `3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848`
Add `0x` prefix: `0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848`

---

## Revoking Roles - Step by Step

### Using ethers.js Script

```javascript
const { ethers } = require('ethers');

// Contract setup
const TOKEN_ADDRESS = '0x73331cb65cfb32b609178B75F70e00216b788401';
const COMPROMISED_WALLET = '0x178113a73061f2049268cebadbf753e93b2aa965';
const TOKEN_ABI = [...]; // Your contract ABI

// Provider and signer
const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
const wallet = new ethers.Wallet('YOUR_ADMIN_PRIVATE_KEY', provider);
const contract = new ethers.Contract(TOKEN_ADDRESS, TOKEN_ABI, wallet);

// Role bytes32 values
const GAME_OPERATOR_ROLE = ethers.id('GAME_OPERATOR_ROLE');
const PAUSE_ROLE = ethers.id('PAUSE_ROLE');

// Revoke roles
async function revokeRoles() {
  // Check if has role first
  const hasGameOperator = await contract.hasRole(GAME_OPERATOR_ROLE, COMPROMISED_WALLET);
  
  if (hasGameOperator) {
    console.log('Revoking GAME_OPERATOR_ROLE...');
    const tx = await contract.revokeRole(GAME_OPERATOR_ROLE, COMPROMISED_WALLET);
    await tx.wait();
    console.log('✅ Revoked!');
  }
  
  const hasPause = await contract.hasRole(PAUSE_ROLE, COMPROMISED_WALLET);
  
  if (hasPause) {
    console.log('Revoking PAUSE_ROLE...');
    const tx = await contract.revokeRole(PAUSE_ROLE, COMPROMISED_WALLET);
    await tx.wait();
    console.log('✅ Revoked!');
  }
}

revokeRoles();
```

### Using BSCScan Web Interface

1. Go to: https://bscscan.com/address/0x73331cb65cfb32b609178B75F70e00216b788401#writeContract
2. Click "Connect to Web3" (connect your admin wallet)
3. Find function `revokeRole`
4. Enter parameters:
   ```
   role (bytes32): 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848
   account (address): 0x178113a73061f2049268cebadbf753e93b2aa965
   ```
5. Click "Write"
6. Confirm transaction in MetaMask

### Using Cast (Foundry CLI)

```bash
# Revoke GAME_OPERATOR_ROLE
cast send 0x73331cb65cfb32b609178B75F70e00216b788401 \
  "revokeRole(bytes32,address)" \
  0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848 \
  0x178113a73061f2049268cebadbf753e93b2aa965 \
  --rpc-url https://bsc-dataseed.binance.org/ \
  --private-key YOUR_ADMIN_PRIVATE_KEY

# Revoke PAUSE_ROLE
cast send 0x73331cb65cfb32b609178B75F70e00216b788401 \
  "revokeRole(bytes32,address)" \
  0x139c2898040ef16910dc9f44dc697df79363da767d8bc92f2e310312b816e46d \
  0x178113a73061f2049268cebadbf753e93b2aa965 \
  --rpc-url https://bsc-dataseed.binance.org/ \
  --private-key YOUR_ADMIN_PRIVATE_KEY
```

---

## Checking Current Roles

### Using ethers.js

```javascript
const hasRole = await contract.hasRole(
  ethers.id('GAME_OPERATOR_ROLE'),
  '0x178113a73061f2049268cebadbf753e93b2aa965'
);
console.log('Has GAME_OPERATOR_ROLE:', hasRole);
```

### Using BSCScan Read Contract

1. Go to: https://bscscan.com/address/0x73331cb65cfb32b609178B75F70e00216b788401#readContract
2. Find function `hasRole`
3. Enter:
   ```
   role (bytes32): 0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848
   account (address): 0x178113a73061f2049268cebadbf753e93b2aa965
   ```
4. Click "Query"
5. Returns: `true` or `false`

### Using Cast

```bash
cast call 0x73331cb65cfb32b609178B75F70e00216b788401 \
  "hasRole(bytes32,address)(bool)" \
  0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848 \
  0x178113a73061f2049268cebadbf753e93b2aa965 \
  --rpc-url https://bsc-dataseed.binance.org/
```

---

## Quick Reference Table

| Role Name | bytes32 Value | Function |
|-----------|---------------|----------|
| DEFAULT_ADMIN_ROLE | `0x0000000000000000000000000000000000000000000000000000000000000000` | Master admin |
| GAME_OPERATOR_ROLE | `0x3c11d16cbaffd01df69ce1c404f6340ee057498f5f00246190ea54220576a848` | Batch operations |
| PAUSE_ROLE | `0x139c2898040ef16910dc9f44dc697df79363da767d8bc92f2e310312b816e46d` | Emergency pause |

---

## Important Notes

1. **Only DEFAULT_ADMIN_ROLE can revoke roles**
   - Make sure you're using admin wallet (0x2B7A7c...)
   - NOT the compromised wallet!

2. **Gas costs**
   - Each revocation: ~50,000 gas (~$0.30 on BSC)
   - Total for all roles: ~$1

3. **Verification**
   - Always check `hasRole()` after revocation
   - Verify on BSCScan

4. **Cannot revoke your own DEFAULT_ADMIN_ROLE**
   - Must use `renounceRole()` instead
   - Be careful not to lock yourself out!

---

## Using the Provided Script

### Dry run (check roles first):
```bash
node scripts/revoke-compromised-wallet-roles.js --dry-run
```

### Execute revocations:
```bash
node scripts/revoke-compromised-wallet-roles.js --execute
```

This script will:
1. Show all role bytes32 values
2. Check which roles the compromised wallet has
3. Revoke each role
4. Verify revocations
5. Provide next steps

---

## Troubleshooting

### "AccessControl: account X is missing role Y"
- You don't have DEFAULT_ADMIN_ROLE
- Use admin wallet: 0x2B7A7cbb2FE3bFE97fB0Ba21909Df83346A6e782

### "Transaction failed"
- Check gas balance
- Verify you're on BSC Mainnet
- Check if role already revoked

### "Invalid role bytes32"
- Make sure to include `0x` prefix
- Verify the correct hash for the role name
- Check for typos in role name

---

**Generated:** October 22, 2025  
**Contract:** MagicWorldToken (0x73331cb65cfb32b609178B75F70e00216b788401)  
**Network:** BSC Mainnet (Chain ID: 56)
