# Bot Permission Fix - Adding 'bot' to Valid Permissions

## Issue

When trying to generate an API key with `"permissions": ["bot"]`, the API returned validation errors:

```json
{
  "success": false,
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION_ERROR",
    "details": [{
      "msg": "Invalid permission - must be read, distribute, or admin"
    }]
  }
}
```

## Root Cause

The `'bot'` permission was added to bot routes but not to:
1. Admin route validation (express-validator)
2. ApiKey model enum (Mongoose schema)

## Files Fixed

### 1. `/api/src/routes/admin.js`

**Line ~243 - Updated validation:**
```javascript
// Before
body('permissions.*')
    .optional()
    .isIn(['read', 'distribute', 'admin'])
    .withMessage('Invalid permission - must be read, distribute, or admin'),

// After
body('permissions.*')
    .optional()
    .isIn(['read', 'distribute', 'bot', 'admin'])
    .withMessage('Invalid permission - must be read, distribute, bot, or admin'),
```

**Line ~169 - Updated Swagger docs:**
```javascript
// Before
*                   enum: [read, distribute, admin]
*                 description: Permissions for the API key

// After
*                   enum: [read, distribute, bot, admin]
*                 description: Permissions for the API key (read=public data, distribute=token distribution, bot=trading bot access, admin=full access)
```

### 2. `/api/src/models/ApiKey.js`

**Line ~25 - Updated schema enum:**
```javascript
// Before
permissions: [{
    type: String,
    enum: ['read', 'distribute', 'admin'],
    default: ['read']
}],

// After
permissions: [{
    type: String,
    enum: ['read', 'distribute', 'bot', 'admin'],
    default: ['read']
}],
```

## Deployment

### For Local Development
Changes are immediately effective after saving the files.

### For Railway Production
1. Commit and push changes:
   ```bash
   git add api/src/routes/admin.js api/src/models/ApiKey.js
   git commit -m "feat: add 'bot' permission to ApiKey model and admin validation"
   git push origin main
   ```

2. Railway will automatically deploy the changes

3. Wait for deployment to complete (~2-3 minutes)

## Testing After Deployment

### Generate Bot API Key
```bash
curl -X POST https://magic-world-token-production.up.railway.app/api/admin/generate-key \
  -H "X-Admin-Secret: JamieBonesIsFromOuterSpace" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trading Bot Key",
    "permissions": ["bot"],
    "description": "API key for automated trading bot"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "apiKey": "mwt_a1b2c3d4e5f6...",
    "id": "...",
    "name": "Trading Bot Key",
    "permissions": ["bot"],
    "createdAt": "2025-10-19T..."
  }
}
```

### Test Bot Endpoint
```bash
# Save the API key
export BOT_API_KEY="mwt_..."

# Test bot endpoint
curl https://magic-world-token-production.up.railway.app/api/bot/health \
  -H "X-API-Key: $BOT_API_KEY"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "priceOracle": true,
      "tradeExecutor": true,
      "database": true
    }
  }
}
```

## Valid Permissions Reference

| Permission | Description | Access |
|------------|-------------|--------|
| `read` | Read-only access to public endpoints | Basic info, stats |
| `distribute` | Token distribution to players | Game server operations |
| `bot` | Trading bot access | Price monitoring, trade execution |
| `admin` | Full administrative access | All permissions + admin endpoints |

## Permission Combinations

You can grant multiple permissions:

```bash
# Bot + Distribution (for integrated systems)
{
  "permissions": ["bot", "distribute"]
}

# Admin (has all permissions)
{
  "permissions": ["admin"]
}
```

## Status

✅ **FIXED** - Bot permission now accepted in:
- Admin route validation
- ApiKey Mongoose schema
- Swagger documentation

**Next Step:** Commit and deploy to Railway production.

---

**Date:** October 19, 2025  
**Issue:** Bot permission not in valid enum  
**Resolution:** Added 'bot' to both validation and schema
