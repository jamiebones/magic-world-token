# Bot Examples

This directory contains example bot implementations that demonstrate how to use the Magic World Token Bot API.

## 📁 Files

- **`simple-bot.js`** - Complete working example of a trading bot
- **`.env.bot.example`** - Environment variables template for bot configuration

## 🚀 Quick Start

### 1. Prerequisites

- Node.js 18+ installed
- Bot API running (see main README)
- Trading wallet with BNB and MWT tokens

### 2. Setup

```bash
# Create your bot project directory
mkdir mwt-trading-bot
cd mwt-trading-bot

# Copy the example bot
cp /path/to/api/examples/simple-bot.js ./bot.js

# Copy and configure environment variables
cp /path/to/api/examples/.env.bot.example ./.env

# Edit .env with your configuration
nano .env

# Install dependencies
npm init -y
npm install axios dotenv
```

### 3. Configure

Edit `.env` and set at minimum:

```bash
BOT_API_URL=http://localhost:3000/api/bot
TRADING_ENABLED=false    # Keep false for testing
DRY_RUN=true            # Keep true for testing
MAX_TRADE_BNB=0.01      # Start very small
```

### 4. Test Connection

```bash
# Test API connection
node -e "
const axios = require('axios');
axios.get('http://localhost:3000/api/bot/health')
  .then(r => console.log('✅ API Connected:', r.data))
  .catch(e => console.error('❌ Connection failed:', e.message));
"
```

### 5. Run Bot (Dry-Run Mode)

```bash
# Run in dry-run mode (safe, no real trades)
node bot.js
```

You should see output like:

```
============================================================
🤖 Magic World Token - Simple Trading Bot
============================================================
Target Peg: $0.01
Deviation Threshold: ±5.0%
Max Trade Size: 0.01 BNB
Check Interval: 60s
Trading Enabled: false
Dry-Run Mode: true
============================================================

🏥 API Health Check:
   Status: healthy
   Price Oracle: ✓
   Trade Executor: ✓
   Database: ✓

✅ Bot started successfully!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trading Cycle #1 - 10/19/2025, 10:30:00 AM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📈 Current Prices:
   MWT/BNB: 0.0001421990
   MWT/USD: $0.00008523
   MWT/BTC: 120.00 sats
   BNB/USD: $599.50

📊 Deviation from Target:
   Current: $0.00008523
   Target:  $0.01000000
   🔴 Deviation: ↓ 99.15%
   Recommendation: BUY

✅ Safety check passed
📊 Trade Signal: BUY

💰 Trade Estimate:
   Input: 0.01 BNB
   Output: 0.000001421990729671 MWT
   Price Impact: 60.22%
   Estimated Gas: 0.00000075 BNB

🧪 DRY-RUN MODE: Trade not executed
   Would BUY 0.01 BNB
```

### 6. Enable Live Trading (When Ready)

⚠️ **ONLY after thorough testing!**

```bash
# Edit .env
TRADING_ENABLED=true
DRY_RUN=false
MAX_TRADE_BNB=0.1  # Still keep small

# Run bot
node bot.js
```

## 📖 Example Bot Features

The `simple-bot.js` example includes:

- ✅ Health checks before starting
- ✅ Real-time price monitoring
- ✅ Deviation calculation from target peg
- ✅ Safety checks (balance, limits, etc.)
- ✅ Trade signal generation (BUY/SELL/HOLD)
- ✅ Trade estimation
- ✅ Trade execution
- ✅ Dry-run mode for safe testing
- ✅ Graceful shutdown (Ctrl+C)
- ✅ Comprehensive logging
- ✅ Error handling

## 🎯 How It Works

The bot follows this simple strategy:

1. **Check prices** every 60 seconds (configurable)
2. **Calculate deviation** from $0.01 target peg
3. **Generate signal:**
   - If price > target + threshold → **SELL** (bring price down)
   - If price < target - threshold → **BUY** (bring price up)
   - If within threshold → **HOLD** (do nothing)
4. **Safety checks:**
   - Is bot enabled?
   - Sufficient balance?
   - Below daily limit?
   - Within trading hours?
5. **Execute trade** (if all checks pass)
6. **Wait** for next cycle

## 🔧 Customization

### Change Trading Strategy

Edit the `calculateTradeSignal()` method:

```javascript
calculateTradeSignal(deviation) {
    const deviationPercent = parseFloat(deviation.deviationPercent);
    
    // Custom strategy: More aggressive thresholds
    if (deviationPercent > 3.0) {
        return { action: 'SELL', amount: 0.2 };
    } else if (deviationPercent < -3.0) {
        return { action: 'BUY', amount: 0.2 };
    }
    
    return { action: 'HOLD', amount: 0 };
}
```

### Add More Signals

```javascript
// Use multiple indicators
const ma = await this.getMovingAverage();
const volume = await this.getVolume();
const trend = this.calculateTrend(ma, volume);

if (trend === 'bullish' && deviationPercent < -5) {
    return { action: 'BUY', amount: 0.2 };
}
```

### Add Notifications

```javascript
async sendNotification(message) {
    await axios.post(process.env.WEBHOOK_URL, {
        text: `🤖 Bot Alert: ${message}`
    });
}
```

## 🛡️ Safety Features

The example bot includes several safety mechanisms:

1. **Dry-run mode** - Test without risk
2. **Trade limits** - Maximum amount per trade
3. **Daily limits** - Maximum daily volume
4. **Balance checks** - Ensure sufficient funds
5. **Safety checks** - Multiple validation layers
6. **Error handling** - Graceful failure recovery
7. **Cooldown periods** - Prevent rapid trading

## 📊 Monitoring

### Check Bot Status

```bash
# View logs
tail -f bot.log

# Check trade history via API
curl http://localhost:3000/api/bot/trade/history

# Check portfolio
curl http://localhost:3000/api/bot/portfolio/status
```

### Production Deployment

Use PM2 for production:

```bash
npm install -g pm2

# Start bot
pm2 start bot.js --name mwt-bot

# Monitor
pm2 logs mwt-bot
pm2 monit

# Auto-restart on system reboot
pm2 startup
pm2 save
```

## 🐛 Troubleshooting

### Bot won't start

```bash
# Check API connection
curl http://localhost:3000/api/bot/health

# Check environment variables
cat .env

# Run with verbose logging
VERBOSE=true node bot.js
```

### No trades executing

Check:
- ✅ `TRADING_ENABLED=true`
- ✅ `DRY_RUN=false`
- ✅ Deviation exceeds threshold
- ✅ Safety checks passing
- ✅ Sufficient balance

### Trades failing

Check:
- ✅ Sufficient BNB for gas
- ✅ Sufficient MWT balance (for sells)
- ✅ Slippage tolerance not too low
- ✅ Liquidity available in pool
- ✅ Gas price not too low

## 📚 Additional Resources

- **[Bot Integration Guide](../BOT_INTEGRATION_GUIDE.md)** - Comprehensive documentation
- **[API Documentation](http://localhost:3000/api-docs)** - Swagger UI
- **[Deployment Guide](../DEPLOYMENT_GUIDE.md)** - Production deployment
- **[Production Checklist](../PRODUCTION_CHECKLIST.md)** - Pre-launch checks

## ⚠️ Important Notes

1. **Start with dry-run mode** - Always test thoroughly first
2. **Use small amounts** - Start with minimal trade sizes
3. **Monitor closely** - Watch the first few live trades carefully
4. **Set limits** - Configure daily limits and max trade sizes
5. **Keep BNB** - Maintain sufficient BNB for gas fees
6. **Secure your .env** - Never commit sensitive data
7. **Test on testnet first** - If available

## 🤝 Support

- Open an issue on GitHub
- Check the main documentation
- Review API endpoints at `/api-docs`

---

**Happy Trading! 🚀**
