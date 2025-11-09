# PancakeSwap V3 Trading Integration - Configuration Guide

## Summary

Updated `tradeExecutor.js` to support **PancakeSwap V3** SwapRouter for actual trade execution. The code now automatically detects V3 vs V2 based on the `IS_V3_POOL` environment variable.

## Changes Made

### 1. Created V3 SwapRouter ABI
- **File:** `api/contracts/abis/IPancakeV3SwapRouter.json`
- Contains functions: `exactInputSingle`, `multicall`, `refundETH`, `unwrapWETH9`

### 2. Updated Trade Executor
- **File:** `api/src/bot/services/tradeExecutor.js`
- Added V3-specific buy/sell methods
- Maintains backward compatibility with V2
- Auto-detects router type based on `IS_V3_POOL` environment variable

### 3. Key V3 Differences from V2

| Feature | V2 | V3 |
|---------|----|----|
| Router Address | `0x10ED43C718714eb63d5aA57B78B54704E256024E` | `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4` |
| Function for BUY | `swapExactETHForTokens` | `exactInputSingle` + `multicall` |
| Function for SELL | `swapExactTokensForETH` | `exactInputSingle` + `unwrapWETH9` |
| Fee Tier | 0.3% (hardcoded) | 0.25% (configurable: 2500) |
| Params | Path array | Structured params object |
| Unwrap BNB | Automatic | Manual via `unwrapWETH9` |

## Required Environment Variable Updates

### Railway (Production) Environment Variables

Update these variables in your Railway project settings:

```bash
# Change router address from V2 to V3
PANCAKE_ROUTER_ADDRESS=0x13f4EA83D0bd40E75C8222255bc855a974568Dd4

# Ensure V3 pool flag is set
IS_V3_POOL=true
```

### Local Environment (.env file)

Update your `api/.env` file:

```bash
# PancakeSwap V3 SwapRouter (BSC Mainnet)
PANCAKE_ROUTER_ADDRESS=0x13f4EA83D0bd40E75C8222255bc855a974568Dd4

# Use V3 pool and router
IS_V3_POOL=true

# Other required variables (verify these are set)
BSC_MAINNET_RPC_URL=https://bsc-dataseed1.binance.org/
TOKEN_CONTRACT_ADDRESS=0x9c04995284e6015Ff45068DC78f6dd8263581df9
WBNB_ADDRESS=0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c
BOT_WALLET_PRIVATE_KEY=your_private_key_here
```

## V3 Trade Execution Flow

### BUY (BNB → MWT)
1. Check BNB balance
2. Estimate expected MWT output using V3 price oracle
3. Calculate minimum output with slippage
4. Prepare `exactInputSingle` params:
   - `tokenIn`: WBNB
   - `tokenOut`: MWT
   - `fee`: 2500 (0.25%)
   - `recipient`: wallet address
   - `amountIn`: BNB amount (in wei)
   - `amountOutMinimum`: min MWT with slippage
5. Execute `multicall([exactInputSingle, refundETH])`
6. Wait for confirmation
7. Return tx hash, block number, gas cost

### SELL (MWT → BNB)
1. Check MWT balance
2. Approve MWT for router (if needed)
3. Estimate expected BNB output using V3 price oracle
4. Calculate minimum output with slippage
5. Prepare `exactInputSingle` params:
   - `tokenIn`: MWT
   - `tokenOut`: WBNB
   - `fee`: 2500 (0.25%)
   - `recipient`: ZeroAddress (router holds WBNB temporarily)
   - `amountIn`: MWT amount (in wei)
   - `amountOutMinimum`: min BNB with slippage
6. Execute `multicall([exactInputSingle, unwrapWETH9])`
   - First call swaps MWT → WBNB
   - Second call unwraps WBNB → BNB and sends to wallet
7. Wait for confirmation
8. Return tx hash, block number, gas cost

## Testing

### 1. Update Railway Environment Variables
- Go to Railway project → Variables
- Update `PANCAKE_ROUTER_ADDRESS` to V3 router
- Ensure `IS_V3_POOL=true`
- Deploy/restart the service

### 2. Test Locally
```bash
# Start local server
cd api
npm start

# In another terminal, run test
API_BASE_URL=http://localhost:3000 node scripts/test-trade-execute-local.js
```

### 3. Test on Production
```bash
# Test small buy (requires bot wallet to have BNB)
curl -X POST https://magic-world-token-production.up.railway.app/api/bot/trade/execute \
  -H "Content-Type: application/json" \
  -H "X-API-Key: mwt_935c00768c6ce3813ee131a015512826fac792559ff9416e2f39492bed67c0f3" \
  -d '{
    "action": "BUY",
    "amount": 0.001,
    "slippage": 0.05,
    "urgency": "LOW"
  }'
```

## Important Notes

1. **Gas Limits:** V3 swaps typically use ~250-300k gas (vs ~150k for V2)
2. **Slippage:** V3 pricing is more precise; 1-2% slippage should be sufficient for small trades
3. **Fee Tier:** Currently hardcoded to 2500 (0.25%) - matches your MWT/BNB pool
4. **Error Handling:** V3 router may revert with less descriptive errors; check pool liquidity and approvals
5. **Multicall:** V3 uses multicall for atomic operations (swap + refund/unwrap in one tx)

## Rollback Plan

If V3 trading has issues, you can rollback to V2:

```bash
# In Railway, change these variables:
PANCAKE_ROUTER_ADDRESS=0x10ED43C718714eb63d5aA57B78B54704E256024E
IS_V3_POOL=false

# Redeploy/restart
```

The code will automatically use V2 router functions.

## Contract Addresses Reference

### BSC Mainnet
- **V2 Router:** `0x10ED43C718714eb63d5aA57B78B54704E256024E`
- **V3 SwapRouter:** `0x13f4EA83D0bd40E75C8222255bc855a974568Dd4`
- **WBNB:** `0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c`
- **MWT Token:** `0x9c04995284e6015Ff45068DC78f6dd8263581df9`
- **MWT/BNB V3 Pool:** `0x63D85c8580d9d5e676F7Efd4d95A6a55326f174F`

## Next Steps

1. ✅ Code updated and tested locally
2. ⏳ Update Railway environment variables
3. ⏳ Redeploy on Railway
4. ⏳ Test small trade on production
5. ⏳ Monitor first few trades for issues
6. ⏳ Adjust gas limits if needed

## Support

If trades fail after migration:
- Check Railway logs for error messages
- Verify bot wallet has sufficient BNB for gas + trade
- Confirm `IS_V3_POOL=true` is set
- Check pool liquidity on BSCScan
- Verify token approvals for V3 router
