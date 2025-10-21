# V3 Pool Quick Reference

## ⚡ Quick Commands

```bash
# Test V3 Oracle
node scripts/test-v3-oracle.js

# Test Bot Integration
node scripts/test-bot-v3-integration.js

# Find V3 Pools
node scripts/find-v3-pool.js

# Check Wallet Balance
node scripts/check-wallet-balance.js
```

## 📊 Current Status

| Metric | Value |
|--------|-------|
| **MWT Price (USD)** | $0.00033264 |
| **MWT Price (BNB)** | 0.0000003115 BNB |
| **Target Peg** | $0.0001 |
| **Deviation** | +232.64% |
| **Status** | ⚠️ Moderate (over peg) |

## 🔗 Important Addresses

### V3 Pool
```
0x88AEBA95750Aa6aEF25CD3B696B0BDa53DabE2d8
```

### Tokens
```
MWT:  0x73331cb65cfb32b609178B75F70e00216b788401
WBNB: 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
```

### Your Position
```
NFT ID: 4875198
View at: https://pancakeswap.finance/v3/liquidity
```

## 🔧 Configuration (.env)

```bash
IS_V3_POOL=true
MWT_BNB_PAIR_ADDRESS=0x88AEBA95750Aa6aEF25CD3B696B0BDa53DabE2d8
MWT_TOKEN_ADDRESS=0x73331cb65cfb32b609178B75F70e00216b788401
V3_POOL_FEE=10000
TARGET_PEG_USD=0.0001
```

## 🎯 How to Adjust Price

To lower MWT price from $0.00033 to $0.0001:

**Option 1: Add More MWT**
- Current ratio: 0.3 BNB : 1.58M MWT
- Target ratio: 0.3 BNB : 3.2M MWT
- **Action:** Add ~1.6M more MWT to position

**Option 2: Remove & Recreate**
- Remove current position via UI
- Create new position with custom range
- Use full range or narrow range around $0.0001

**Option 3: Accept Current Price**
- Update TARGET_PEG_USD to 0.00033
- Reduces deviation to 0%
- Easier to maintain

## 📱 View Your Position

1. Go to: https://pancakeswap.finance/v3/liquidity
2. Connect wallet: 0x178113a73061f2049268cebadbf753e93b2aa965
3. See Position NFT #4875198
4. View range, liquidity, fees earned

## 🔍 Check Price Anytime

```bash
# Via script
node scripts/test-v3-oracle.js

# Via API (with API key)
curl https://magic-world-token-production.up.railway.app/api/bot/prices/current \
  -H "X-API-Key: your-api-key"
```

## 📊 V2 vs V3 Comparison

| Feature | V2 (Old) | V3 (Current) |
|---------|----------|--------------|
| **Address** | 0x9f55c42...592f0 | 0x88AEBA9...abE2d8 |
| **Liquidity** | Full range | Concentrated |
| **LP Token** | ERC20 | ERC721 NFT |
| **Price** | $1M+ (broken) | $0.00033 ✅ |
| **Status** | Abandoned | Active |

## ⚠️ Important Notes

- **V2 pool still exists** but has dust - DO NOT USE
- **V3 positions have ranges** - price can go out of range
- **Concentrated liquidity** means more efficient capital
- **NFT-based** positions are non-fungible

## 🚀 Next Deployment

```bash
# 1. Commit changes
git add .
git commit -m "Add V3 pool support"

# 2. Push to Railway
git push origin main

# 3. Verify deployment
curl https://magic-world-token-production.up.railway.app/api/bot/health

# 4. Test V3 oracle
curl https://magic-world-token-production.up.railway.app/api/bot/prices/current \
  -H "X-API-Key: mwt_f0a18844d6b0cb82d71f02a9455b09a8ac9dfb8d4915c1c2fb2c06ab436fee32"
```

## 📚 Full Documentation

See: `/docs/V3_POOL_CONFIGURATION.md`

---

**Last Updated:** October 21, 2025
