# Magic World Token API

A REST API service for blockchain integration, enabling games to distribute Magic World Tokens to players efficiently and securely.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier available)
- Access to deployed Magic World Token contracts

### Installation

1. **Install dependencies:**
   ```bash
   cd api
   npm install
   ```

2. **Set up MongoDB Atlas:**
   ```bash
   npm run setup:mongo
   ```
   This will guide you through configuring your MongoDB Atlas connection.

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration (MongoDB URI will be set by setup script)
   ```

4. **Start the API:**
   ```bash
   # Development mode (with auto-reload)
   npm run dev

   # Production mode
   npm start
   ```

5. **Access documentation:**
   - API Documentation: http://localhost:3000/api-docs
   - Health Check: http://localhost:3000/health

## 📖 API Documentation

### Authentication
All API endpoints require authentication using an API key. Include your API key in the request header:

```
X-API-Key: your-api-key-here
```

Or as a Bearer token:
```
Authorization: Bearer your-api-key-here
```

### Core Endpoints

#### 🎁 Token Distribution

**Distribute Different Amounts** (for prizes, achievements)
```http
POST /api/tokens/distribute
Content-Type: application/json
X-API-Key: your-api-key

{
  "recipients": [
    "0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611",
    "0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612"
  ],
  "amounts": ["100", "50"],
  "reason": "Tournament Prize Distribution"
}
```

**Distribute Equal Amounts** (for daily rewards, more gas efficient)
```http
POST /api/tokens/distribute-equal
Content-Type: application/json
X-API-Key: your-api-key

{
  "recipients": [
    "0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611",
    "0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612"
  ],
  "amount": "10",
  "reason": "Daily Login Reward"
}
```

#### 💰 Player Information

**Get Player Balance**
```http
GET /api/players/balance/0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611
X-API-Key: your-api-key
```

**Get Player Statistics**
```http
GET /api/players/stats/0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611
X-API-Key: your-api-key
```

#### 📊 System Information

**Get Contract Statistics**
```http
GET /api/tokens/stats
X-API-Key: your-api-key
```

**Check Transaction Status**
```http
GET /api/tokens/transaction/0x1234567890abcdef...
X-API-Key: your-api-key
```

## 🎮 Game Integration Examples

### Unity (C#)
```csharp
using UnityEngine;
using System.Collections;
using System.Collections.Generic;

public class TokenAPI : MonoBehaviour 
{
    private string apiKey = "your-api-key";
    private string baseUrl = "http://localhost:3000/api";
    
    public IEnumerator DistributeTokens(List<string> players, List<string> amounts)
    {
        var data = new {
            recipients = players.ToArray(),
            amounts = amounts.ToArray(),
            reason = "Game Reward"
        };
        
        string json = JsonUtility.ToJson(data);
        
        using (UnityWebRequest request = UnityWebRequest.PostWwwForm(baseUrl + "/tokens/distribute", ""))
        {
            request.SetRequestHeader("X-API-Key", apiKey);
            request.SetRequestHeader("Content-Type", "application/json");
            request.uploadHandler = new UploadHandlerRaw(System.Text.Encoding.UTF8.GetBytes(json));
            
            yield return request.SendWebRequest();
            
            if (request.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("Tokens distributed successfully!");
            }
        }
    }
}
```

### JavaScript/Node.js
```javascript
const axios = require('axios');

class TokenAPI {
    constructor(apiKey, baseUrl = 'http://localhost:3000/api') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.headers = { 'X-API-Key': apiKey };
    }
    
    async distributeTokens(recipients, amounts, reason = 'Game Reward') {
        try {
            const response = await axios.post(`${this.baseUrl}/tokens/distribute`, {
                recipients,
                amounts,
                reason
            }, { headers: this.headers });
            
            return response.data;
        } catch (error) {
            console.error('Token distribution failed:', error.response?.data || error.message);
            throw error;
        }
    }
    
    async getPlayerBalance(playerAddress) {
        try {
            const response = await axios.get(`${this.baseUrl}/players/balance/${playerAddress}`, 
                { headers: this.headers });
            return response.data;
        } catch (error) {
            console.error('Failed to get player balance:', error.response?.data || error.message);
            throw error;
        }
    }
}

// Usage example
const tokenAPI = new TokenAPI('your-api-key');

// Reward players after a match
tokenAPI.distributeTokens(
    ['0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611', '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612'],
    ['100', '50'],
    'Match Victory Rewards'
).then(result => {
    console.log('Rewards distributed:', result);
});
```

### Python
```python
import requests
import json

class TokenAPI:
    def __init__(self, api_key, base_url="http://localhost:3000/api"):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    
    def distribute_tokens(self, recipients, amounts, reason="Game Reward"):
        data = {
            "recipients": recipients,
            "amounts": amounts,
            "reason": reason
        }
        
        response = requests.post(
            f"{self.base_url}/tokens/distribute",
            headers=self.headers,
            data=json.dumps(data)
        )
        
        return response.json()
    
    def get_player_balance(self, player_address):
        response = requests.get(
            f"{self.base_url}/players/balance/{player_address}",
            headers=self.headers
        )
        
        return response.json()

# Usage
api = TokenAPI('your-api-key')
result = api.distribute_tokens(
    ['0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611'],
    ['100'],
    'Achievement Unlocked'
)
print(f"Transaction hash: {result['data']['transactionHash']}")
```

### MongoDB Atlas Setup

The API uses MongoDB Atlas for persistent storage of API keys and usage analytics.

#### Quick Setup
```bash
npm run setup:mongo
```

#### Manual Setup
1. **Create MongoDB Atlas Account:**
   - Visit [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a free account and cluster

2. **Configure Database Access:**
   - Create a database user
   - Whitelist your IP (or use 0.0.0.0/0 for development)

3. **Get Connection String:**
   - Click "Connect" in your cluster
   - Choose "Connect your application"
   - Copy the connection string

4. **Update Environment:**
   ```bash
   # In your .env file
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/magic_world_token?retryWrites=true&w=majority
   ```

#### Database Schema
- **ApiKey Collection:** Stores API keys with permissions, usage stats, and metadata
- **Automatic Indexing:** Optimized for fast key lookups and analytics queries

## 📊 Monitoring & Analytics

### Health Checks
- Basic health: `GET /health`
- Detailed health: `GET /health/detailed`

### Logging
- All API requests logged with response times
- Blockchain transactions logged with gas usage
- Error tracking with stack traces
- Performance metrics

## 🚀 Production Deployment

### Environment Configuration
```bash
# Production settings
NODE_ENV=production
PORT=3000

# Blockchain configuration
BLOCKCHAIN_NETWORK=polygon
PRIVATE_KEY=your-production-private-key
RPC_URL=https://polygon-rpc.com
TOKEN_CONTRACT_ADDRESS=your-production-token-address
GAME_CONTRACT_ADDRESS=your-production-game-address

# Security
JWT_SECRET=your-strong-jwt-secret
API_KEY_SECRET=your-api-key-secret
RATE_LIMIT_MAX_REQUESTS=1000

# Database (optional)
DATABASE_URL=postgresql://user:pass@localhost:5432/magic_world_token
REDIS_URL=redis://localhost:6379
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name api.yourgame.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## 🎯 Use Cases

### 1. Daily Login Rewards
```javascript
// Reward all active players 10 tokens daily
await tokenAPI.distributeEqualRewards(activePlayers, "10", "Daily Login Bonus");
```

### 2. Tournament Prizes
```javascript
// Different prizes for tournament winners
await tokenAPI.distributeTokens(
    [winner, runnerUp, thirdPlace],
    ["1000", "500", "250"],
    "Weekly Tournament Prizes"
);
```

### 3. Achievement Rewards
```javascript
// Variable rewards based on achievement difficulty
const achievements = [
    { player: "0x123...", tokens: "50", achievement: "First Victory" },
    { player: "0x456...", tokens: "200", achievement: "100 Wins" }
];

for (const achievement of achievements) {
    await tokenAPI.distributeTokens([achievement.player], [achievement.tokens], achievement.achievement);
}
```

### 4. Real-time Balance Display
```javascript
// Show player's current token balance in game UI
const balance = await tokenAPI.getPlayerBalance(playerAddress);
updateUI(`You have ${balance.data.balance} MWT tokens`);
```

## 🆘 Support & Troubleshooting

### Common Issues

**Issue**: "Authentication failed"
**Solution**: Check your API key is correct and included in headers

**Issue**: "Invalid Ethereum address" 
**Solution**: Ensure wallet addresses are valid checksummed Ethereum addresses

**Issue**: "Rate limit exceeded"
**Solution**: Implement request queuing or contact admin to increase limits

**Issue**: "Blockchain service unavailable"
**Solution**: Check RPC URL is accessible and contracts are deployed

### Getting Help
- Check the `/health/detailed` endpoint for service status
- Review logs for detailed error information
- Contact support with your API key ID (not the full key)

## 📈 Next Steps

1. **Get API Key**: Contact admin to receive your game's API key
2. **Test Integration**: Use the development environment to test your integration
3. **Implement Features**: Start with basic token distribution
4. **Monitor Usage**: Use health endpoints and logs to monitor your integration
5. **Scale Up**: Move to production when ready

---

*Built for the Magic World Token ecosystem - enabling seamless blockchain gaming experiences.*