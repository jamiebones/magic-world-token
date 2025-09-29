# Magic World Token API

A REST API service for blockchain integration, enabling games to distribute Magic World Tokens to players efficiently and securely.

## 📁 Project Structure

```
api/
├── contracts/           # Contract ABI files for blockchain integration
│   ├── MagicWorldToken.json
│   ├── MagicWorldGame.json
│   └── IMagicWorldToken.json
├── src/
│   ├── services/
│   │   └── blockchain.js  # References local ABI files from contracts/
│   └── ...
├── Dockerfile
├── railway.json
└── .env.example
```

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

## 🎮 Game Integration

### JavaScript/Node.js with Axios

```javascript
const axios = require('axios');

class MagicWorldTokenAPI {
    constructor(apiKey, baseUrl = 'http://localhost:3000') {
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
        this.headers = { 'X-API-Key': apiKey };
    }

    // ==========================================
    // HEALTH CHECK ENDPOINTS
    // ==========================================

    /**
     * Basic health check
     */
    async getHealth() {
        const response = await axios.get(`${this.baseUrl}/health`);
        return response.data;
    }

    /**
     * Detailed health check with contract verification
     */
    async getDetailedHealth() {
        const response = await axios.get(`${this.baseUrl}/health/detailed`);
        return response.data;
    }

    // ==========================================
    // TOKEN DISTRIBUTION ENDPOINTS
    // ==========================================

    /**
     * Distribute different amounts to multiple players
     * @param {string[]} recipients - Array of player addresses
     * @param {string[]} amounts - Array of token amounts (in tokens, not wei)
     * @param {string} reason - Reason for distribution
     */
    async distributeTokens(recipients, amounts, reason = 'Token Distribution') {
        const response = await axios.post(`${this.baseUrl}/api/tokens/distribute`, {
            recipients,
            amounts,
            reason
        }, { headers: this.headers });

        return response.data;
    }

    /**
     * Distribute equal amounts to multiple players (gas efficient)
     * @param {string[]} recipients - Array of player addresses
     * @param {string} amount - Token amount per player
     * @param {string} reason - Reason for distribution
     */
    async distributeEqualTokens(recipients, amount, reason = 'Equal Token Distribution') {
        const response = await axios.post(`${this.baseUrl}/api/tokens/distribute-equal`, {
            recipients,
            amount,
            reason
        }, { headers: this.headers });

        return response.data;
    }

    /**
     * Estimate gas cost for distribution
     * @param {string} method - 'distributeRewards' or 'distributeEqualRewards'
     * @param {string[]} recipients - Array of player addresses
     * @param {string[]|string} amountsOrAmount - Amounts array or single amount
     */
    async estimateGas(method, recipients, amountsOrAmount) {
        const data = { method, recipients };

        if (method === 'distributeRewards') {
            data.amounts = amountsOrAmount;
        } else {
            data.amount = amountsOrAmount;
        }

        const response = await axios.post(`${this.baseUrl}/api/tokens/estimate-gas`, data, {
            headers: this.headers
        });

        return response.data;
    }

    // ==========================================
    // TOKEN QUERY ENDPOINTS
    // ==========================================

    /**
     * Get player's token balance
     * @param {string} address - Player's wallet address
     */
    async getPlayerBalance(address) {
        const response = await axios.get(`${this.baseUrl}/api/tokens/balance/${address}`, {
            headers: this.headers
        });

        return response.data;
    }

    /**
     * Get contract statistics
     */
    async getContractStats() {
        const response = await axios.get(`${this.baseUrl}/api/tokens/stats`, {
            headers: this.headers
        });

        return response.data;
    }

    /**
     * Check transaction status
     * @param {string} txHash - Transaction hash
     */
    async getTransactionStatus(txHash) {
        const response = await axios.get(`${this.baseUrl}/api/tokens/transaction/${txHash}`, {
            headers: this.headers
        });

        return response.data;
    }

    // ==========================================
    // PLAYER ENDPOINTS
    // ==========================================

    /**
     * Get player statistics
     * @param {string} address - Player's wallet address
     */
    async getPlayerStats(address) {
        const response = await axios.get(`${this.baseUrl}/api/players/stats/${address}`, {
            headers: this.headers
        });

        return response.data;
    }

    /**
     * Get player's token balance (alternative endpoint)
     * @param {string} address - Player's wallet address
     */
    async getPlayerBalanceAlt(address) {
        const response = await axios.get(`${this.baseUrl}/api/players/balance/${address}`, {
            headers: this.headers
        });

        return response.data;
    }

    /**
     * Validate Ethereum address
     * @param {string} address - Address to validate
     */
    async validateAddress(address) {
        const response = await axios.get(`${this.baseUrl}/api/players/validate/${address}`, {
            headers: this.headers
        });

        return response.data;
    }
}

// ==========================================
// USAGE EXAMPLES
// ==========================================

// Initialize API client
const tokenAPI = new MagicWorldTokenAPI('your-api-key-here');

// Example 1: Health Check
async function checkHealth() {
    try {
        const health = await tokenAPI.getHealth();
        console.log('Service Status:', health.status);
        console.log('Uptime:', health.uptime, 'seconds');
    } catch (error) {
        console.error('Health check failed:', error.response?.data || error.message);
    }
}

// Example 2: Distribute Tokens (Different Amounts)
async function distributeTournamentRewards() {
    try {
        const result = await tokenAPI.distributeTokens(
            [
                '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611', // 1st place
                '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612', // 2nd place
                '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3613'  // 3rd place
            ],
            ['1000', '500', '250'], // MWT tokens
            'Weekly Tournament Prizes'
        );

        console.log('Transaction Hash:', result.data.transactionHash);
        console.log('Block Number:', result.data.blockNumber);
        console.log('Gas Used:', result.data.gasUsed);
    } catch (error) {
        console.error('Distribution failed:', error.response?.data || error.message);
    }
}

// Example 3: Distribute Equal Tokens (Gas Efficient)
async function distributeDailyRewards() {
    try {
        const activePlayers = [
            '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611',
            '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612',
            '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3613'
        ];

        const result = await tokenAPI.distributeEqualTokens(
            activePlayers,
            '10', // 10 MWT tokens each
            'Daily Login Bonus'
        );

        console.log('Distributed to', result.data.recipients, 'players');
        console.log('Total tokens distributed:', result.data.totalAmount);
    } catch (error) {
        console.error('Equal distribution failed:', error.response?.data || error.message);
    }
}

// Example 4: Get Player Balance
async function checkPlayerBalance() {
    try {
        const balance = await tokenAPI.getPlayerBalance('0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611');
        console.log('Player Balance:', balance.data.balance, balance.data.currency);
    } catch (error) {
        console.error('Balance check failed:', error.response?.data || error.message);
    }
}

// Example 5: Get Player Statistics
async function getPlayerStats() {
    try {
        const stats = await tokenAPI.getPlayerStats('0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611');
        console.log('Daily Received:', stats.data.dailyReceived);
        console.log('Total Earned:', stats.data.totalEarned);
        console.log('Last Reward:', stats.data.lastReward);
    } catch (error) {
        console.error('Stats retrieval failed:', error.response?.data || error.message);
    }
}

// Example 6: Estimate Gas Cost
async function estimateDistributionCost() {
    try {
        const estimate = await tokenAPI.estimateGas(
            'distributeEqualRewards',
            ['0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611', '0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3612'],
            '25'
        );

        console.log('Estimated Gas:', estimate.data.gasEstimate);
        console.log('Estimated Cost (ETH):', estimate.data.estimatedCostETH);
    } catch (error) {
        console.error('Gas estimation failed:', error.response?.data || error.message);
    }
}

// Example 7: Check Transaction Status
async function checkTransaction(txHash) {
    try {
        const status = await tokenAPI.getTransactionStatus(txHash);
        console.log('Transaction Status:', status.data.status);
        console.log('Block Number:', status.data.blockNumber);
        console.log('Gas Used:', status.data.gasUsed);
    } catch (error) {
        console.error('Transaction check failed:', error.response?.data || error.message);
    }
}

// Example 8: Validate Address
async function validatePlayerAddress() {
    try {
        const validation = await tokenAPI.validateAddress('0x742d35Cc6634C0532925a3b8D6Ac6f1b478c3611');
        console.log('Address Valid:', validation.data.isValid);
        console.log('Checksum Address:', validation.data.checksumAddress);
    } catch (error) {
        console.error('Address validation failed:', error.response?.data || error.message);
    }
}

// Example 9: Get Contract Statistics
async function getSystemStats() {
    try {
        const stats = await tokenAPI.getContractStats();
        console.log('Total Distributed:', stats.data.totalDistributed);
        console.log('Unique Players:', stats.data.uniquePlayers);
        console.log('Contract Balance:', stats.data.contractBalance);
    } catch (error) {
        console.error('Stats retrieval failed:', error.response?.data || error.message);
    }
}

// Example 10: Comprehensive Game Integration
async function handleGameEvent(eventType, players, rewards) {
    try {
        switch (eventType) {
            case 'daily_login':
                await tokenAPI.distributeEqualTokens(players, '5', 'Daily Login Reward');
                break;

            case 'match_win':
                // Different rewards based on performance
                await tokenAPI.distributeTokens(
                    players.map(p => p.address),
                    players.map(p => p.reward.toString()),
                    'Match Victory Rewards'
                );
                break;

            case 'achievement':
                for (const player of players) {
                    await tokenAPI.distributeTokens(
                        [player.address],
                        [player.reward.toString()],
                        `Achievement: ${player.achievement}`
                    );
                }
                break;

            case 'tournament':
                await tokenAPI.distributeTokens(
                    players.map(p => p.address),
                    players.map(p => p.prize.toString()),
                    'Tournament Prizes'
                );
                break;
        }

        console.log(`${eventType} rewards distributed successfully`);
    } catch (error) {
        console.error(`Failed to handle ${eventType}:`, error.response?.data || error.message);
        throw error;
    }
}

// Export for use in other modules
module.exports = MagicWorldTokenAPI;
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

### Railway Deployment (Recommended)

Railway provides an easy way to deploy your API with automatic scaling, databases, and monitoring.

#### Prerequisites
- Railway account ([sign up here](https://railway.app))
- GitHub repository with your API code
- MongoDB Atlas account (for database)

#### GitHub-Based Deployment

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy Magic World Token API"
   git push origin main
   ```

2. **Connect to Railway:**
   - Go to [Railway.app](https://railway.app) and sign in
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository: `jamiebones/magic-world-token`
   - Choose the `api/` folder as the root directory

3. **Configure Environment Variables:**
   In your Railway project settings, add these variables:

   ```bash
   # Required Variables
   NODE_ENV=production
   PORT=3000
   BLOCKCHAIN_NETWORK=bscTestnet
   PRIVATE_KEY=your-production-private-key
   RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
   TOKEN_CONTRACT_ADDRESS=0x65bC50288b0264ae038EFE6065962dc247eC66Ce
   GAME_CONTRACT_ADDRESS=0xa13948CE5FEc61163054d56fA45ac28Fa6870e08
   JWT_SECRET=your-very-strong-jwt-secret-here
   API_KEY_SECRET=your-api-key-secret-here
   MONGODB_URI=your-mongodb-atlas-connection-string

   # Optional Variables
   BSCSCAN_API_KEY=your-bscscan-api-key
   RATE_LIMIT_MAX_REQUESTS=1000
   MAX_BATCH_SIZE=200
   ```

4. **Deploy:**
   Railway will automatically build and deploy when you push to your main branch.

5. **Monitor Deployment:**
   - View build logs in Railway dashboard
   - Check your app URL once deployed
   - Monitor performance and logs

#### Railway Configuration Files

The following files are included for Railway deployment:

- **`railway.json`**: Railway-specific configuration
- **`.env.example`**: Template for environment variables

#### Database Setup

Railway provides PostgreSQL by default, but this API uses MongoDB Atlas:

1. Create a MongoDB Atlas cluster
2. Get your connection string
3. Add it as `MONGODB_URI` environment variable
4. Run the setup script (optional):
   ```bash
   railway run npm run setup:mongo
   ```

#### Health Checks & Monitoring

Railway automatically monitors your app using the `/health` endpoint. In your Railway dashboard you can:

- View real-time logs
- Monitor performance metrics
- Set up alerts for downtime
- Scale your application
- View environment variables

#### Automatic Deployments

Railway will automatically redeploy when you push changes to your main branch:

```bash
git add .
git commit -m "Update API functionality"
git push origin main
```

Railway will build and deploy automatically.

#### Scaling

Railway automatically scales your app based on traffic. For high-traffic games:

1. Upgrade your Railway plan
2. Increase rate limits in environment variables
3. Monitor performance with Railway's dashboard

### Alternative Deployment Options

#### Heroku Deployment
```bash
# Create Heroku app
heroku create your-api-name

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=your-mongodb-uri
# ... set other variables

# Deploy
git push heroku main
```

#### Docker Deployment
```bash
# Build Docker image
docker build -t magic-world-api .

# Run locally
docker run -p 3000:3000 --env-file .env magic-world-api

# Deploy to any container service (AWS ECS, Google Cloud Run, etc.)
```

### Environment Configuration
```bash
# Production settings
NODE_ENV=production
PORT=3000

# Blockchain configuration
BLOCKCHAIN_NETWORK=bscTestnet
PRIVATE_KEY=your-production-private-key
RPC_URL=https://data-seed-prebsc-1-s1.binance.org:8545/
TOKEN_CONTRACT_ADDRESS=0x65bC50288b0264ae038EFE6065962dc247eC66Ce
GAME_CONTRACT_ADDRESS=0xa13948CE5FEc61163054d56fA45ac28Fa6870e08

# Security
JWT_SECRET=your-strong-jwt-secret
API_KEY_SECRET=your-api-key-secret
RATE_LIMIT_MAX_REQUESTS=1000

# Database (optional)
DATABASE_URL=postgresql://user:pass@localhost:5432/magic_world_token
REDIS_URL=redis://localhost:6379
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