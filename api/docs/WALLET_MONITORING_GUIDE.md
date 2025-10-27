# Wallet Balance Monitoring System

Automated wallet balance monitoring with email alerts for the Magic World Token API.

## Overview

The wallet balance monitoring system automatically checks the balance of the Game Admin wallet and sends email alerts when the balance falls below a configured threshold. This prevents operational disruptions caused by insufficient gas fees.

## Features

- ✅ **Automated Balance Checks**: Daily scheduled checks (configurable)
- ✅ **Email Alerts**: Gmail integration for instant notifications
- ✅ **Alert Throttling**: Prevents spam with 24-hour cooldown between alerts
- ✅ **Database Tracking**: Complete alert history stored in MongoDB
- ✅ **Auto-Resolution**: Automatically resolves alerts when balance recovers
- ✅ **Dynamic Configuration**: Update monitored wallet and threshold without restart
- ✅ **Admin API**: Manual checks, history queries, and statistics
- ✅ **BSC Integration**: Uses Ethers.js to query on-chain balance

## Architecture

### Components

1. **WalletBalanceAlert Model** (`src/models/WalletBalanceAlert.js`)
   - Database schema for tracking alerts
   - Static methods for queries and throttling logic
   - Indexes for efficient querying

2. **Email Service** (`src/services/emailService.js`)
   - Gmail SMTP integration via Nodemailer
   - HTML email templates with wallet details
   - BscScan explorer links

3. **Wallet Balance Monitor** (`src/services/walletBalanceMonitor.js`)
   - Balance checking via Ethers.js JsonRpcProvider
   - Alert orchestration and auto-resolution
   - Configuration management

4. **Cron Jobs Service** (`src/services/cronJobs.js`)
   - Scheduled daily checks at 9 AM (configurable)
   - Integration with existing cron infrastructure

5. **Admin API Endpoints** (`src/routes/admin.js`)
   - Manual triggers and queries
   - Protected by X-Admin-Secret header

## Setup Guide

### Prerequisites

- MongoDB database (already configured)
- Gmail account with 2FA enabled
- BSC RPC endpoint (already configured)
- Game Admin wallet address

### Step 1: Generate Gmail App Password

**IMPORTANT**: You must use an App Password, NOT your regular Gmail password!

1. **Enable 2-Factor Authentication**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Enable "2-Step Verification" if not already enabled

2. **Generate App Password**
   - Go to [Google Account Security](https://myaccount.google.com/security)
   - Under "2-Step Verification", scroll to "App passwords"
   - Click "App passwords" (you may need to verify your password)
   - Select "Mail" as the app
   - Select "Other (Custom name)" as the device
   - Enter a name like "Magic World API Alerts"
   - Click "Generate"

3. **Copy App Password**
   - Gmail will show a 16-character password (format: `xxxx xxxx xxxx xxxx`)
   - Copy this password - you'll only see it once!
   - Use this in your `.env` file as `GMAIL_APP_PASSWORD`

### Step 2: Configure Environment Variables

Add the following to your `.env` file:

```bash
# === Wallet Balance Monitoring ===
WALLET_BALANCE_CHECK_ENABLED=true
WALLET_BALANCE_CHECK_SCHEDULE="0 9 * * *"  # Daily at 9 AM UTC
WALLET_BALANCE_LOW_THRESHOLD_BNB=0.05
MONITORED_WALLET_NAME="Game Admin Wallet"

# Game Admin Wallet (already required)
GAME_ADMIN_ADDRESS=0x...your_game_admin_wallet_address

# === Email Configuration ===
EMAIL_ALERTS_ENABLED=true
EMAIL_FROM=alerts@magicworld.com
EMAIL_TO=admin@example.com,admin2@example.com

# Gmail SMTP (use App Password!)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx

# BSC RPC (already required)
BSC_MAINNET_RPC_URL=https://bsc-dataseed1.binance.org/
```

### Step 3: Install Dependencies

```bash
cd api
npm install
```

This will install the new `nodemailer` dependency.

### Step 4: Test the Configuration

Run the comprehensive test suite:

```bash
npm run test:wallet-monitoring
```

This will test:
- ✅ Database connection
- ✅ Email service initialization
- ✅ Send test email (if enabled)
- ✅ Wallet balance checking
- ✅ Alert creation and throttling
- ✅ Alert history queries
- ✅ Statistics generation
- ✅ Configuration updates

### Step 5: Start the API Server

```bash
npm start
```

The wallet monitoring system will:
1. Initialize on server startup
2. Schedule daily checks at 9 AM UTC (configurable)
3. Send alerts when balance < 0.05 BNB
4. Track all alerts in the database

## Configuration Reference

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `WALLET_BALANCE_CHECK_ENABLED` | Yes | `false` | Enable/disable monitoring |
| `WALLET_BALANCE_CHECK_SCHEDULE` | No | `0 9 * * *` | Cron schedule (daily 9 AM) |
| `WALLET_BALANCE_LOW_THRESHOLD_BNB` | No | `0.05` | Alert threshold in BNB |
| `GAME_ADMIN_ADDRESS` | Yes | - | Wallet address to monitor |
| `MONITORED_WALLET_NAME` | No | `Game Admin Wallet` | Descriptive name |
| `EMAIL_ALERTS_ENABLED` | Yes | `false` | Enable/disable emails |
| `EMAIL_FROM` | Yes | - | Sender email address |
| `EMAIL_TO` | Yes | - | Recipient emails (comma-separated) |
| `GMAIL_USER` | Yes | - | Gmail account |
| `GMAIL_APP_PASSWORD` | Yes | - | 16-char app password |
| `BSC_MAINNET_RPC_URL` | Yes | - | BSC RPC endpoint |

### Cron Schedule Format

The `WALLET_BALANCE_CHECK_SCHEDULE` uses standard cron syntax:

```
┌────────────── minute (0-59)
│ ┌──────────── hour (0-23)
│ │ ┌────────── day of month (1-31)
│ │ │ ┌──────── month (1-12)
│ │ │ │ ┌────── day of week (0-7, 0/7=Sunday)
│ │ │ │ │
* * * * *
```

**Examples:**
- `0 9 * * *` - Every day at 9 AM
- `0 */4 * * *` - Every 4 hours
- `0 12 * * 1` - Every Monday at noon
- `*/30 * * * *` - Every 30 minutes

## Admin API Endpoints

All endpoints require the `X-Admin-Secret` header.

### 1. Manual Balance Check

**POST** `/api/admin/wallet-balance/check`

Immediately checks wallet balance and sends alerts if needed.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "walletName": "Game Admin Wallet",
      "walletAddress": "0x...",
      "balance": "0.03",
      "balanceNumber": 0.03,
      "threshold": "0.05",
      "thresholdNumber": 0.05,
      "belowThreshold": true,
      "alertSent": true
    }
  ]
}
```

### 2. Get Alert History

**GET** `/api/admin/wallet-balance/alerts?walletAddress=0x...&limit=50`

Query parameters:
- `walletAddress` (optional) - Filter by wallet
- `limit` (optional, default: 50) - Number of results

**Response:**
```json
{
  "success": true,
  "data": {
    "count": 3,
    "alerts": [
      {
        "_id": "...",
        "walletName": "Game Admin Wallet",
        "walletAddress": "0x...",
        "balance": "0.03",
        "threshold": "0.05",
        "alertSentAt": "2024-01-15T09:00:00.000Z",
        "emailSent": true,
        "resolved": false
      }
    ]
  }
}
```

### 3. Get Unresolved Alerts

**GET** `/api/admin/wallet-balance/alerts/unresolved?limit=50`

Returns only alerts that haven't been resolved yet.

### 4. Get Statistics

**GET** `/api/admin/wallet-balance/stats?days=7`

Query parameters:
- `days` (optional, default: 7) - Time period for stats

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAlerts": 5,
    "unresolvedAlerts": 1,
    "emailsSent": 5,
    "emailFailures": 0,
    "averageResponseTime": 7200000,
    "alertsByWallet": {
      "0x...": 5
    },
    "timeframe": "Last 7 days"
  }
}
```

### 5. Get Configuration

**GET** `/api/admin/wallet-balance/config`

Returns current monitoring configuration.

### 6. Update Configuration

**PUT** `/api/admin/wallet-balance/config`

**Request Body:**
```json
{
  "walletAddress": "0x...",
  "walletName": "New Wallet Name",
  "threshold": 0.1
}
```

All fields are optional. Only provided fields will be updated.

### 7. Test Email

**POST** `/api/admin/wallet-balance/test-email`

Sends a test email to verify Gmail configuration.

**Response:**
```json
{
  "success": true,
  "data": {
    "messageId": "<...@gmail.com>",
    "recipients": ["admin@example.com"]
  },
  "message": "Test email sent successfully"
}
```

## Alert Flow

### When Balance is Low

1. **Scheduled Check** (daily at 9 AM)
   - Cron job triggers `walletBalanceMonitor.checkAllWallets()`

2. **Balance Query**
   - Queries on-chain balance via BSC RPC
   - Compares to threshold (0.05 BNB default)

3. **Throttle Check**
   - Queries database for recent alerts
   - Enforces 24-hour cooldown between alerts

4. **Email Alert**
   - Sends HTML email via Gmail
   - Includes wallet details, balance, BscScan link

5. **Database Record**
   - Saves alert to MongoDB
   - Tracks email status and recipients

### When Balance Recovers

1. **Scheduled Check** (next day)
   - Balance now above threshold

2. **Auto-Resolution**
   - Finds unresolved alerts for this wallet
   - Marks them as resolved
   - Updates `resolvedAt` timestamp

3. **Database Update**
   - Alert status: `resolved: true`
   - No email sent (silent resolution)

## Email Template

The alert email includes:

- **Subject**: `🚨 Low Balance Alert: [Wallet Name]`
- **Header**: Gradient purple banner (matches app theme)
- **Alert Box**: Red warning with urgency indicator
- **Details Table**:
  - Wallet Name
  - Wallet Address
  - Current Balance (formatted)
  - Threshold
  - Network
  - Timestamp
- **Impact**: Explains why low balance matters
- **Action**: Instructions to top up wallet
- **BscScan Button**: Direct link to wallet on explorer

## Database Schema

### WalletBalanceAlert Collection

```javascript
{
  walletAddress: String,      // Lowercase, indexed
  walletName: String,
  balance: String,            // Formatted string (e.g., "0.03")
  balanceNumber: Number,      // Numeric value for queries
  threshold: String,
  thresholdNumber: Number,
  network: String,            // "BSC Mainnet"
  chainId: Number,            // 56
  alertSentAt: Date,          // Timestamp of alert
  emailSent: Boolean,
  emailRecipients: [String],
  emailError: String,         // If email failed
  resolved: Boolean,          // Auto-resolved when topped up
  resolvedAt: Date,
  notes: String,              // Admin notes
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `walletAddress + alertSentAt` (compound)
- `resolved + alertSentAt` (compound)
- `createdAt`

## Troubleshooting

### Email Not Sending

1. **Check Gmail App Password**
   - Must be 16-character app password, not regular password
   - Regenerate if needed via Google Account settings

2. **Verify 2FA Enabled**
   - App passwords require 2FA on Gmail account

3. **Check Environment Variables**
   ```bash
   EMAIL_ALERTS_ENABLED=true
   GMAIL_USER=your-email@gmail.com
   GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
   EMAIL_TO=recipient@example.com
   ```

4. **Test Email Configuration**
   ```bash
   # Via API
   curl -X POST http://localhost:3000/api/admin/wallet-balance/test-email \
     -H "X-Admin-Secret: your-admin-secret"
   
   # Via test script
   npm run test:wallet-monitoring
   ```

5. **Check Logs**
   ```bash
   tail -f logs/api.log | grep -i email
   ```

### Alerts Not Triggering

1. **Check Monitoring Enabled**
   ```bash
   WALLET_BALANCE_CHECK_ENABLED=true
   ```

2. **Verify Cron Schedule**
   - Check `cronJobsService.getStatus()` API endpoint
   - Ensure cron job is scheduled

3. **Check Wallet Address**
   ```bash
   GAME_ADMIN_ADDRESS=0x...  # Must be valid address
   ```

4. **Manual Check**
   ```bash
   curl -X POST http://localhost:3000/api/admin/wallet-balance/check \
     -H "X-Admin-Secret: your-admin-secret"
   ```

5. **Check Threshold**
   - If balance > threshold, no alert sent
   - Adjust `WALLET_BALANCE_LOW_THRESHOLD_BNB` if needed

### Throttling Issues

**Symptom**: Alerts not sending even though balance is low

**Cause**: 24-hour throttling prevents duplicate alerts

**Solution**:
1. Check alert history: `GET /api/admin/wallet-balance/alerts`
2. Look for recent alert (within 24 hours)
3. Wait for cooldown period to expire
4. Or manually resolve old alert to allow new one

### Database Errors

1. **MongoDB Connection**
   ```bash
   MONGODB_URI=mongodb+srv://...
   ```

2. **Test Connection**
   ```bash
   npm run test:wallet-monitoring
   ```

3. **Check Indexes**
   ```javascript
   db.walletbalancealerts.getIndexes()
   ```

## Best Practices

### Security

1. **Never commit .env file**
   - Contains Gmail app password
   - Use `.env.example` for documentation

2. **Rotate App Passwords**
   - Regenerate quarterly
   - Revoke old passwords immediately

3. **Limit Email Recipients**
   - Only authorized administrators
   - Use distribution list for scaling

### Operations

1. **Monitor Alert History**
   - Review alerts weekly
   - Track average response time
   - Identify patterns

2. **Set Appropriate Threshold**
   - Consider daily transaction volume
   - Factor in gas price volatility
   - Maintain safety margin (0.05-0.1 BNB recommended)

3. **Test Before Production**
   - Run full test suite
   - Send test emails
   - Verify manual checks work

4. **Document Top-Up Process**
   - Who has access to funds?
   - How quickly can wallet be topped up?
   - Backup procedures if primary fails

### Monitoring

1. **Check Cron Job Status**
   ```bash
   GET /api/admin/finalization/status
   ```

2. **Review Unresolved Alerts**
   ```bash
   GET /api/admin/wallet-balance/alerts/unresolved
   ```

3. **Track Statistics**
   ```bash
   GET /api/admin/wallet-balance/stats?days=30
   ```

## Testing

### Unit Tests

Run the comprehensive test suite:

```bash
npm run test:wallet-monitoring
```

Tests include:
- Database connection
- Email service initialization
- Balance checking
- Alert creation
- Throttling logic
- Alert history queries
- Statistics generation
- Configuration updates

### Manual Testing

1. **Test Email**
   ```bash
   curl -X POST http://localhost:3000/api/admin/wallet-balance/test-email \
     -H "X-Admin-Secret: your-admin-secret"
   ```

2. **Manual Balance Check**
   ```bash
   curl -X POST http://localhost:3000/api/admin/wallet-balance/check \
     -H "X-Admin-Secret: your-admin-secret"
   ```

3. **Query Alert History**
   ```bash
   curl -X GET http://localhost:3000/api/admin/wallet-balance/alerts \
     -H "X-Admin-Secret: your-admin-secret"
   ```

4. **Get Statistics**
   ```bash
   curl -X GET http://localhost:3000/api/admin/wallet-balance/stats \
     -H "X-Admin-Secret: your-admin-secret"
   ```

## Maintenance

### Regular Tasks

- **Weekly**: Review alert history and statistics
- **Monthly**: Verify Gmail app password still valid
- **Quarterly**: Rotate Gmail app password
- **As Needed**: Adjust threshold based on gas prices

### Updating Configuration

To change the monitored wallet or threshold:

```bash
curl -X PUT http://localhost:3000/api/admin/wallet-balance/config \
  -H "X-Admin-Secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "0x...",
    "walletName": "New Wallet",
    "threshold": 0.1
  }'
```

No server restart required - changes take effect immediately.

## Support

For issues or questions:

1. Check this documentation
2. Review logs: `logs/api.log`
3. Run test suite: `npm run test:wallet-monitoring`
4. Check admin API endpoints for status
5. Contact development team with logs and error details

## License

MIT License - Part of Magic World Token project
