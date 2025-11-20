# MWG Order Book Implementation Plan

## Project Overview
Build an order book system to allow clients to exchange MWG tokens for BNB without AMM slippage. Admin pays clients with MWG, clients receive BNB at agreed rates.

---

## Core Flow

### Primary Use Case: Admin Pays Client
1. **Client** creates BUY order (deposits BNB, wants MWG)
2. **Admin** sees order in dashboard
3. **Admin** fills order (sends MWG, receives BNB)
4. **Atomic swap** executed (client gets MWG, admin gets BNB)

---

## Phase 1: Smart Contract Development (Days 1-2)

### Task 1.1: Create MWGOrderBook.sol
**Location:** `contracts/MWGOrderBook.sol`

**Features:**
- Order struct with all necessary fields
- Buy/Sell order creation
- Order filling (partial and full)
- Order cancellation
- Order expiration handling
- Fee mechanism (optional)
- Events for all actions

**Key Functions:**
```solidity
function createBuyOrder(uint256 mwgAmount, uint256 pricePerMWG) external payable
function createSellOrder(uint256 mwgAmount, uint256 pricePerMWG) external
function fillBuyOrder(uint256 orderId, uint256 mwgAmount) external
function fillSellOrder(uint256 orderId, uint256 mwgAmount) external payable
function cancelOrder(uint256 orderId) external
function getActiveOrders() external view returns (Order[] memory)
function getUserOrders(address user) external view returns (Order[] memory)
```

**Events:**
```solidity
event OrderCreated(uint256 indexed orderId, address indexed user, OrderType orderType, uint256 mwgAmount, uint256 bnbAmount)
event OrderFilled(uint256 indexed orderId, address indexed filler, uint256 mwgAmount, uint256 bnbAmount)
event OrderCancelled(uint256 indexed orderId, address indexed user)
event OrderExpired(uint256 indexed orderId)
```

### Task 1.2: Security Features
- Reentrancy guards
- Access control (pause functionality)
- Minimum order amounts
- Maximum order expiration
- Safe math operations
- Input validation

### Task 1.3: Testing
**Location:** `test/MWGOrderBook.test.js`

**Test Cases:**
- ✅ Create buy order with BNB deposit
- ✅ Create sell order with MWG deposit
- ✅ Fill buy order successfully
- ✅ Fill sell order successfully
- ✅ Partial order fills
- ✅ Cancel active order
- ✅ Prevent double filling
- ✅ Order expiration
- ✅ Insufficient balance errors
- ✅ Price calculation accuracy
- ✅ Event emissions
- ✅ Access control

### Task 1.4: Deployment Script
**Location:** `scripts/deploy-orderbook.js`

**Script Actions:**
1. Deploy MWGOrderBook contract
2. Set MWG token address
3. Configure minimum order amounts
4. Set fee parameters (if any)
5. Verify on BSCScan
6. Save deployment info to `deployments/orderbook-bsc.json`

**Deliverables:**
- ✅ MWGOrderBook.sol contract
- ✅ Complete test suite (100% coverage)
- ✅ Deployment script
- ✅ Contract deployed to BSC testnet
- ✅ Contract deployed to BSC mainnet
- ✅ Contract verified on BSCScan

---

## Phase 2: Backend API Development (Days 3-4)

### Task 2.1: Database Models
**Location:** `api/src/orderbook/models/`

#### Order Model (`Order.js`)
```javascript
{
  orderId: String,              // On-chain order ID
  txHash: String,               // Creation transaction hash
  user: String,                 // User address (lowercase)
  orderType: String,            // 'BUY' or 'SELL'
  mwgAmount: String,            // Total MWG amount (wei string)
  bnbAmount: String,            // Total BNB amount (wei string)
  price: String,                // BNB per MWG (18 decimals)
  filled: String,               // Amount filled so far
  remaining: String,            // Amount remaining
  status: String,               // 'ACTIVE', 'FILLED', 'PARTIALLY_FILLED', 'CANCELLED', 'EXPIRED'
  createdAt: Date,
  expiresAt: Date,
  blockNumber: Number,
  fills: [{                     // Fill history
    fillId: String,
    amount: String,
    bnbAmount: String,
    filler: String,
    txHash: String,
    timestamp: Date
  }]
}
```

#### Trade Model (`Trade.js`)
```javascript
{
  tradeId: String,              // Unique trade ID
  orderId: String,              // Reference to order
  buyer: String,                // Buyer address
  seller: String,               // Seller address
  mwgAmount: String,            // MWG traded
  bnbAmount: String,            // BNB traded
  price: String,                // Execution price
  txHash: String,               // Transaction hash
  blockNumber: Number,
  timestamp: Date,
  orderType: String             // 'BUY_FILLED' or 'SELL_FILLED'
}
```

### Task 2.2: Order Book Service
**Location:** `api/src/orderbook/services/orderBookService.js`

**Class: OrderBookService**

**Methods:**
```javascript
// Order creation
async createBuyOrder(userAddress, mwgAmount, pricePerMWG, expiryHours)
async createSellOrder(adminAddress, mwgAmount, pricePerMWG, expiryHours)

// Order filling
async fillBuyOrder(orderId, mwgAmount, fillerAddress)
async fillSellOrder(orderId, mwgAmount, fillerAddress)

// Order management
async cancelOrder(orderId, userAddress)
async getOrder(orderId)
async getUserOrders(userAddress)
async getActiveOrders(orderType)  // 'BUY', 'SELL', or null for all

// Order book queries
async getBestBuyPrice()
async getBestSellPrice()
async getOrderBookDepth()
async getOrderBookStats()

// Order matching (for future automation)
async findMatchingOrders()
async suggestBestOrders(mwgAmount, orderType)
```

### Task 2.3: Event Listener Service
**Location:** `api/src/orderbook/services/eventListener.js`

**Purpose:** Sync blockchain events with database

**Events to Listen:**
- `OrderCreated` → Create Order record
- `OrderFilled` → Update Order, create Trade record
- `OrderCancelled` → Update Order status
- `OrderExpired` → Update Order status

**Implementation:**
```javascript
class OrderBookEventListener {
  constructor(orderBookContract, orderBookService)
  
  async start()
  async listenToOrderCreated()
  async listenToOrderFilled()
  async listenToOrderCancelled()
  async handleOrderCreated(event)
  async handleOrderFilled(event)
  async handleOrderCancelled(event)
  async syncHistoricalOrders(fromBlock)
}
```

### Task 2.4: API Routes
**Location:** `api/src/routes/orderbook.js`

**Endpoints:**

#### Public Endpoints (No Auth)
```javascript
GET  /api/orderbook/orders              // Get all active orders
GET  /api/orderbook/orders/:id          // Get specific order
GET  /api/orderbook/best-prices         // Get best bid/ask
GET  /api/orderbook/depth               // Get order book depth
GET  /api/orderbook/trades              // Get recent trades
GET  /api/orderbook/stats               // Get statistics
```

#### User Endpoints (API Key Auth)
```javascript
POST /api/orderbook/buy-order           // Create buy order
GET  /api/orderbook/my-orders           // Get user's orders
POST /api/orderbook/cancel/:id          // Cancel order
```

#### Admin Endpoints (Admin Auth)
```javascript
POST /api/orderbook/sell-order          // Create sell order
POST /api/orderbook/fill-buy/:id        // Fill buy order
POST /api/orderbook/admin/orders        // Get all orders (including inactive)
POST /api/orderbook/admin/emergency-cancel/:id  // Force cancel order
GET  /api/orderbook/admin/analytics     // Detailed analytics
```

### Task 2.5: Contract Integration
**Location:** `api/src/orderbook/contracts/`

**Files:**
- `MWGOrderBook.json` - Contract ABI
- `orderBookContract.js` - Contract instance & helper functions

**Helper Functions:**
```javascript
async function getOrderBookContract()
async function estimateGasForBuyOrder(mwgAmount, pricePerMWG, bnbAmount)
async function estimateGasForSellOrder(mwgAmount, pricePerMWG)
async function estimateGasForFillOrder(orderId, amount)
```

**Deliverables:**
- ✅ Order and Trade models
- ✅ OrderBookService class
- ✅ Event listener service
- ✅ Complete API routes
- ✅ Contract integration helpers
- ✅ API documentation (Swagger)

---

## Phase 3: Frontend Development (Days 5-7)

### Task 3.1: Order Book Page Structure
**Location:** `frontend/src/app/orderbook/`

**Pages:**
```
/orderbook                  - Main order book view
/orderbook/create           - Create buy order (client)
/orderbook/my-orders        - User's orders
/orderbook/trades           - Trade history
/orderbook/admin            - Admin management (protected)
```

### Task 3.2: Shared Components
**Location:** `frontend/src/components/orderbook/`

#### OrderBookDisplay.tsx
**Purpose:** Visual order book (like exchange)

**Features:**
- Buy orders table (green, sorted by price descending)
- Sell orders table (red, sorted by price ascending)
- Spread display
- Real-time updates
- Click to fill functionality (admin only)

#### CreateBuyOrderForm.tsx
**Purpose:** Client creates buy order

**Fields:**
- MWG amount input
- Price per MWG input (or use market price)
- Total BNB calculation (auto)
- Expiry selection (1hr, 6hr, 24hr, 7 days)
- BNB balance check
- Approve BNB button
- Create Order button

**Validations:**
- Minimum MWG amount
- Maximum price deviation
- Sufficient BNB balance
- Valid expiry time

#### OrderCard.tsx
**Purpose:** Display single order

**Shows:**
- Order ID
- Order type (BUY/SELL badge)
- MWG amount (total, filled, remaining)
- BNB amount
- Price per MWG
- Created date
- Expires date (with countdown)
- Status badge
- Action buttons (Cancel, Fill)

#### FillOrderModal.tsx
**Purpose:** Admin fills order

**Features:**
- Order details summary
- Amount to fill input (allow partial)
- Total MWG needed display
- Total BNB received display
- MWG balance check
- Approve MWG button
- Fill Order button
- Transaction status

#### TradeHistoryTable.tsx
**Purpose:** Display executed trades

**Columns:**
- Trade ID
- Date/Time
- Buyer/Seller
- MWG Amount
- BNB Amount
- Price
- Transaction link

### Task 3.3: Custom Hooks
**Location:** `frontend/src/hooks/orderbook/`

#### useOrderBook.ts
```typescript
function useOrderBook()
// Returns: { buyOrders, sellOrders, loading, error, refresh }

function useOrder(orderId)
// Returns: { order, loading, error, refresh }

function useUserOrders(address)
// Returns: { orders, loading, error, refresh }

function useBestPrices()
// Returns: { bestBuyPrice, bestSellPrice, spread, loading }

function useOrderBookStats()
// Returns: { stats, loading, error }
```

#### useOrderBookActions.ts
```typescript
function useCreateBuyOrder()
// Returns: { createBuyOrder, loading, error, txHash }

function useCreateSellOrder()
// Returns: { createSellOrder, loading, error, txHash }

function useFillOrder()
// Returns: { fillOrder, loading, error, txHash }

function useCancelOrder()
// Returns: { cancelOrder, loading, error, txHash }
```

#### useOrderBookEvents.ts
```typescript
function useOrderCreatedEvents(callback)
function useOrderFilledEvents(callback)
function useOrderCancelledEvents(callback)
```

### Task 3.4: Page Implementation

#### /orderbook - Main Page
**Components:**
- OrderBookDisplay (main component)
- BestPrices summary cards
- Recent trades feed
- Quick stats (total volume, active orders, etc.)
- "Create Buy Order" button (clients)
- "Create Sell Order" button (admin only)

#### /orderbook/create - Create Buy Order
**Components:**
- CreateBuyOrderForm
- Current market price display
- Order book preview
- Your active orders sidebar
- Recent trades sidebar

#### /orderbook/my-orders - User Orders
**Components:**
- Active orders list (OrderCard components)
- Order history (filled, cancelled, expired)
- Filter/sort options
- Export to CSV button

#### /orderbook/admin - Admin Management
**Protected Route (Admin Only)**

**Sections:**
1. **Active Buy Orders to Fill**
   - List of client buy orders
   - "Fill Order" buttons
   - Batch fill option

2. **Your Active Sell Orders**
   - Your pending sell orders
   - Cancel option
   - Edit price option

3. **Create Sell Order**
   - Quick form to create sell orders
   - Preset amounts (1000, 5000, 10000 MWG)
   - Market price suggestion

4. **Analytics Dashboard**
   - Total volume traded
   - Total orders filled
   - Average price
   - Revenue generated (BNB received)
   - Charts (price history, volume over time)

### Task 3.5: Real-time Updates
**Implementation:** WebSocket or polling

**Updates:**
- New orders created
- Orders filled
- Orders cancelled
- Price changes
- Your orders status

**Deliverables:**
- ✅ All page components
- ✅ All shared components
- ✅ Custom hooks
- ✅ Real-time updates
- ✅ Mobile responsive design
- ✅ Loading states
- ✅ Error handling
- ✅ Transaction confirmations

---

## Phase 4: Integration & Testing (Day 8)

### Task 4.1: End-to-End Testing

**Test Scenarios:**

#### Scenario 1: Client Creates & Admin Fills
1. Client creates buy order (1000 MWG for 0.1 BNB)
2. BNB deposited to contract
3. Order appears in admin dashboard
4. Admin fills order
5. MWG transferred to client
6. BNB transferred to admin
7. Order marked as filled
8. Trade recorded in history

#### Scenario 2: Admin Creates & Client Fills
1. Admin creates sell order (5000 MWG for 0.5 BNB)
2. MWG deposited to contract
3. Order appears in public order book
4. Client fills order
5. BNB transferred to admin
6. MWG transferred to client
7. Order marked as filled

#### Scenario 3: Partial Fills
1. Client creates buy order (10000 MWG for 1 BNB)
2. Admin partially fills (3000 MWG)
3. Order status: PARTIALLY_FILLED
4. Remaining: 7000 MWG
5. Admin fills remaining 7000 MWG
6. Order status: FILLED

#### Scenario 4: Order Cancellation
1. Client creates buy order
2. Client cancels before filled
3. BNB returned to client
4. Order status: CANCELLED

#### Scenario 5: Order Expiration
1. Client creates order with 1hr expiry
2. Order not filled within 1hr
3. Order status: EXPIRED
4. Client can claim BNB back

### Task 4.2: Security Testing
- ✅ Reentrancy attack prevention
- ✅ Integer overflow/underflow
- ✅ Unauthorized access tests
- ✅ Double-spend prevention
- ✅ Front-running mitigation
- ✅ Gas limit attacks
- ✅ Input validation

### Task 4.3: Performance Testing
- ✅ Order book with 1000+ orders
- ✅ Multiple simultaneous fills
- ✅ Event listener under load
- ✅ API response times
- ✅ Frontend rendering performance

### Task 4.4: User Acceptance Testing
- ✅ Admin workflow walkthrough
- ✅ Client workflow walkthrough
- ✅ Mobile experience testing
- ✅ Error message clarity
- ✅ Transaction confirmation UX

**Deliverables:**
- ✅ All test scenarios passed
- ✅ Security audit completed
- ✅ Performance benchmarks met
- ✅ UAT sign-off

---

## Phase 5: Deployment & Documentation (Day 9)

### Task 5.1: Smart Contract Deployment

**Testnet Deployment:**
1. Deploy to BSC testnet
2. Verify contract on BSCScan
3. Test all functions
4. Run integration tests

**Mainnet Deployment:**
1. Final security review
2. Deploy to BSC mainnet
3. Verify contract on BSCScan
4. Update frontend config
5. Update backend config

### Task 5.2: Backend Deployment

**Environment Variables:**
```env
ORDERBOOK_CONTRACT_ADDRESS=0x...
ORDERBOOK_ENABLED=true
ORDERBOOK_MIN_MWG_AMOUNT=100
ORDERBOOK_MAX_EXPIRY_HOURS=168
ORDERBOOK_FEE_PERCENTAGE=0
```

**Deployment Steps:**
1. Add contract ABI to `api/contracts/`
2. Update environment variables
3. Deploy to Railway
4. Start event listener service
5. Verify API endpoints
6. Monitor logs

### Task 5.3: Frontend Deployment

**Configuration:**
```typescript
// config/contracts.ts
export const ORDERBOOK_ADDRESS = "0x..." as Address;
export const ORDERBOOK_MIN_ORDER = 100; // 100 MWG minimum
export const ORDERBOOK_MAX_EXPIRY = 168; // 7 days max
```

**Deployment Steps:**
1. Update contract address
2. Build production bundle
3. Deploy to hosting
4. Test on production
5. Enable feature flag

### Task 5.4: Documentation

**User Documentation:**
- Client guide: How to create buy orders
- Client guide: How to check order status
- Client guide: How to cancel orders
- FAQ section

**Admin Documentation:**
- How to view pending orders
- How to fill orders
- How to create sell orders
- How to manage order book
- Analytics guide

**Developer Documentation:**
- Smart contract documentation
- API documentation (Swagger)
- Event listener setup
- Database schema
- Integration guide

**Deliverables:**
- ✅ Contracts deployed to mainnet
- ✅ Backend deployed and running
- ✅ Frontend deployed and accessible
- ✅ Complete documentation
- ✅ Monitoring dashboards
- ✅ Backup & recovery procedures

---

## Phase 6: Monitoring & Optimization (Day 10)

### Task 6.1: Monitoring Setup

**Smart Contract Monitoring:**
- Order creation rate
- Fill rate
- Gas costs
- Failed transactions
- Balance tracking

**Backend Monitoring:**
- Event sync status
- API response times
- Database query performance
- Error rates
- Active connections

**Frontend Monitoring:**
- Page load times
- Transaction success rates
- User interactions
- Error tracking

### Task 6.2: Analytics Dashboard

**Metrics:**
- Total orders created
- Total trades executed
- Total volume (MWG and BNB)
- Average order size
- Average fill time
- Price trends
- User activity

### Task 6.3: Optimization

**Gas Optimization:**
- Batch operations where possible
- Optimize storage patterns
- Reduce redundant calculations

**Database Optimization:**
- Index frequently queried fields
- Optimize aggregation queries
- Implement caching

**Frontend Optimization:**
- Code splitting
- Lazy loading
- Memoization
- Virtual scrolling for large lists

**Deliverables:**
- ✅ Monitoring dashboards active
- ✅ Analytics tracking
- ✅ Performance optimizations applied
- ✅ System running smoothly

---

## Success Criteria

### Smart Contract
- ✅ Deployed to BSC mainnet
- ✅ Verified on BSCScan
- ✅ All tests passing
- ✅ Security audit clean
- ✅ Gas costs optimized

### Backend
- ✅ Event listener syncing in real-time
- ✅ API response time < 200ms
- ✅ 99.9% uptime
- ✅ All endpoints documented
- ✅ Error handling robust

### Frontend
- ✅ Mobile responsive
- ✅ Intuitive UX
- ✅ Fast load times (< 2s)
- ✅ Real-time updates working
- ✅ Transaction confirmations clear

### Business Goals
- ✅ Zero slippage payments
- ✅ Transparent pricing
- ✅ Client self-service enabled
- ✅ Admin workflow streamlined
- ✅ Cost savings vs AMM documented

---

## File Structure

```
contracts/
├── MWGOrderBook.sol
└── interfaces/
    └── IMWGOrderBook.sol

scripts/
├── deploy-orderbook.js
└── verify-orderbook.js

test/
└── MWGOrderBook.test.js

deployments/
└── orderbook-bsc.json

api/src/orderbook/
├── models/
│   ├── Order.js
│   └── Trade.js
├── services/
│   ├── orderBookService.js
│   └── eventListener.js
├── routes/
│   └── orderbook.js
└── contracts/
    ├── MWGOrderBook.json
    └── orderBookContract.js

frontend/src/
├── app/orderbook/
│   ├── page.tsx
│   ├── create/
│   │   └── page.tsx
│   ├── my-orders/
│   │   └── page.tsx
│   ├── trades/
│   │   └── page.tsx
│   └── admin/
│       └── page.tsx
├── components/orderbook/
│   ├── OrderBookDisplay.tsx
│   ├── CreateBuyOrderForm.tsx
│   ├── OrderCard.tsx
│   ├── FillOrderModal.tsx
│   └── TradeHistoryTable.tsx
└── hooks/orderbook/
    ├── useOrderBook.ts
    ├── useOrderBookActions.ts
    └── useOrderBookEvents.ts

docs/
├── ORDERBOOK_IMPLEMENTATION_PLAN.md (this file)
├── ORDERBOOK_USER_GUIDE.md
├── ORDERBOOK_ADMIN_GUIDE.md
└── ORDERBOOK_API.md
```

---

## Timeline Summary

**Day 1:** Smart contract development & testing
**Day 2:** Smart contract deployment & verification
**Day 3:** Backend models & services
**Day 4:** Backend API & event listeners
**Day 5:** Frontend components & hooks
**Day 6:** Frontend pages
**Day 7:** Frontend integration & styling
**Day 8:** End-to-end testing
**Day 9:** Deployment & documentation
**Day 10:** Monitoring & optimization

**Total: 10 days (AI-assisted development)**

---

## Next Steps

1. Review and approve this plan
2. Begin Phase 1: Smart Contract Development
3. Iterate based on feedback
4. Launch MVP

---

## Notes & Considerations

### Security
- Consider adding admin withdrawal limits
- Implement emergency pause functionality
- Add order size limits to prevent manipulation
- Monitor for suspicious patterns

### Future Enhancements
- Automatic order matching system
- Price feeds from external oracles
- Limit orders with price triggers
- Mobile app
- Email/SMS notifications
- Multi-token support
- Referral system

### Maintenance
- Regular security audits
- Gas price optimization
- Database cleanup (archive old orders)
- Performance monitoring
- User feedback collection

---

**Last Updated:** November 20, 2025
**Version:** 1.0
**Status:** Ready for implementation
