/**
 * Test script for Order Book API endpoints
 * 
 * Tests all public and admin endpoints to verify they are working correctly
 * Run this with the API server running locally or against deployed instance
 */

const axios = require('axios');
require('dotenv').config();

// Configuration
const API_BASE_URL = 'http://localhost:3000';
const API_KEY = process.env.BOT_API_KEY || ''; // For admin endpoints

// Test addresses (use real addresses from your deployment)
const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'; // Example address
const TEST_ORDER_ID = '1'; // Will be updated from actual data

// Axios instance with optional auth
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: API_KEY ? { 'X-API-Key': API_KEY } : {},
    timeout: 10000,
    validateStatus: () => true // Don't throw on any status
});

// Helper to log test results
function logTest(name, passed, details = '') {
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${name}`);
    if (details) console.log(`   ${details}`);
}

// Helper to log response
function logResponse(endpoint, status, data) {
    console.log(`\n📍 ${endpoint}`);
    console.log(`   Status: ${status}`);
    if (data && typeof data === 'object') {
        const preview = JSON.stringify(data, null, 2).split('\n').slice(0, 10).join('\n');
        console.log(`   Response preview:\n${preview}${Object.keys(data).length > 10 ? '\n   ...' : ''}`);
    }
}

// Test functions
async function testGetActiveOrders() {
    console.log('\n=== Testing GET /api/orderbook/orders ===');

    try {
        // Test 1: Get all active orders
        const res1 = await api.get('/api/orderbook/orders');
        logResponse('GET /orders', res1.status, res1.data);
        logTest(
            'Get all active orders',
            res1.status === 200 && res1.data.orders !== undefined,
            `Found ${res1.data.orders?.length || 0} orders`
        );

        // Test 2: Filter by BUY orders
        const res2 = await api.get('/api/orderbook/orders?orderType=0&limit=10');
        logTest(
            'Filter BUY orders',
            res2.status === 200,
            `Found ${res2.data.orders?.length || 0} buy orders`
        );

        // Test 3: Filter by SELL orders
        const res3 = await api.get('/api/orderbook/orders?orderType=1&limit=10');
        logTest(
            'Filter SELL orders',
            res3.status === 200,
            `Found ${res3.data.orders?.length || 0} sell orders`
        );

        // Test 4: Pagination
        const res4 = await api.get('/api/orderbook/orders?limit=5&offset=0');
        logTest(
            'Pagination',
            res4.status === 200 && res4.data.pagination !== undefined,
            `Limit: ${res4.data.pagination?.limit}, Offset: ${res4.data.pagination?.offset}`
        );

        return res1.data.orders && res1.data.orders.length > 0 ? res1.data.orders[0].orderId : null;
    } catch (error) {
        logTest('Get active orders', false, error.message);
        return null;
    }
}

async function testGetOrderDetails(orderId) {
    console.log('\n=== Testing GET /api/orderbook/orders/:orderId ===');

    if (!orderId) {
        console.log('⏭️  Skipping (no order ID available)');
        return;
    }

    try {
        const res = await api.get(`/api/orderbook/orders/${orderId}`);
        logResponse(`GET /orders/${orderId}`, res.status, res.data);
        logTest(
            'Get order details',
            res.status === 200 && res.data.order !== undefined,
            `Order ID: ${orderId}`
        );

        // Test invalid order ID
        const res2 = await api.get('/api/orderbook/orders/999999999');
        logTest(
            'Get non-existent order',
            res2.status === 404,
            'Should return 404'
        );
    } catch (error) {
        logTest('Get order details', false, error.message);
    }
}

async function testGetFills() {
    console.log('\n=== Testing GET /api/orderbook/fills ===');

    try {
        // Test 1: Get all fills
        const res1 = await api.get('/api/orderbook/fills');
        logResponse('GET /fills', res1.status, res1.data);
        logTest(
            'Get all fills',
            res1.status === 200 && res1.data.fills !== undefined,
            `Found ${res1.data.fills?.length || 0} fills`
        );

        // Test 2: Pagination
        const res2 = await api.get('/api/orderbook/fills?limit=5&offset=0');
        logTest(
            'Paginated fills',
            res2.status === 200,
            `Limit: 5, Found: ${res2.data.fills?.length || 0}`
        );

        return res1.data.fills && res1.data.fills.length > 0 ? res1.data.fills[0].orderId : null;
    } catch (error) {
        logTest('Get fills', false, error.message);
        return null;
    }
}

async function testGetFillsByOrder(orderId) {
    console.log('\n=== Testing GET /api/orderbook/fills/:orderId ===');

    if (!orderId) {
        console.log('⏭️  Skipping (no order ID available)');
        return;
    }

    try {
        const res = await api.get(`/api/orderbook/fills/${orderId}`);
        logResponse(`GET /fills/${orderId}`, res.status, res.data);
        logTest(
            'Get fills for order',
            res.status === 200,
            `Order ID: ${orderId}`
        );
    } catch (error) {
        logTest('Get fills by order', false, error.message);
    }
}

async function testGetStats() {
    console.log('\n=== Testing GET /api/orderbook/stats ===');

    try {
        const res = await api.get('/api/orderbook/stats');
        logResponse('GET /stats', res.status, res.data);
        logTest(
            'Get statistics',
            res.status === 200 && res.data.stats !== undefined,
            `Total orders: ${res.data.stats?.totalOrders || 0}, Active: ${res.data.stats?.activeOrders || 0}`
        );
    } catch (error) {
        logTest('Get stats', false, error.message);
    }
}

async function testGetRecentActivity() {
    console.log('\n=== Testing GET /api/orderbook/recent-activity ===');

    try {
        // Test 1: Default limit
        const res1 = await api.get('/api/orderbook/recent-activity');
        logResponse('GET /recent-activity', res1.status, res1.data);
        logTest(
            'Get recent activity (default)',
            res1.status === 200 && res1.data.activity !== undefined,
            `Found ${res1.data.activity?.length || 0} events`
        );

        // Test 2: Custom limit
        const res2 = await api.get('/api/orderbook/recent-activity?limit=5');
        logTest(
            'Get recent activity (limit 5)',
            res2.status === 200,
            `Found ${res2.data.activity?.length || 0} events`
        );
    } catch (error) {
        logTest('Get recent activity', false, error.message);
    }
}

async function testGetBestPrices() {
    console.log('\n=== Testing GET /api/orderbook/best-prices ===');

    try {
        const res = await api.get('/api/orderbook/best-prices');
        logResponse('GET /best-prices', res.status, res.data);
        logTest(
            'Get best prices',
            res.status === 200,
            `Best Buy: ${res.data.bestBuy?.pricePerMWG || 'N/A'}, Best Sell: ${res.data.bestSell?.pricePerMWG || 'N/A'}`
        );
    } catch (error) {
        logTest('Get best prices', false, error.message);
    }
}

async function testGetUserOrders(address) {
    console.log('\n=== Testing GET /api/orderbook/user/:address/orders ===');

    try {
        const res = await api.get(`/api/orderbook/user/${address}/orders`);
        logResponse(`GET /user/${address}/orders`, res.status, res.data);
        logTest(
            'Get user orders',
            res.status === 200 && res.data.orders !== undefined,
            `Found ${res.data.orders?.length || 0} orders`
        );

        // Test with status filter
        const res2 = await api.get(`/api/orderbook/user/${address}/orders?status=0`);
        logTest(
            'Filter by status',
            res2.status === 200,
            `Active orders: ${res2.data.orders?.length || 0}`
        );

        // Test invalid address
        const res3 = await api.get('/api/orderbook/user/invalid-address/orders');
        logTest(
            'Invalid address validation',
            res3.status === 400,
            'Should return 400 for invalid address'
        );
    } catch (error) {
        logTest('Get user orders', false, error.message);
    }
}

async function testGetUserFillsAsFiller(address) {
    console.log('\n=== Testing GET /api/orderbook/user/:address/fills-as-filler ===');

    try {
        const res = await api.get(`/api/orderbook/user/${address}/fills-as-filler`);
        logResponse(`GET /user/${address}/fills-as-filler`, res.status, res.data);
        logTest(
            'Get fills as filler',
            res.status === 200,
            `Found ${res.data.fills?.length || 0} fills`
        );
    } catch (error) {
        logTest('Get fills as filler', false, error.message);
    }
}

async function testGetUserFillsAsCreator(address) {
    console.log('\n=== Testing GET /api/orderbook/user/:address/fills-as-creator ===');

    try {
        const res = await api.get(`/api/orderbook/user/${address}/fills-as-creator`);
        logResponse(`GET /user/${address}/fills-as-creator`, res.status, res.data);
        logTest(
            'Get fills as creator',
            res.status === 200,
            `Found ${res.data.fills?.length || 0} fills`
        );
    } catch (error) {
        logTest('Get fills as creator', false, error.message);
    }
}

async function testGetUserWithdrawals(address) {
    console.log('\n=== Testing GET /api/orderbook/user/:address/withdrawals ===');

    try {
        const res = await api.get(`/api/orderbook/user/${address}/withdrawals`);
        logResponse(`GET /user/${address}/withdrawals`, res.status, res.data);
        logTest(
            'Get withdrawals',
            res.status === 200,
            `Found ${res.data.withdrawals?.length || 0} withdrawals`
        );

        // Test with amount type filter
        const res2 = await api.get(`/api/orderbook/user/${address}/withdrawals?amountType=BNB`);
        logTest(
            'Filter by amount type',
            res2.status === 200,
            `BNB withdrawals: ${res2.data.withdrawals?.length || 0}`
        );
    } catch (error) {
        logTest('Get withdrawals', false, error.message);
    }
}

async function testAdminSearch() {
    console.log('\n=== Testing POST /api/orderbook/admin/search ===');

    if (!API_KEY) {
        console.log('⏭️  Skipping admin tests (no API key provided)');
        return;
    }

    try {
        const searchCriteria = {
            orderType: 0,
            status: 'active'
        };

        const res = await api.post('/api/orderbook/admin/search', searchCriteria);
        logResponse('POST /admin/search', res.status, res.data);
        logTest(
            'Admin search',
            res.status === 200,
            `Found ${res.data.orders?.length || 0} matching orders`
        );
    } catch (error) {
        logTest('Admin search', false, error.message);
    }
}

async function testAdminAnalytics() {
    console.log('\n=== Testing GET /api/orderbook/admin/analytics ===');

    if (!API_KEY) {
        console.log('⏭️  Skipping (no API key)');
        return;
    }

    try {
        const res = await api.get('/api/orderbook/admin/analytics');
        logResponse('GET /admin/analytics', res.status, res.data);
        logTest(
            'Admin analytics',
            res.status === 200 && res.data.analytics !== undefined,
            'Analytics data retrieved'
        );
    } catch (error) {
        logTest('Admin analytics', false, error.message);
    }
}

async function testHealthEndpoint() {
    console.log('\n=== Testing Health Endpoint ===');

    try {
        const res = await api.get('/health');
        logResponse('GET /health', res.status, res.data);

        const hasOrderBookStatus = res.data.services?.orderBookListener !== undefined;
        logTest(
            'Health endpoint includes orderbook listener',
            hasOrderBookStatus,
            hasOrderBookStatus
                ? `Listener status: ${res.data.services.orderBookListener.status}`
                : 'Orderbook listener not in health check'
        );
    } catch (error) {
        logTest('Health endpoint', false, error.message);
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 Starting Order Book API Endpoint Tests\n');
    console.log('='.repeat(70));
    console.log(`API URL: ${API_BASE_URL}`);
    console.log(`API Key: ${API_KEY ? '✅ Provided' : '❌ Not provided (admin tests will be skipped)'}`);
    console.log(`Test Address: ${TEST_ADDRESS}`);
    console.log('='.repeat(70));

    const startTime = Date.now();
    let passedTests = 0;
    let totalTests = 0;

    try {
        // Check API availability
        console.log('\n=== Checking API Availability ===');
        try {
            const healthCheck = await api.get('/health');
            if (healthCheck.status === 200) {
                console.log('✅ API is reachable');
            } else {
                console.log(`⚠️  API returned status ${healthCheck.status}`);
            }
        } catch (error) {
            console.log(`❌ Cannot reach API: ${error.message}`);
            console.log('Make sure the API server is running!');
            process.exit(1);
        }

        // Run all public endpoint tests
        const orderId = await testGetActiveOrders();
        await testGetOrderDetails(orderId);
        await testGetFills();

        const fillOrderId = await testGetFills();
        await testGetFillsByOrder(fillOrderId || orderId);

        await testGetStats();
        await testGetRecentActivity();
        await testGetBestPrices();
        await testGetUserOrders(TEST_ADDRESS);
        await testGetUserFillsAsFiller(TEST_ADDRESS);
        await testGetUserFillsAsCreator(TEST_ADDRESS);
        await testGetUserWithdrawals(TEST_ADDRESS);

        // Run admin endpoint tests (if API key provided)
        await testAdminSearch();
        await testAdminAnalytics();

        // Test health endpoint integration
        await testHealthEndpoint();

        const endTime = Date.now();
        const duration = ((endTime - startTime) / 1000).toFixed(2);

        console.log('\n' + '='.repeat(70));
        console.log('\n📊 Test Summary\n');
        console.log(`Total Duration: ${duration}s`);
        console.log(`API Base URL: ${API_BASE_URL}`);
        console.log('\n✅ All endpoint tests completed!');
        console.log('\nNote: Check the logs above for detailed results of each test.');
        console.log('Tests may show empty results if database has no data yet.');
        console.log('\n' + '='.repeat(70));

    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests()
        .then(() => {
            console.log('\n✅ Test script completed successfully\n');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n❌ Test script failed:', error);
            process.exit(1);
        });
}

module.exports = { runAllTests };
