# Bot API Authentication Guide

## Overview

All Bot API endpoints require authentication using an API key with **'bot' permission**. This ensures only authorized applications can access price data and execute trades.

---

## Quick Start

### 1. Generate an API Key (Admin Only)

Use the admin endpoint to generate a bot API key:

```bash
curl -X POST http://localhost:3000/api/admin/generate-key \
  -H "X-Admin-Secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trading Bot Production Key",
    "permissions": ["bot"],
    "description": "API key for automated trading bot"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "mwt_a1b2c3d4e5f6789012345678901234567890...",
    "id": "bot-key-001",
    "name": "Trading Bot Production Key",
    "permissions": ["bot"],
    "createdAt": "2025-10-19T10:00:00.000Z"
  }
}
```

⚠️ **Important:** Save the `apiKey` value immediately - it's only shown once!

### 2. Configure Your Bot

Add the API key to your bot's environment variables:

```bash
# .env file
BOT_API_KEY=mwt_a1b2c3d4e5f6789012345678901234567890...
BOT_API_URL=http://localhost:3000/api/bot
```

### 3. Use the API Key in Requests

Include the API key in all bot API requests:

**Method 1: X-API-Key Header (Recommended)**
```javascript
const axios = require('axios');

const headers = {
    'X-API-Key': process.env.BOT_API_KEY,
    'Content-Type': 'application/json'
};

const response = await axios.get('http://localhost:3000/api/bot/prices/current', {
    headers
});
```

**Method 2: Authorization Bearer Token**
```javascript
const headers = {
    'Authorization': `Bearer ${process.env.BOT_API_KEY}`,
    'Content-Type': 'application/json'
};

const response = await axios.get('http://localhost:3000/api/bot/prices/current', {
    headers
});
```

---

## Permission System

### Available Permissions

- **`bot`** - Access to all bot endpoints (prices, trades, balances, config)
- **`distribute`** - Access to token distribution endpoints (for game servers)
- **`read`** - Read-only access to public endpoints
- **`admin`** - Full administrative access (use with caution)

### Bot Endpoints Require 'bot' Permission

All endpoints under `/api/bot/*` require the **'bot'** permission:

✅ **Allowed with 'bot' permission:**
- `GET /api/bot/prices/current`
- `GET /api/bot/prices/deviation`
- `POST /api/bot/trade/execute`
- `GET /api/bot/balances`
- All other bot endpoints

❌ **Denied without 'bot' permission:**
- API keys with only `["read"]` will get 403 Forbidden
- API keys with only `["distribute"]` will get 403 Forbidden
- No API key will get 401 Unauthorized

### Multiple Permissions

You can grant multiple permissions to a single API key:

```bash
curl -X POST http://localhost:3000/api/admin/generate-key \
  -H "X-Admin-Secret: your-admin-secret" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Combined Bot & Game Server Key",
    "permissions": ["bot", "distribute"],
    "description": "Can trade AND distribute tokens"
  }'
```

---

## Testing Authentication

### Test Without API Key (Should Fail)

```bash
curl http://localhost:3000/api/bot/prices/current
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "message": "API key required",
    "code": "MISSING_API_KEY"
  }
}
```
**Status Code:** `401 Unauthorized`

### Test With Invalid API Key (Should Fail)

```bash
curl http://localhost:3000/api/bot/prices/current \
  -H "X-API-Key: mwt_invalid_key"
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "message": "Invalid API key",
    "code": "INVALID_API_KEY"
  }
}
```
**Status Code:** `401 Unauthorized`

### Test With Wrong Permission (Should Fail)

```bash
# Using an API key with only 'distribute' permission
curl http://localhost:3000/api/bot/prices/current \
  -H "X-API-Key: mwt_distribute_only_key"
```

**Expected Response:**
```json
{
  "success": false,
  "error": {
    "message": "Insufficient permissions",
    "code": "PERMISSION_DENIED",
    "required": "bot",
    "current": ["distribute"]
  }
}
```
**Status Code:** `403 Forbidden`

### Test With Valid 'bot' Permission (Should Succeed)

```bash
curl http://localhost:3000/api/bot/prices/current \
  -H "X-API-Key: mwt_valid_bot_key_here"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "mwtBnb": { "price": 0.00014219, ... },
    "mwtUsd": { "price": 0.00008523, ... },
    ...
  }
}
```
**Status Code:** `200 OK`

---

## Managing API Keys

### List All Keys

```bash
curl http://localhost:3000/api/admin/keys \
  -H "X-Admin-Secret: your-admin-secret"
```

### Revoke a Key

```bash
curl -X POST http://localhost:3000/api/admin/keys/{key-id}/revoke \
  -H "X-Admin-Secret: your-admin-secret"
```

### Check Key Usage

API keys automatically track:
- Last used timestamp
- Usage count
- Is active status

View this in the admin keys list endpoint.

---

## Integration Testing

### Running Tests With API Key

```bash
# Set API key environment variable
export API_KEY=mwt_your_bot_api_key_here

# Or use BOT_API_KEY
export BOT_API_KEY=mwt_your_bot_api_key_here

# Run tests
npm run test:integration
```

### Test Script Configuration

The test script automatically uses `API_KEY` or `BOT_API_KEY` from environment:

```javascript
// In test-bot-integration.js
const API_KEY = process.env.BOT_API_KEY || process.env.API_KEY;

if (!API_KEY) {
    console.error('❌ Error: API_KEY or BOT_API_KEY environment variable is required');
    process.exit(1);
}

// All requests include the API key
const response = await axios.get(url, {
    headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
    }
});
```

---

## Security Best Practices

### 1. Keep API Keys Secret
```bash
# ✅ Good - Use environment variables
BOT_API_KEY=mwt_abc123...

# ❌ Bad - Never hardcode in source files
const apiKey = "mwt_abc123...";
```

### 2. Use Separate Keys for Different Environments
```bash
# Development
DEV_BOT_API_KEY=mwt_dev_key...

# Staging
STAGING_BOT_API_KEY=mwt_staging_key...

# Production
PROD_BOT_API_KEY=mwt_prod_key...
```

### 3. Rotate Keys Regularly
```bash
# Generate new key
curl -X POST http://localhost:3000/api/admin/generate-key \
  -H "X-Admin-Secret: your-admin-secret" \
  -d '{"name":"Bot Key v2","permissions":["bot"]}'

# Update your .env with new key
# Then revoke old key
curl -X POST http://localhost:3000/api/admin/keys/old-key-id/revoke \
  -H "X-Admin-Secret: your-admin-secret"
```

### 4. Monitor Key Usage
- Check `lastUsed` timestamp
- Review `usageCount`
- Investigate unexpected usage patterns
- Revoke compromised keys immediately

### 5. Minimum Permission Principle
Only grant the permissions actually needed:

```bash
# ✅ Good - Only bot permission
{"permissions": ["bot"]}

# ❌ Avoid - Unnecessary admin access
{"permissions": ["bot", "admin"]}
```

---

## Error Codes Reference

| Code | Status | Meaning | Solution |
|------|--------|---------|----------|
| `MISSING_API_KEY` | 401 | No API key provided | Add X-API-Key header |
| `INVALID_API_KEY` | 401 | API key not found or invalid | Check key value, ensure it starts with `mwt_` |
| `PERMISSION_DENIED` | 403 | Key lacks required permission | Generate new key with 'bot' permission |
| `KEY_REVOKED` | 401 | API key was revoked | Generate new API key |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait and retry with backoff |

---

## Troubleshooting

### Problem: "API key required"
**Cause:** No API key in request headers  
**Solution:**
```javascript
// Add header to ALL requests
headers: {
    'X-API-Key': process.env.BOT_API_KEY
}
```

### Problem: "Invalid API key"
**Cause:** API key is wrong or doesn't exist  
**Solutions:**
- Verify key starts with `mwt_`
- Check for typos or truncation
- Confirm key exists: `curl http://localhost:3000/api/admin/keys -H "X-Admin-Secret: ..."`
- Generate new key if lost

### Problem: "Insufficient permissions"
**Cause:** API key lacks 'bot' permission  
**Solution:**
```bash
# Generate new key WITH 'bot' permission
curl -X POST http://localhost:3000/api/admin/generate-key \
  -H "X-Admin-Secret: your-admin-secret" \
  -d '{"name":"Bot Key","permissions":["bot"]}'
```

### Problem: Integration tests fail with "API key required"
**Cause:** Environment variable not set  
**Solution:**
```bash
# Add to .env
API_KEY=mwt_your_key_here

# Or export before running
export API_KEY=mwt_your_key_here
npm run test:integration
```

---

## Complete Example: Bot Setup

### 1. Generate API Key
```bash
curl -X POST http://localhost:3000/api/admin/generate-key \
  -H "X-Admin-Secret: $(cat .admin-secret)" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Trading Bot",
    "permissions": ["bot"],
    "description": "Maintains MWT peg at $0.01"
  }' | jq -r '.data.apiKey' > bot-api-key.txt
```

### 2. Configure Bot
```bash
# Add to .env
echo "BOT_API_KEY=$(cat bot-api-key.txt)" >> .env
```

### 3. Test Connection
```bash
node -e "
const axios = require('axios');
const apiKey = require('fs').readFileSync('bot-api-key.txt', 'utf8').trim();
axios.get('http://localhost:3000/api/bot/health', {
    headers: { 'X-API-Key': apiKey }
}).then(r => console.log('✅ Connected:', r.data))
  .catch(e => console.error('❌ Failed:', e.response?.data || e.message));
"
```

### 4. Run Bot
```bash
node bot.js
```

---

## Additional Resources

- **[API Documentation](http://localhost:3000/api-docs)** - Interactive Swagger docs
- **[Admin Endpoints](./README.md#admin-endpoints)** - API key management
- **[Example Bot](./examples/simple-bot.js)** - Working implementation
- **[Production Checklist](./PRODUCTION_CHECKLIST.md)** - Security review

---

**Questions?** Check the main README or API documentation for more details.
